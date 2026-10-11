/**
 * Preserve installed observations while checking Perl checked-record source support.
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
import { beforeCheckedRecordPerlInstalledSource } from "./checked-record-perl-installed-history.mjs";
import { beforeCheckedRecordPerlSource, checkedRecordPerlChangedPaths, checkedRecordPerlHistoryPath, checkedRecordPerlPredecessor, reverseCheckedRecordPerlUpdate } from "./checked-record-perl-history.mjs";

test("Perl checked-record source history authenticates exact transitions and refuses unknown edits", async () => {
	const history = JSON.parse(await readFile(checkedRecordPerlHistoryPath));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "checked-record-perl-v1");
	assert.equal(history.predecessorCommit, checkedRecordPerlPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), checkedRecordPerlChangedPaths);
	for(const update of history.updates)
	{
		const current = beforeCheckedRecordPerlInstalledSource(update.path, await readFile(update.path, "utf8"));
		const previous = reverseCheckedRecordPerlUpdate(current, update);
		assert.equal(beforeCheckedRecordPerlSource(update.path, current), previous);
		const bytes = Buffer.from(current);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.currentSha256), bytes);
		assert.equal(beforeFinRefinementSource(update.path, Buffer.from(current), update.previousSha256), previous);
		const unknown = current + "\nunknown\n";
		assert.equal(beforeCheckedRecordPerlSource(update.path, unknown), unknown);
		assert.throws(() => reverseCheckedRecordPerlUpdate(unknown, update));
		for(const mutate of [item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.path = "unknown"; }, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "changed"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseCheckedRecordPerlUpdate(current, changed));
			}
	}
});

test("Perl checked-record source changes only source pins and preserves all installed observations", async () => {
	const history = JSON.parse(await readFile(checkedRecordPerlHistoryPath));
	const path = "docs/type-surface.v1.json";
	const source = beforeCheckedRecordPerlInstalledSource(path, await readFile(path, "utf8"));
	const restored = beforeCheckedRecordPerlSource(path, source);
	assert.equal(sha256(restored), "cb14e391d61e1953cc6d213a8b29bacbb629b9fa325fe57495950db9e1029e32");
	const current = JSON.parse(source), previous = JSON.parse(restored);
	const expected = structuredClone(previous); let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.equal(pins, 31); assert.deepEqual(current, expected);
	assert.equal(current.evidence.length, 436); assert.equal(current.observations.length, 551);
	assert.deepEqual(current.observations, previous.observations);
	const hashes = new Map();
	for(const file of current.evidence.flatMap(entry => entry.files))
	{
		const key = file.path + ":" + file.sha256;
		if(!hashes.has(key)) hashes.set(key, sha256(beforeFinRefinementSource(file.path, await readFile(file.path), file.sha256)));
		assert.equal(hashes.get(key), file.sha256, file.path);
	}
	assert.equal(sha256(await readFile("docs/evidence/refinement-core-ci-source-history-20261011.json")), "7966304b44718f88e0f6a13a6e12ae34497098788a4aa2edf356b26cc6e5499d");
});

test("Perl checked-record source history writer refuses an unrelated checkout before changing files", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-checked-record-perl-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-checked-record-perl-history.mjs")], { cwd: directory, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});

test("Perl checked-record source archive retains failed generation and all four fresh Lean routes", async () => {
	const root = "docs/evidence/checked-record-perl-source-20261011";
	const bytes = await readFile(join(root, "index.json"));
	assert.equal(sha256(bytes), "8768632e68132281270f342dfd81b581924d0eebd0a437cd33d1030f780f5552");
	const index = JSON.parse(bytes);
	assert.equal(index.predecessor, checkedRecordPerlPredecessor);
	assert.deepEqual(index.records.map(item => item.path), ["before.tap", "fresh-lean.tap", "fixture.tap"]);
	const records = new Map();
	for(const record of index.records)
	{
		const original = await readFile(join(root, record.path));
		assert.equal(original.length, record.bytes);
		assert.equal(sha256(original), record.sha256);
		records.set(record.path, original.toString());
	}
	assert.match(records.get("before.tap"), /# pass 0\n# fail 5\n/u);
	assert.match(records.get("fresh-lean.tap"), /# pass 9\n# fail 0\n/u);
	assert.match(records.get("fresh-lean.tap"), /# skipped 0\n/u);
	for(const route of ["ordinary-source", "reviewed-ir", "result-only-ordinary-source", "result-only-reviewed-ir"])
		assert.ok(records.get("fresh-lean.tap").includes(`fresh Lean compiles checked-record Perl mirror adapters for ${route}`));
	assert.match(records.get("fixture.tap"), /# pass 2\n# fail 0\n/u);
	for(const source of index.sources)
		assert.equal(sha256(beforeFinRefinementSource(source.path, await readFile(source.path), source.sha256)), source.sha256);
});
