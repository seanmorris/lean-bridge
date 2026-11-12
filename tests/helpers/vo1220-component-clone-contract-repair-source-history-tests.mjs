/**
 * Authenticate the component clone-lifetime contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
	beforeVo1220ComponentCloneContractRepairSource
	, reverseVo1220ComponentCloneContractRepairUpdate
	, vo1220ComponentCloneContractRepairAddedPaths
	, vo1220ComponentCloneContractRepairHistoryPath
	, vo1220ComponentCloneContractRepairImplementation
	, vo1220ComponentCloneContractRepairImplementationPaths
	, vo1220ComponentCloneContractRepairIntegrationPaths
	, vo1220ComponentCloneContractRepairNormalizationPaths
	, vo1220ComponentCloneContractRepairPredecessor
} from "./vo1220-component-clone-contract-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	vo1220ComponentCloneContractRepairHistoryPath, "utf8"));

test("component clone contract repair records the exact hosted failure", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "vo1220-component-clone-contract-repair-v1");
	assert.equal(history.predecessorCommit
		, vo1220ComponentCloneContractRepairPredecessor);
	assert.equal(history.implementationCommit
		, vo1220ComponentCloneContractRepairImplementation);
	assert.deepEqual(history.hostedFailure, {
		run: 43298549752, job: 131463236381, test: 16
		, conclusion: "failure"
		, candidate: vo1220ComponentCloneContractRepairPredecessor
	});
	assert.deepEqual(history.review, {
		pullRequest: 10, comment: 4555997123, severity: "high"
		, commit: vo1220ComponentCloneContractRepairPredecessor
	});
	assert.deepEqual(history.localValidation, {
		releaseAuthorization: { passed: 24, failed: 0 }
		, scopedLint: "passed"
	});
	assert.equal(history.remainingMismatches, 0);
	assert.deepEqual(history.updates.map(update => update.path)
		, vo1220ComponentCloneContractRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(update => update.path)
		, vo1220ComponentCloneContractRepairIntegrationPaths);
});

test("component clone contract names the actual storage lifetime", () => {
	const previous = sourceAt(vo1220ComponentCloneContractRepairPredecessor
		, "tests/reproducibility-gate.test.mjs");
	const current = sourceAt(vo1220ComponentCloneContractRepairImplementation
		, "tests/reproducibility-gate.test.mjs");
	assert.match(previous, /reuse immutable Git objects without duplicating/u);
	assert.match(previous
		, /"--local", "--no-checkout"/u);
	assert.match(current
		, /use storage-safe Git object reuse for their source lifetimes/u);
	assert.match(current
		, /"--local", "--dissociate", "--no-checkout"/u);
});

test("component clone contract repair reverses every transition", async () => {
	const history = await record();
	for(const update of history.updates)
	{
		const current = sourceAt(vo1220ComponentCloneContractRepairImplementation
			, update.path);
		const previous = sourceAt(vo1220ComponentCloneContractRepairPredecessor
			, update.path);
		assert.equal(reverseVo1220ComponentCloneContractRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeVo1220ComponentCloneContractRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = sourceAt(vo1220ComponentCloneContractRepairImplementation
			, update.path);
		assert.equal(reverseVo1220ComponentCloneContractRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of vo1220ComponentCloneContractRepairNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("component clone contract history rejects forgeries and duplicate writers", async t => {
	const history = await record();
	assert.deepEqual(history.additions.map(addition => addition.path)
		, vo1220ComponentCloneContractRepairAddedPaths);
	for(const addition of history.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = history.updates[0];
	const current = sourceAt(vo1220ComponentCloneContractRepairImplementation
		, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseVo1220ComponentCloneContractRepairUpdate(current, forged));
	const root = await mkdtemp(`${tmpdir()}/vo1220-component-clone-contract-`);
	t.after(() => rm(root, { recursive: true }));
	const duplicate = spawnSync(process.execPath, [resolve(
		"scripts/update-vo1220-component-clone-contract-repair-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(duplicate.status, 0);
	assert.equal(duplicate.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
