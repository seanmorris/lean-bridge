/**
 * Authenticate the direct proof-erasure PHP profile-contract repair.
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
	beforeDirectProofErasurePhpProfileContractRepairSource
	, directProofErasurePhpProfileContractRepairHistoryAdditions
	, directProofErasurePhpProfileContractRepairHistoryPath
	, directProofErasurePhpProfileContractRepairImplementation
	, directProofErasurePhpProfileContractRepairImplementationPaths
	, directProofErasurePhpProfileContractRepairIntegrationPaths
	, directProofErasurePhpProfileContractRepairPredecessor
	, reverseDirectProofErasurePhpProfileContractRepairUpdate
} from "./direct-proof-erasure-php-profile-contract-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasurePhpProfileContractRepairHistoryPath, "utf8"));

test("PHP profile-contract repair records its exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "direct-proof-erasure-php-profile-contract-repair-source-v1");
	assert.equal(history.predecessorCommit
		, directProofErasurePhpProfileContractRepairPredecessor);
	assert.equal(history.implementationCommit
		, directProofErasurePhpProfileContractRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, directProofErasurePhpProfileContractRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, directProofErasurePhpProfileContractRepairIntegrationPaths);
	assert.equal(history.hostedRunId, 40992970885);
	assert.equal(history.failedJobId, 123872388659);
	assert.equal(history.failureCode, "ERR_ASSERTION");
});

test("PHP profile-contract repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			directProofErasurePhpProfileContractRepairImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasurePhpProfileContractRepairImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasurePhpProfileContractRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasurePhpProfileContractRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("PHP profile-contract repair preserves each exact public API", () => {
	const report = git(["show"
		, `${directProofErasurePhpProfileContractRepairImplementation}:tests/helpers/direct-proof-erasure-php-report.mjs`]);
	const installed = git(["show"
		, `${directProofErasurePhpProfileContractRepairImplementation}:tests/direct-proof-erasure-php-installed.test.mjs`]);
	assert.match(report, /route === "ordinary" \? "arg0" : "value"/u);
	assert.match(report
		, /profile === "php-native" \? "int" : "\\\\Brick\\\\Math\\\\BigInteger"/u);
	assert.match(report, /keep\(\$input\)->isEqualTo\(\$input\)/u);
	assert.match(installed, /profile: "php-wasm"/u);
	assert.match(installed, /directProofErasurePhpReturnType\(profile\)/u);
});

test("PHP profile-contract repair authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, directProofErasurePhpProfileContractRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("PHP profile-contract repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasurePhpProfileContractRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasurePhpProfileContractRepairUpdate(current, forged));
});

test("PHP profile-contract repair writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-direct-proof-erasure-php-profile-contract-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /direct-proof-erasure-php-profile-contract-repair-source-history-20261030\.json/u);
});
