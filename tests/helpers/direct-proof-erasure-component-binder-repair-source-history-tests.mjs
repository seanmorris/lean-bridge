/**
 * Authenticate the component-side source-binder repair for erased proofs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforeDirectProofErasureComponentBinderRepairSource
	, directProofErasureComponentBinderRepairHistoryAdditions
	, directProofErasureComponentBinderRepairHistoryPath
	, directProofErasureComponentBinderRepairImplementation
	, directProofErasureComponentBinderRepairImplementationPaths
	, directProofErasureComponentBinderRepairIntegrationPaths
	, directProofErasureComponentBinderRepairPredecessor
	, reverseDirectProofErasureComponentBinderRepairUpdate
} from "./direct-proof-erasure-component-binder-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureComponentBinderRepairHistoryPath, "utf8"));

test("component binder repair records its exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "direct-proof-erasure-component-binder-repair-source-v1");
	assert.equal(history.predecessorCommit
		, directProofErasureComponentBinderRepairPredecessor);
	assert.equal(history.implementationCommit
		, directProofErasureComponentBinderRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, directProofErasureComponentBinderRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, directProofErasureComponentBinderRepairIntegrationPaths);
	assert.equal(history.hostedRunId, 40978622372);
	assert.equal(history.failedJobId, 123813096267);
	assert.equal(history.failureCode, "invalid-elaborated-metadata");
});

test("component binder repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			directProofErasureComponentBinderRepairImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureComponentBinderRepairImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureComponentBinderRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasureComponentBinderRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("component binder repair preserves the source index through conversion", () => {
	const extractor = git(["show"
		, `${directProofErasureComponentBinderRepairImplementation}:src/analyze/NativeExports.lean`]);
	const regression = git(["show"
		, `${directProofErasureComponentBinderRepairImplementation}:tests/direct-proof-erasure.test.mjs`]);
	assert.match(extractor
		, /\("sourceIndex", ← ofExcept <\| parameter\.getObjVal\? "sourceIndex"\)/u);
	assert.match(regression
		, /component conversion retains each runtime binder's Lean source index/u);
});

test("component binder repair authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, directProofErasureComponentBinderRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("component binder repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureComponentBinderRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasureComponentBinderRepairUpdate(current, forged));
});

test("component binder repair writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-direct-proof-erasure-component-binder-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /direct-proof-erasure-component-binder-repair-source-history-20261030\.json/u);
});
