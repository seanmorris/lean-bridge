/**
 * Exact source-history controls for nested checked-record graphs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "./source-history-digest.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import {
	beforeNestedCheckedRecordSource,
	nestedCheckedRecordChangedPaths,
	nestedCheckedRecordDraftParent,
	nestedCheckedRecordHistoryPath,
	nestedCheckedRecordPredecessor,
	reverseNestedCheckedRecordUpdate
} from "./nested-checked-record-source-history.mjs";

test("nested checked-record history reconstructs every predecessor source", async () => {
	const record = JSON.parse(await readFile(nestedCheckedRecordHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "nested-checked-record-source-v1");
	assert.equal(record.predecessorCommit, nestedCheckedRecordPredecessor);
	assert.equal(record.draftParentCommit, nestedCheckedRecordDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, nestedCheckedRecordChangedPaths);
	for(const update of record.updates)
	{
		const current = await readFile(update.path, "utf8");
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = execFileSync("git", [
			"show", `${nestedCheckedRecordPredecessor}:${update.path}`
		], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
		assert.equal(reverseNestedCheckedRecordUpdate(current, update), previous);
		assert.equal(beforeNestedCheckedRecordSource(update.path, current), previous);
		assert.equal(beforeNestedCheckedRecordSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeNestedCheckedRecordSource(
			update.path, current + "unknown"), current + "unknown");
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNestedCheckedRecordUpdate(current, changed));
		}
	}
});

test("nested checked-record history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nested-record-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [
		resolve("scripts/update-nested-checked-record-source-history.mjs")
	], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
