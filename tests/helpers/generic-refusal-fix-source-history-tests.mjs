/**
 * Preserve prior evidence while separating proof-field and value-dependent-field refusals.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeInheritedRecordPromotionSource } from "./inherited-record-promotion-source-history.mjs";
import { beforeGenericRefusalFixSource, genericRefusalFixChangedPaths, genericRefusalFixHistoryPath, genericRefusalFixPredecessor, reverseGenericRefusalFixUpdate } from "./generic-refusal-fix-source-history.mjs";

test("Generic refusal fix history authenticates exact predecessors and rejects unrecorded edits", async () => {
	const record = JSON.parse(await readFile(genericRefusalFixHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "generic-refusal-fix-v1");
	assert.equal(record.predecessorCommit, genericRefusalFixPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), genericRefusalFixChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeInheritedRecordPromotionSource(update.path, await readFile(update.path, "utf8")), previous = reverseGenericRefusalFixUpdate(source, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeGenericRefusalFixSource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		assert.equal(beforeGenericRefusalFixSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source), beforeFinRefinementSource(update.path, previous));
		const changed = source + "\n// unknown edit\n";
		assert.equal(beforeGenericRefusalFixSource(update.path, changed), changed);
		assert.throws(() => reverseGenericRefusalFixUpdate(changed, update));
		assert.throws(() => reverseGenericRefusalFixUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseGenericRefusalFixUpdate(source, { ...update, path: "unregistered.mjs" }));
		assert.throws(() => reverseGenericRefusalFixUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("Generic refusal fix refreshes exactly 11 source pins without changing coverage", async () => {
	const path = "docs/type-surface.v1.json", text = beforeInheritedRecordPromotionSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(text), previous = JSON.parse(beforeGenericRefusalFixSource(path, text));
	const record = JSON.parse(await readFile(genericRefusalFixHistoryPath, "utf8"));
	const updates = new Map(record.updates.map(update => [update.path, update]));
	let pins = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = updates.get(file.path);
		if(update && file.sha256 === update.previousSha256)
		{
			assert.equal(sha256(beforeInheritedRecordPromotionSource(file.path, await readFile(file.path, "utf8"))), update.currentSha256);
			file.sha256 = update.currentSha256; pins++;
		}
	}
	assert.equal(pins, 11);
	assert.deepEqual(current, previous);
});

test("the generic refusal correction retains the exact reviewed source handoff", async () => {
	const path = "tests/generic-records.test.mjs", text = await readFile(path, "utf8");
	const addition = 'import "./helpers/generic-refusal-fix-source-history-tests.mjs";\n';
	assert.equal(text.split(addition).length, 2);
	assert.equal(sha256(text.replace(addition, "")), "4e064e24cec511c0e9afaf385604f1962c169e9ee4e0e0cd8850e9225905658e");
});

test("the Generic refusal fix updater refuses another HEAD before any write", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-generic-refusal-fix-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-generic-refusal-fix-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Generic refusal fix history is draft-only at its exact predecessor/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
