/**
 * Authenticate the history-reader hub repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import {
	beforeHistoryReaderHubRepairSource
	, historyReaderHubRepairChangedPaths
	, historyReaderHubRepairHistoryPath
	, historyReaderHubRepairImplementation
	, historyReaderHubRepairIntegrationPaths
	, historyReaderHubRepairPredecessor
	, reverseHistoryReaderHubRepairUpdate
} from "./history-reader-hub-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("history reader hub repair history restores every source", async () => {
	const record = JSON.parse(await readFile(
		historyReaderHubRepairHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "history-reader-hub-repair-source-v1");
	assert.equal(record.predecessorCommit
		, historyReaderHubRepairPredecessor);
	assert.equal(record.implementationCommit
		, historyReaderHubRepairImplementation);
	assert.ok(record.reconciledTypeSurfacePointers > 0);
	assert.deepEqual(record.updates.map(item => item.path)
		, historyReaderHubRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, historyReaderHubRepairIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeHistoryReaderHubRepairSource
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseHistoryReaderHubRepairUpdate(current, update);
		assert.equal(previous, sourceAt(
			historyReaderHubRepairPredecessor, update.path
		));
		assert.equal(beforeHistoryReaderHubRepairSource(
			update.path, current), previous);
		assert.equal(beforeHistoryReaderHubRepairSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforeHistoryReaderHubRepairSource(
			update.path, `${current}unknown`), `${current}unknown`);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeHistoryReaderHubRepairSource
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseHistoryReaderHubRepairUpdate(current, update)
			, sourceAt(historyReaderHubRepairImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
});

test("history reader hub repair history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		historyReaderHubRepairHistoryPath, "utf8"
	));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256, beforeHistoryReaderHubRepairSource
	);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseHistoryReaderHubRepairUpdate(current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseHistoryReaderHubRepairUpdate(current, update));
});

test("history reader hub repair writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-history-reader-hub-repair-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-history-reader-hub-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
