/**
 * Authenticate the direct proof-erasure PHP fact-order repair.
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
	beforeDirectProofErasurePhpFactOrderRepairSource
	, directProofErasurePhpFactOrderRepairHistoryAdditions
	, directProofErasurePhpFactOrderRepairHistoryPath
	, directProofErasurePhpFactOrderRepairImplementation
	, directProofErasurePhpFactOrderRepairImplementationPaths
	, directProofErasurePhpFactOrderRepairIntegrationPaths
	, directProofErasurePhpFactOrderRepairPredecessor
	, reverseDirectProofErasurePhpFactOrderRepairUpdate
} from "./direct-proof-erasure-php-fact-order-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasurePhpFactOrderRepairHistoryPath, "utf8"));

test("PHP fact-order repair records its exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "direct-proof-erasure-php-fact-order-repair-source-v1");
	assert.equal(history.predecessorCommit
		, directProofErasurePhpFactOrderRepairPredecessor);
	assert.equal(history.implementationCommit
		, directProofErasurePhpFactOrderRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, directProofErasurePhpFactOrderRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, directProofErasurePhpFactOrderRepairIntegrationPaths);
	assert.equal(history.hostedRunId, 41000680672);
	assert.equal(history.failedJobId, 123897464491);
	assert.equal(history.failureCode, "ERR_ASSERTION");
});

test("PHP fact-order repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			directProofErasurePhpFactOrderRepairImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasurePhpFactOrderRepairImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasurePhpFactOrderRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasurePhpFactOrderRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("PHP fact-order repair validates an exact unordered key set", () => {
	const report = git(["show"
		, `${directProofErasurePhpFactOrderRepairImplementation}:tests/helpers/direct-proof-erasure-php-report.mjs`]);
	const tests = git(["show"
		, `${directProofErasurePhpFactOrderRepairImplementation}:tests/helpers/direct-proof-erasure-php-tests.mjs`]);
	assert.match(report, /\]\.sort\(\);/u);
	assert.match(report, /validateDirectProofErasurePhpBuildFact/u);
	assert.match(report, /Object\.keys\(fact\)\.sort\(\), factKeys/u);
	assert.match(tests, /Object\.entries\(fact\)\.reverse\(\)/u);
	assert.match(tests, /unexpected: true/u);
});

test("PHP fact-order repair authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, directProofErasurePhpFactOrderRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("PHP fact-order repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasurePhpFactOrderRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasurePhpFactOrderRepairUpdate(current, forged));
});

test("PHP fact-order repair writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-direct-proof-erasure-php-fact-order-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /direct-proof-erasure-php-fact-order-repair-source-history-20261030\.json/u);
});
