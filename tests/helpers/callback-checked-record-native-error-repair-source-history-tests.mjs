/**
 * Authenticate the C callback checked-record error-contract repair.
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
	beforeCallbackCheckedRecordNativeErrorRepairSource
	, callbackCheckedRecordNativeErrorRepairAddedPaths
	, callbackCheckedRecordNativeErrorRepairChangedPaths
	, callbackCheckedRecordNativeErrorRepairHistoricalPaths
	, callbackCheckedRecordNativeErrorRepairHistoryPath
	, callbackCheckedRecordNativeErrorRepairImplementation
	, callbackCheckedRecordNativeErrorRepairPredecessor
	, callbackCheckedRecordNativeErrorRepairRegistrationPaths
	, reverseCallbackCheckedRecordNativeErrorRepairUpdate
} from "./callback-checked-record-native-error-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const original = path => execFileSync("git", ["show"
	, `${callbackCheckedRecordNativeErrorRepairPredecessor}:${path}`]
, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("C callback checked-record error repair restores every source and pointer"
	, async () => {
		const record = JSON.parse(await readFile(
			callbackCheckedRecordNativeErrorRepairHistoryPath, "utf8"
		));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "callback-checked-record-native-error-repair-source-v1");
		assert.equal(record.predecessorCommit
			, callbackCheckedRecordNativeErrorRepairPredecessor);
		assert.equal(record.implementationCommit
			, callbackCheckedRecordNativeErrorRepairImplementation);
		assert.deepEqual(record.updates.map(item => item.path)
			, callbackCheckedRecordNativeErrorRepairChangedPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, callbackCheckedRecordNativeErrorRepairAddedPaths);
		assert.ok(record.repairedTypeSurfacePointers > 0);
		for(const update of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
				, beforeCallbackCheckedRecordNativeErrorRepairSource
			);
			assert.equal(sha256(current), update.currentSha256, update.path);
			const previous = reverseCallbackCheckedRecordNativeErrorRepairUpdate(
				current, update
			);
			assert.equal(previous, original(update.path));
			assert.equal(beforeCallbackCheckedRecordNativeErrorRepairSource(
				update.path, current), previous);
			assert.equal(beforeCallbackCheckedRecordNativeErrorRepairSource(
				update.path, current, update.currentSha256), current);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
			assert.equal(beforeCallbackCheckedRecordNativeErrorRepairSource(
				update.path, `${current}unknown`), `${current}unknown`);
		}
		for(const addition of record.additions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256
			)), addition.currentSha256, addition.path);
		assert.deepEqual(callbackCheckedRecordNativeErrorRepairHistoricalPaths
			, [
				"src/backends/c/callable-graph-package.mjs"
				, "tests/callback-checked-record-native-ci.test.mjs"
				, "tests/callback-checked-record-native.test.mjs"
				, "tests/helpers/callback-checked-record-native-ci.mjs"
			]
		);
		assert.deepEqual(callbackCheckedRecordNativeErrorRepairRegistrationPaths
			, [
				"docs/type-surface.v1.json"
				, "tests/helpers/fin-refinement-source-history.mjs"
			]
		);
	}
);

test("C callback checked-record error history keeps its implementation edge"
	, () => {
		assert.equal(execFileSync("git", ["rev-parse"
			, `${callbackCheckedRecordNativeErrorRepairImplementation}^`]
		, { encoding: "utf8" }).trim()
		, callbackCheckedRecordNativeErrorRepairPredecessor);
		assert.deepEqual(execFileSync("git", ["diff", "--name-only"
			, callbackCheckedRecordNativeErrorRepairPredecessor
			, callbackCheckedRecordNativeErrorRepairImplementation]
		, { encoding: "utf8" }).trim().split("\n").filter(Boolean).sort()
		, [...callbackCheckedRecordNativeErrorRepairHistoricalPaths].sort());
	}
);

test("C callback checked-record error history writer refuses an unrelated checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-callback-checked-record-c-error-history-guard-"
		));
		t.after(() => rm(root, { recursive: true, force: true }));
		const env = Object.fromEntries(Object.entries(process.env)
			.filter(([key]) => !key.startsWith("GIT_")));
		const git = arguments_ => execFileSync("git", arguments_
			, { cwd: root, env, stdio: "pipe" });
		git(["init", "--quiet"]);
		git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
			, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
			, "--quiet", "-m", "unrelated"]);
		const result = spawnSync(process.execPath, [resolve(
			"scripts/update-callback-checked-record-native-error-repair-source-history.mjs"
		)], { cwd: root, env, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
