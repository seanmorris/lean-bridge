/**
 * Authenticate the recursive checked-record .NET source transition.
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
import { beforeFinRefinementSource } from "./helpers/fin-refinement-source-history.mjs";
import {
	beforeMutualCheckedRecordNpmArchivePins
} from "./helpers/mutual-checked-record-npm-archive-source-history.mjs";
import {
	beforeMutualCheckedRecordDotnetPins
	, beforeMutualCheckedRecordDotnetSource
	, mutualCheckedRecordDotnetChangedPaths
	, mutualCheckedRecordDotnetDraftParent, mutualCheckedRecordDotnetHistoryPath
	, mutualCheckedRecordDotnetPredecessor, reverseMutualCheckedRecordDotnetUpdate
} from "./helpers/mutual-checked-record-dotnet-source-history.mjs";

test("the recursive .NET history reconstructs every exact predecessor source", async () => {
	const record = JSON.parse(await readFile(
		mutualCheckedRecordDotnetHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "mutual-checked-record-dotnet-source-v1");
	assert.equal(record.predecessorCommit, mutualCheckedRecordDotnetPredecessor);
	assert.equal(record.draftParentCommit, mutualCheckedRecordDotnetDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, mutualCheckedRecordDotnetChangedPaths);
	for(const update of record.updates)
	{
		const current = beforeFinRefinementSource(
			update.path, await readFile(update.path, "utf8"), update.currentSha256
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = execFileSync("git", [
			"show", `${mutualCheckedRecordDotnetPredecessor}:${update.path}`
		], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
		assert.equal(reverseMutualCheckedRecordDotnetUpdate(current, update), previous);
		assert.equal(beforeMutualCheckedRecordDotnetSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeMutualCheckedRecordDotnetSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforeMutualCheckedRecordDotnetSource(
			update.path, current + "unknown"), current + "unknown");
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() =>
				reverseMutualCheckedRecordDotnetUpdate(current, changed));
		}
	}
});

test("the recursive .NET history refreshes only predecessor source pins", async () => {
	const path = "docs/type-surface.v1.json";
	const record = JSON.parse(await readFile(
		mutualCheckedRecordDotnetHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	const currentText = beforeFinRefinementSource(
		path, await readFile(path, "utf8"), update.currentSha256
	);
	const current = JSON.parse(currentText);
	const previous = JSON.parse(reverseMutualCheckedRecordDotnetUpdate(
		currentText, update
	));
	assert.deepEqual(beforeMutualCheckedRecordDotnetPins(current)
		, beforeMutualCheckedRecordNpmArchivePins(previous));
	const byPath = new Map(record.updates.map(item => [item.path, item]));
	let refreshed = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const source = byPath.get(file.path);
		if(source && file.sha256 === source.previousSha256)
		{
			file.sha256 = source.currentSha256; refreshed++;
		}
	}
	assert.equal(refreshed, record.pinCount);
	assert.deepEqual(current, previous);
});

test("the recursive .NET history updater refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-mutual-record-dotnet-history-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, {
		cwd: root, env: environment, stdio: "pipe"
	});
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-mutual-checked-record-dotnet-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /draft-only at its exact parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
