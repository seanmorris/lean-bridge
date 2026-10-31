/**
 * Verify the omitted recursive Perl package transition and its history-chain
 * repair without weakening any archived source identity.
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
	sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource
} from "./helpers/source-at-fin-history-milestone.mjs";
import {
	beforeRecursiveCheckedRecordPerlPackageHistoricalSource
	, beforeRecursiveCheckedRecordPerlPackageHistoryRepairPins
	, beforeRecursiveCheckedRecordPerlPackageHistoryRepairSource
	, recursiveCheckedRecordPerlPackageHistoricalCommit
	, recursiveCheckedRecordPerlPackageHistoricalParent
	, recursiveCheckedRecordPerlPackageHistoricalPaths
	, recursiveCheckedRecordPerlPackageHistoryRepairChangedPaths
	, recursiveCheckedRecordPerlPackageHistoryRepairPath
	, recursiveCheckedRecordPerlPackageHistoryRepairPredecessor
	, reverseRecursiveCheckedRecordPerlPackageHistoricalUpdate
	, reverseRecursiveCheckedRecordPerlPackageHistoryRepairUpdate
} from "./helpers/recursive-checked-record-perl-package-history-repair.mjs";

const sourceAtRepair = (path, expected) => sourceAtFinHistoryRecordSource(
	recursiveCheckedRecordPerlPackageHistoryRepairPath, path, expected
	, beforeRecursiveCheckedRecordPerlPackageHistoryRepairSource
);

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});

test("recursive Perl package history repair authenticates its current integration", async () => {
	const record = JSON.parse(await readFile(
		recursiveCheckedRecordPerlPackageHistoryRepairPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "recursive-checked-record-perl-package-history-repair-v1");
	assert.equal(record.predecessorCommit
		, recursiveCheckedRecordPerlPackageHistoryRepairPredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, recursiveCheckedRecordPerlPackageHistoryRepairChangedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtRepair(
			update.path, update.currentSha256
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = git(["show"
			, `${recursiveCheckedRecordPerlPackageHistoryRepairPredecessor}:${update.path}`]);
		assert.equal(reverseRecursiveCheckedRecordPerlPackageHistoryRepairUpdate(
			current, update
		), previous);
		assert.equal(beforeRecursiveCheckedRecordPerlPackageHistoryRepairSource(
			update.path, current, update.currentSha256
		), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256
		), previous);
		assert.equal(beforeRecursiveCheckedRecordPerlPackageHistoryRepairSource(
			update.path, current + "unknown"
		), current + "unknown");
	}
});

test("recursive Perl package history repair restores every omitted transition", async () => {
	const record = JSON.parse(await readFile(
		recursiveCheckedRecordPerlPackageHistoryRepairPath, "utf8"
	));
	assert.equal(record.historicalCommit
		, recursiveCheckedRecordPerlPackageHistoricalCommit);
	assert.equal(record.historicalParent
		, recursiveCheckedRecordPerlPackageHistoricalParent);
	assert.deepEqual(record.historicalUpdates.map(update => update.path)
		, recursiveCheckedRecordPerlPackageHistoricalPaths);
	for(const update of record.historicalUpdates)
	{
		const current = git(["show"
			, `${recursiveCheckedRecordPerlPackageHistoricalCommit}:${update.path}`]);
		const previous = git(["show"
			, `${recursiveCheckedRecordPerlPackageHistoricalParent}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseRecursiveCheckedRecordPerlPackageHistoricalUpdate(
			current, update
		), previous);
		assert.equal(beforeRecursiveCheckedRecordPerlPackageHistoricalSource(
			update.path, current, update.currentSha256
		), current);
		assert.equal(beforeRecursiveCheckedRecordPerlPackageHistoricalSource(
			update.path, current, update.previousSha256
		), previous);
		assert.equal(await sourceAtFinHistoryMilestone(
			update.path, update.previousSha256
		), previous, update.path);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update);
			mutate(changed);
			assert.throws(() => reverseRecursiveCheckedRecordPerlPackageHistoricalUpdate(
				current, changed
			));
		}
	}
});

test("recursive Perl package history repair refreshes only current source pins", async () => {
	const record = JSON.parse(await readFile(
		recursiveCheckedRecordPerlPackageHistoryRepairPath, "utf8"
	));
	const path = "docs/type-surface.v1.json";
	const update = record.updates.find(item => item.path === path);
	const currentText = await sourceAtRepair(
		path, update.currentSha256
	);
	const current = JSON.parse(currentText);
	const previous = JSON.parse(
		reverseRecursiveCheckedRecordPerlPackageHistoryRepairUpdate(
			currentText, update
		)
	);
	assert.deepEqual(
		beforeRecursiveCheckedRecordPerlPackageHistoryRepairPins(current)
		, previous
	);
	const byPath = new Map(record.updates.map(item => [item.path, item]));
	let refreshed = 0;
	const repinned = structuredClone(previous);
	for(const evidence of repinned.evidence) for(const file of evidence.files)
	{
		const source = byPath.get(file.path);
		if(source && file.sha256 === source.previousSha256)
		{
			file.sha256 = source.currentSha256;
			refreshed++;
		}
	}
	assert.equal(refreshed, record.pinCount);
	assert.deepEqual(current, repinned);
});

test("recursive Perl package history repair updater refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-recursive-perl-package-history-repair-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = args => execFileSync("git", args, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-recursive-checked-record-perl-package-history-repair.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /draft-only at its exact parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
