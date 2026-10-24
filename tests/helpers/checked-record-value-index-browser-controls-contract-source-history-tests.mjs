/**
 * Authenticate the explicit live-versus-archived value-index browser controls
 * contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeCheckedRecordValueIndexBrowserControlsContractSource
	, checkedRecordValueIndexBrowserControlsContractAddedPaths
	, checkedRecordValueIndexBrowserControlsContractChangedPaths
	, checkedRecordValueIndexBrowserControlsContractHistoryPath
	, checkedRecordValueIndexBrowserControlsContractImplementation
	, checkedRecordValueIndexBrowserControlsContractIntegrationPaths
	, checkedRecordValueIndexBrowserControlsContractPredecessor
	, reverseCheckedRecordValueIndexBrowserControlsContractUpdate
} from "./checked-record-value-index-browser-controls-contract-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("value-index browser controls-contract history restores every source"
	, async () => {
		const record = JSON.parse(await readFile(
			checkedRecordValueIndexBrowserControlsContractHistoryPath, "utf8"));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "checked-record-value-index-browser-controls-contract-source-v1");
		assert.equal(record.predecessorCommit
			, checkedRecordValueIndexBrowserControlsContractPredecessor);
		assert.equal(record.implementationCommit
			, checkedRecordValueIndexBrowserControlsContractImplementation);
		assert.deepEqual(record.updates.map(item => item.path)
			, checkedRecordValueIndexBrowserControlsContractChangedPaths);
		assert.deepEqual(record.integrationUpdates.map(item => item.path)
			, checkedRecordValueIndexBrowserControlsContractIntegrationPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, checkedRecordValueIndexBrowserControlsContractAddedPaths);
		for(const update of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(update.path
				, update.currentSha256
				, beforeCheckedRecordValueIndexBrowserControlsContractSource);
			const previous = git(["show"
				, `${checkedRecordValueIndexBrowserControlsContractPredecessor}:${update.path}`]);
			assert.equal(
				reverseCheckedRecordValueIndexBrowserControlsContractUpdate(
					current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256)
			, previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
		for(const update of record.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(update.path
				, update.currentSha256
				, beforeCheckedRecordValueIndexBrowserControlsContractSource);
			const previous = git(["show"
				, `${checkedRecordValueIndexBrowserControlsContractImplementation}:${update.path}`]);
			assert.equal(
				reverseCheckedRecordValueIndexBrowserControlsContractUpdate(
					current, update), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
		for(const addition of record.additions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
	}
);

test("value-index browser controls-contract history is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${checkedRecordValueIndexBrowserControlsContractImplementation}^`])
		.trim(), checkedRecordValueIndexBrowserControlsContractPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, checkedRecordValueIndexBrowserControlsContractPredecessor
		, checkedRecordValueIndexBrowserControlsContractImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...checkedRecordValueIndexBrowserControlsContractChangedPaths].sort());
});

test("value-index browser controls-contract history rejects alteration"
	, async () => {
		const record = JSON.parse(await readFile(
			checkedRecordValueIndexBrowserControlsContractHistoryPath, "utf8"));
		for(const original of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(original.path
				, original.currentSha256
				, beforeCheckedRecordValueIndexBrowserControlsContractSource);
			const update = structuredClone(original);
			update.currentSha256 = "0".repeat(64);
			assert.throws(() =>
				reverseCheckedRecordValueIndexBrowserControlsContractUpdate(
					current, update), original.path);
		}
	}
);

test("value-index browser controls-contract writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-value-index-browser-controls-history-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		const environment = Object.fromEntries(Object.entries(process.env)
			.filter(([key]) => !key.startsWith("GIT_")));
		const run = arguments_ => execFileSync("git", arguments_
			, { cwd: root, env: environment, stdio: "pipe" });
		run(["init", "--quiet"]);
		run(["-c", "user.name=Test", "-c"
			, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
			, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
		const result = spawnSync(process.execPath, [resolve(
			"scripts/update-checked-record-value-index-browser-controls-contract-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /exact implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
