/**
 * Authenticate fresh-Lean refusal integration without changing older evidence or support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { beforeFinRefinementSource } from "./helpers/fin-refinement-source-history.mjs";
import { beforeReviewedFinRefusalSource, reviewedFinRefusalChangedPaths, reviewedFinRefusalHistoryPath, reviewedFinRefusalPredecessor, reverseReviewedFinRefusalUpdate } from "./helpers/reviewed-fin-refusal-source-history.mjs";
import "./helpers/reviewed-fin-native-refusal-evidence-tests.mjs";

test("reviewed Fin refusal history authenticates exact predecessors and refuses unknown edits", async () => {
	const record = JSON.parse(await readFile(reviewedFinRefusalHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "reviewed-fin-refusal-v1");
	assert.equal(record.predecessorCommit, reviewedFinRefusalPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), reviewedFinRefusalChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8"), previous = reverseReviewedFinRefusalUpdate(source, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeReviewedFinRefusalSource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		assert.equal(beforeReviewedFinRefusalSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source), beforeFinRefinementSource(update.path, previous));
		const changed = source + "\n// unrecorded change\n";
		assert.equal(beforeReviewedFinRefusalSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedFinRefusalUpdate(changed, update));
		assert.throws(() => reverseReviewedFinRefusalUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseReviewedFinRefusalUpdate(source, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reverseReviewedFinRefusalUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("reviewed Fin refusal integration changes only exact inventory source pins", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(text), previous = JSON.parse(beforeReviewedFinRefusalSource(path, text));
	const record = JSON.parse(await readFile(reviewedFinRefusalHistoryPath));
	const updates = new Map(record.updates.map(update => [update.path, update]));
	let pins = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = updates.get(file.path);
		if(update && file.sha256 === update.previousSha256)
		{
			assert.equal(sha256(await readFile(file.path)), update.currentSha256);
			file.sha256 = update.currentSha256; pins++;
		}
	}
	assert.equal(pins, 122);
	assert.deepEqual(current, previous, "no observation, support state or evidence claim changes");
	for(const evidence of current.evidence) for(const file of evidence.files)
		assert.equal(sha256(await readFile(file.path)), file.sha256, file.path);
	assert.equal(current.observations.length, 497); assert.equal(current.evidence.length, 284);
	assert.equal(classifyRepositoryTest("tests/reviewed-fin-refusals.test.mjs"), "component");
	assert.equal(classifyRepositoryTest("tests/reviewed-fin-refusal-history.test.mjs"), "contract");
});

test("the reviewed Fin refusal history updater refuses another HEAD before any write", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-fin-refusal-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-reviewed-fin-refusal-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1); assert.match(result.stderr, /Reviewed Fin refusal history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
