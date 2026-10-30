/**
 * Authenticate the direct proof-erasure PHP receipt-identity repair.
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
	beforeDirectProofErasurePhpReceiptIdentityRepairSource
	, directProofErasurePhpReceiptIdentityRepairHistoryAdditions
	, directProofErasurePhpReceiptIdentityRepairHistoryPath
	, directProofErasurePhpReceiptIdentityRepairImplementation
	, directProofErasurePhpReceiptIdentityRepairImplementationPaths
	, directProofErasurePhpReceiptIdentityRepairIntegrationPaths
	, directProofErasurePhpReceiptIdentityRepairPredecessor
	, reverseDirectProofErasurePhpReceiptIdentityRepairUpdate
} from "./direct-proof-erasure-php-receipt-identity-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasurePhpReceiptIdentityRepairHistoryPath, "utf8"));

test("PHP receipt-identity repair records its exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "direct-proof-erasure-php-receipt-identity-repair-source-v1");
	assert.equal(history.predecessorCommit
		, directProofErasurePhpReceiptIdentityRepairPredecessor);
	assert.equal(history.implementationCommit
		, directProofErasurePhpReceiptIdentityRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, directProofErasurePhpReceiptIdentityRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, directProofErasurePhpReceiptIdentityRepairIntegrationPaths);
	assert.equal(history.hostedRunId, 40986444238);
	assert.equal(history.failedJobId, 123853047291);
	assert.equal(history.failureCode, "ERR_ASSERTION");
});

test("PHP receipt-identity repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			directProofErasurePhpReceiptIdentityRepairImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasurePhpReceiptIdentityRepairImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasurePhpReceiptIdentityRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasurePhpReceiptIdentityRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("PHP receipt-identity repair distinguishes both identity domains", () => {
	const packages = git(["show"
		, `${directProofErasurePhpReceiptIdentityRepairImplementation}:tests/helpers/direct-proof-erasure-packages.mjs`]);
	const regression = git(["show"
		, `${directProofErasurePhpReceiptIdentityRepairImplementation}:tests/direct-proof-erasure.test.mjs`]);
	assert.match(packages, /profile === "native-library-v1"/u);
	assert.match(packages, /`lean:\$\{directProofErasureExport\}`/u);
	assert.match(regression
		, /native and PHP-Wasm receipts retain their exact declaration domains/u);
});

test("PHP receipt-identity repair authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, directProofErasurePhpReceiptIdentityRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("PHP receipt-identity repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasurePhpReceiptIdentityRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasurePhpReceiptIdentityRepairUpdate(current, forged));
});

test("PHP receipt-identity repair writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-direct-proof-erasure-php-receipt-identity-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /direct-proof-erasure-php-receipt-identity-repair-source-history-20261030\.json/u);
});
