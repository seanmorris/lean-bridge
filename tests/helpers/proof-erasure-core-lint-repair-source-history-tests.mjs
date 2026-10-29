/**
 * Authenticate the proof-erasure Core lint repair.
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
	beforeProofErasureCoreLintRepairSource
	, proofErasureCoreLintRepairHistoryAdditions
	, proofErasureCoreLintRepairHistoryPath
	, proofErasureCoreLintRepairImplementation
	, proofErasureCoreLintRepairImplementationPaths
	, proofErasureCoreLintRepairIntegrationPaths
	, proofErasureCoreLintRepairPredecessor
	, reverseProofErasureCoreLintRepairUpdate
} from "./proof-erasure-core-lint-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	proofErasureCoreLintRepairHistoryPath, "utf8"));

test("proof-erasure Core lint repair records its exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "proof-erasure-core-lint-repair-source-v1");
	assert.equal(history.predecessorCommit
		, proofErasureCoreLintRepairPredecessor);
	assert.equal(history.implementationCommit
		, proofErasureCoreLintRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, proofErasureCoreLintRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, proofErasureCoreLintRepairIntegrationPaths);
	assert.equal(history.repairedLintErrors, 10);
	assert.deepEqual(history.currentSourcePaths, []);
});

test("proof-erasure Core lint repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			proofErasureCoreLintRepairImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${proofErasureCoreLintRepairImplementation}:${update.path}`]);
		assert.equal(reverseProofErasureCoreLintRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeProofErasureCoreLintRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("proof-erasure Core lint repair preserves behavior", async () => {
	const complete = git(["show"
		, `${proofErasureCoreLintRepairImplementation}`
			+ ":tests/helpers/direct-proof-erasure-complete-ci-tests.mjs"]);
	const receipt = git(["show"
		, `${proofErasureCoreLintRepairImplementation}`
			+ ":tests/helpers/direct-proof-erasure-matrix-receipt-tests.mjs"]);
	assert.match(complete, /focused proof-erasure producers retain all ten/u);
	assert.match(receipt, /authenticates all twenty same-run reports/u);
	assert.match(receipt, /rejects absent and substituted reports/u);
});

test("proof-erasure Core lint repair authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, proofErasureCoreLintRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("proof-erasure Core lint repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${proofErasureCoreLintRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseProofErasureCoreLintRepairUpdate(
		current, forged));
});

test("proof-erasure Core lint repair writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-proof-erasure-core-lint-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /proof-erasure-core-lint-repair-source-history-20261029\.json/u);
});
