/**
 * Authenticate the combined PHP profile evidence repair.
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
	beforeDirectProofErasurePhpProfileRepairSource
	, directProofErasurePhpProfileRepairHistoryAdditions
	, directProofErasurePhpProfileRepairHistoryPath
	, directProofErasurePhpProfileRepairImplementation
	, directProofErasurePhpProfileRepairImplementationPaths
	, directProofErasurePhpProfileRepairIntegrationPaths
	, directProofErasurePhpProfileRepairPredecessor
	, reverseDirectProofErasurePhpProfileRepairUpdate
} from "./direct-proof-erasure-php-profile-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasurePhpProfileRepairHistoryPath, "utf8"));

test("PHP profile repair records its exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "direct-proof-erasure-php-profile-repair-source-v1");
	assert.equal(history.predecessorCommit
		, directProofErasurePhpProfileRepairPredecessor);
	assert.equal(history.implementationCommit
		, directProofErasurePhpProfileRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, directProofErasurePhpProfileRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, directProofErasurePhpProfileRepairIntegrationPaths);
	assert.equal(history.hostedRunId, 40978622372);
	assert.deepEqual(history.failedJobIds, [123831331710]);
	assert.deepEqual(history.failureCodes, ["ENOENT"]);
});

test("PHP profile repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			directProofErasurePhpProfileRepairImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasurePhpProfileRepairImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasurePhpProfileRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasurePhpProfileRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("PHP profile repair checks both compiled component layouts", () => {
	const installed = git(["show"
		, `${directProofErasurePhpProfileRepairImplementation}:tests/direct-proof-erasure-php-installed.test.mjs`]);
	const packages = git(["show"
		, `${directProofErasurePhpProfileRepairImplementation}:tests/helpers/direct-proof-erasure-packages.mjs`]);
	const report = git(["show"
		, `${directProofErasurePhpProfileRepairImplementation}:tests/helpers/direct-proof-erasure-php-report.mjs`]);
	assert.match(installed, /assertDirectProofErasurePhpComponents/u);
	assert.doesNotMatch(installed, /join\(outputRoot, "bundle"\)/u);
	assert.match(packages, /profiles\/native/u);
	assert.match(packages, /profiles\/php-wasm\/php-wasm/u);
	assert.match(report, /checkDirectProofErasurePhpComponentRecords/u);
});

test("PHP profile repair authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, directProofErasurePhpProfileRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("PHP profile repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasurePhpProfileRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasurePhpProfileRepairUpdate(current, forged));
});

test("PHP profile repair writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-direct-proof-erasure-php-profile-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /direct-proof-erasure-php-profile-repair-source-history-20261030\.json/u);
});
