/**
 * Authenticate the dependent checked-record constructor-authority repair.
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
	beforeDependentRecordConstructorAuthoritySource
	, dependentRecordConstructorAuthorityAddedPaths
	, dependentRecordConstructorAuthorityHistoricalPaths
	, dependentRecordConstructorAuthorityHistoryPath
	, dependentRecordConstructorAuthorityImplementation
	, dependentRecordConstructorAuthorityIntegrationPaths
	, dependentRecordConstructorAuthorityPredecessor
	, reverseDependentRecordConstructorAuthorityUpdate
} from "./dependent-record-constructor-authority-source-history.mjs";
import {
	beforeFinRefinementSource, exactTypeSurfaceSourceHistoryStatistics
	, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("type-surface history streams linear, integration and merge evidence", () => {
	const statistics = exactTypeSurfaceSourceHistoryStatistics();
	assert.ok(statistics.linearTransitions > 400);
	assert.equal(statistics.branchedTransitions, 1);
});

test("dependent-record constructor authority restores every exact source"
	, async () => {
		const record = JSON.parse(await readFile(
			dependentRecordConstructorAuthorityHistoryPath, "utf8"
		));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "dependent-record-constructor-authority-source-v1");
		assert.equal(record.predecessorCommit
			, dependentRecordConstructorAuthorityPredecessor);
		assert.equal(record.implementationCommit
			, dependentRecordConstructorAuthorityImplementation);
		assert.deepEqual(record.updates.map(item => item.path)
			, dependentRecordConstructorAuthorityHistoricalPaths);
		assert.deepEqual(record.integrationUpdates.map(item => item.path)
			, dependentRecordConstructorAuthorityIntegrationPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, dependentRecordConstructorAuthorityAddedPaths);
		assert.ok(record.repairedTypeSurfacePointers > 0);
		for(const update of [...record.updates, ...record.integrationUpdates])
		{
			const current = await readFile(update.path, "utf8");
			const previous = reverseDependentRecordConstructorAuthorityUpdate(
				current, update
			);
			assert.equal(sha256(previous), update.previousSha256, update.path);
			assert.equal(beforeDependentRecordConstructorAuthoritySource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path)
				, update.path);
		}
		for(const addition of record.additions)
			assert.equal(sha256(await readFile(addition.path))
				, addition.currentSha256, addition.path);
	}
);

test("dependent-record constructor authority keeps its implementation edge"
	, () => {
		assert.equal(git(["rev-parse"
			, `${dependentRecordConstructorAuthorityImplementation}^`]).trim()
		, dependentRecordConstructorAuthorityPredecessor);
		assert.deepEqual(git(["diff", "--name-only"
			, dependentRecordConstructorAuthorityPredecessor
			, dependentRecordConstructorAuthorityImplementation])
			.trim().split("\n").filter(Boolean).sort()
		, [...dependentRecordConstructorAuthorityHistoricalPaths].sort());
	}
);

test("dependent-record constructor authority rejects altered transitions"
	, async () => {
		const record = JSON.parse(await readFile(
			dependentRecordConstructorAuthorityHistoryPath, "utf8"
		));
		const update = structuredClone(record.updates[0]);
		const current = await readFile(update.path, "utf8");
		update.currentSha256 = "0".repeat(64);
		assert.throws(() => reverseDependentRecordConstructorAuthorityUpdate(
			current, update
		));
		update.currentSha256 = sha256(current);
		update.path = "src/not-recorded.mjs";
		assert.throws(() => reverseDependentRecordConstructorAuthorityUpdate(
			current, update
		));
	}
);

test("dependent-record constructor authority writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "dependent-record-constructor-authority-guard-"
		));
		t.after(() => rm(root, { recursive: true, force: true }));
		const env = Object.fromEntries(Object.entries(process.env)
			.filter(([key]) => !key.startsWith("GIT_")));
		const otherGit = arguments_ => execFileSync("git", arguments_
			, { cwd: root, env, stdio: "pipe" });
		otherGit(["init", "--quiet"]);
		otherGit(["-c", "user.name=Test", "-c"
			, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
			, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
		const result = spawnSync(process.execPath, [resolve(
			"scripts/update-dependent-record-constructor-authority-source-history.mjs"
		)], { cwd: root, env, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
