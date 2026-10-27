/**
 * Preserve installed observations while checking checked-record Python archive.
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
import { sourceAtHistoryMilestone } from "./source-history-test-source.mjs";
import { beforeCheckedRecordPythonArchiveSource, checkedRecordPythonArchiveChangedPaths, checkedRecordPythonArchiveHistoryPath, checkedRecordPythonArchivePredecessor, reverseCheckedRecordPythonArchiveUpdate } from "./checked-record-python-history.mjs";
import { assertHistoricalTypeSurfaceEvidence } from "./type-surface-historical-evidence.mjs";

test("Checked-record Python archive history authenticates exact transitions and refuses unknown edits", async () => {
	const history = JSON.parse(await readFile(checkedRecordPythonArchiveHistoryPath));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "checked-record-python-v1");
	assert.equal(history.predecessorCommit, checkedRecordPythonArchivePredecessor);
	assert.deepEqual(history.updates.map(update => update.path), checkedRecordPythonArchiveChangedPaths);
	for(const update of history.updates)
	{
		const current = await sourceAtHistoryMilestone(
			checkedRecordPythonArchiveHistoryPath, update.path
		);
		const previous = reverseCheckedRecordPythonArchiveUpdate(current, update);
		assert.equal(beforeCheckedRecordPythonArchiveSource(update.path, current), previous);
		const bytes = Buffer.from(current);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.currentSha256), bytes);
		assert.equal(beforeFinRefinementSource(update.path, Buffer.from(current), update.previousSha256), previous);
		const unknown = current + "\nunknown\n";
		assert.equal(beforeCheckedRecordPythonArchiveSource(update.path, unknown), unknown);
		assert.throws(() => reverseCheckedRecordPythonArchiveUpdate(unknown, update));
		for(const mutate of [item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.path = "unknown"; }, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "changed"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseCheckedRecordPythonArchiveUpdate(current, changed));
			}
	}
});

test("Checked-record Python archive changes only source pins and preserves all installed observations", async () => {
	const history = JSON.parse(await readFile(checkedRecordPythonArchiveHistoryPath));
	const path = "docs/type-surface.v1.json";
	const source = await sourceAtHistoryMilestone(checkedRecordPythonArchiveHistoryPath, path);
	const restored = beforeCheckedRecordPythonArchiveSource(path, source);
	assert.equal(sha256(restored), "3feaa9617b0eff79e6289da8563b7be9d40fb12361326f3b47a45875bbb8f0bc");
	const current = JSON.parse(source), previous = JSON.parse(restored);
	const expected = structuredClone(previous); let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.equal(pins, 18); assert.deepEqual(current, expected);
	assert.equal(current.evidence.length, 420); assert.equal(current.observations.length, 519);
	assert.deepEqual(current.observations, previous.observations);
	await assertHistoricalTypeSurfaceEvidence(current);
	assert.equal(sha256(await readFile("docs/evidence/checked-record-native-installed-source-history-20261010.json")), "2075c888c7316b2e232f9ad0b7843fa90c4560c12e385c581386a40485938134");
});

test("Checked-record Python archive history writer refuses an unrelated checkout before changing files", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-checked-record-python-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-checked-record-python-history.mjs")], { cwd: directory, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
