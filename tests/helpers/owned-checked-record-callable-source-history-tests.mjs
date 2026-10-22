/**
 * Authenticate the owned checked-record callback/closure foundation.
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
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeOwnedCheckedRecordCallableSource
	, ownedCheckedRecordCallableAddedPaths
	, ownedCheckedRecordCallableChangedPaths
	, ownedCheckedRecordCallableHistoricalPaths
	, ownedCheckedRecordCallableHistoryPath
	, ownedCheckedRecordCallableImplementation
	, ownedCheckedRecordCallablePredecessor
	, ownedCheckedRecordCallableRegistrationPaths
	, reverseOwnedCheckedRecordCallableUpdate
} from "./owned-checked-record-callable-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const original = path => execFileSync("git", ["show"
	, `${ownedCheckedRecordCallablePredecessor}:${path}`]
, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("owned checked-record callable history restores every source and pointer"
	, async () => {
		const record = JSON.parse(await readFile(
			ownedCheckedRecordCallableHistoryPath, "utf8"
		));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "owned-checked-record-callable-source-v1");
		assert.equal(record.predecessorCommit
			, ownedCheckedRecordCallablePredecessor);
		assert.equal(record.implementationCommit
			, ownedCheckedRecordCallableImplementation);
		assert.deepEqual(record.updates.map(item => item.path)
			, ownedCheckedRecordCallableChangedPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, ownedCheckedRecordCallableAddedPaths);
		assert.ok(record.repairedTypeSurfacePointers > 0);
		for(const update of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
				, beforeOwnedCheckedRecordCallableSource
			);
			assert.equal(sha256(current), update.currentSha256, update.path);
			const previous = reverseOwnedCheckedRecordCallableUpdate(
				current, update
			);
			assert.equal(previous, original(update.path));
			assert.equal(beforeOwnedCheckedRecordCallableSource(
				update.path, current), previous);
			assert.equal(beforeOwnedCheckedRecordCallableSource(
				update.path, current, update.currentSha256), current);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
			assert.equal(beforeOwnedCheckedRecordCallableSource(
				update.path, `${current}unknown`), `${current}unknown`);
		}
		for(const addition of record.additions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256
			)), addition.currentSha256, addition.path);
		assert.deepEqual(ownedCheckedRecordCallableHistoricalPaths, [
			"src/abi/owned-aggregate-model.mjs"
			, "src/abi/owned-refinement-model.mjs"
			, "src/abi/refinements.mjs"
			, "src/analyze/reviewed-owned-source.mjs"
			, "src/backends/c/owned-callbacks.mjs"
			, "src/backends/native/owned-value-adapters.mjs"
			, "src/build/owned-aggregate-carriers.mjs"
			, "src/build/owned-callback-carriers.mjs"
			, "src/build/owned-refinement-carriers.mjs"
			, "tests/owned-checked-record-foundation.test.mjs"
		]);
		assert.deepEqual(ownedCheckedRecordCallableRegistrationPaths, [
			"docs/type-surface.v1.json"
			, "tests/helpers/dependent-record-constructor-authority-source-history-tests.mjs"
			, "tests/helpers/fin-refinement-source-history.mjs"
		]);
	}
);

test("owned checked-record callable history keeps its implementation edge"
	, () => {
		assert.equal(execFileSync("git", ["rev-parse"
			, `${ownedCheckedRecordCallableImplementation}^`]
		, { encoding: "utf8" }).trim()
		, ownedCheckedRecordCallablePredecessor);
		assert.deepEqual(execFileSync("git", ["diff", "--name-only"
			, ownedCheckedRecordCallablePredecessor
			, ownedCheckedRecordCallableImplementation]
		, { encoding: "utf8" }).trim().split("\n").filter(Boolean).sort()
		, [...ownedCheckedRecordCallableHistoricalPaths].sort());
	}
);

test("owned checked-record callable history rejects altered transitions"
	, async () => {
		const record = JSON.parse(await readFile(
			ownedCheckedRecordCallableHistoryPath, "utf8"
		));
		const update = structuredClone(record.updates[1]);
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeOwnedCheckedRecordCallableSource
		);
		update.currentSha256 = "0".repeat(64);
		assert.throws(() => reverseOwnedCheckedRecordCallableUpdate(
			current, update));
		update.currentSha256 = sha256(current);
		update.path = "src/not-recorded.mjs";
		assert.throws(() => reverseOwnedCheckedRecordCallableUpdate(
			current, update));
	}
);

test("owned checked-record callable history writer refuses an unrelated checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-owned-checked-callable-history-guard-"
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
			"scripts/update-owned-checked-record-callable-source-history.mjs"
		)], { cwd: root, env, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
