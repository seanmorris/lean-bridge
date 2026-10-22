/**
 * Authenticate the nested checked-record regression-contract reconciliation.
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
import { sha256 } from "./source-history-digest.mjs";
import {
	sourceAtFinHistoryMilestone
} from "./source-at-fin-history-milestone.mjs";
import {
	beforeNestedCheckedRecordRegressionContractSource
	, nestedCheckedRecordRegressionContractChangedPaths
	, nestedCheckedRecordRegressionContractHistoryPath
	, nestedCheckedRecordRegressionContractImplementation
	, nestedCheckedRecordRegressionContractIntegrationPaths
	, nestedCheckedRecordRegressionContractPredecessor
	, reverseNestedCheckedRecordRegressionContractUpdate
} from "./nested-checked-record-regression-contract-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git"
	, ["show", `${revision}:${path}`]
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("nested checked-record regression history restores every source"
	, async () => {
	const record = JSON.parse(await readFile(
		nestedCheckedRecordRegressionContractHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "nested-checked-record-regression-contract-source-v1");
	assert.equal(record.predecessorCommit
		, nestedCheckedRecordRegressionContractPredecessor);
	assert.equal(record.implementationCommit
		, nestedCheckedRecordRegressionContractImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, nestedCheckedRecordRegressionContractChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, nestedCheckedRecordRegressionContractIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeNestedCheckedRecordRegressionContractSource);
		assert.equal(reverseNestedCheckedRecordRegressionContractUpdate(
			current, update), sourceAt(
			nestedCheckedRecordRegressionContractPredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, sourceAt(nestedCheckedRecordRegressionContractPredecessor
			, update.path));
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeNestedCheckedRecordRegressionContractSource);
		assert.equal(reverseNestedCheckedRecordRegressionContractUpdate(
			current, update), sourceAt(
			nestedCheckedRecordRegressionContractImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
	}
);

test("nested checked-record regression history rejects alterations"
	, async () => {
	const record = JSON.parse(await readFile(
		nestedCheckedRecordRegressionContractHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeNestedCheckedRecordRegressionContractSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseNestedCheckedRecordRegressionContractUpdate(
		current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseNestedCheckedRecordRegressionContractUpdate(
		current, update));
	}
);

test("nested checked-record regression writer refuses unrelated checkouts"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-nested-record-contract-history-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-nested-checked-record-regression-contract-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
