/**
 * Authenticate the managed diagnostics and WIT local-name repairs.
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
	beforeDirectProofErasureManagedWitRepairSource
	, directProofErasureManagedWitRepairHistoryAdditions
	, directProofErasureManagedWitRepairHistoryPath
	, directProofErasureManagedWitRepairImplementation
	, directProofErasureManagedWitRepairImplementationPaths
	, directProofErasureManagedWitRepairIntegrationPaths
	, directProofErasureManagedWitRepairPredecessor
	, reverseDirectProofErasureManagedWitRepairUpdate
} from "./direct-proof-erasure-managed-wit-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureManagedWitRepairHistoryPath, "utf8"));

test("managed and WIT repair records its exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "direct-proof-erasure-managed-wit-repair-source-v1");
	assert.equal(history.predecessorCommit
		, directProofErasureManagedWitRepairPredecessor);
	assert.equal(history.implementationCommit
		, directProofErasureManagedWitRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, directProofErasureManagedWitRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, directProofErasureManagedWitRepairIntegrationPaths);
	assert.equal(history.hostedRunId, 40978622372);
	assert.deepEqual(history.failedJobIds
		, [123830083085, 123830083116, 123830083150]);
	assert.deepEqual(history.failureCodes
		, ["build-command-failed", "ERR_ASSERTION"]);
});

test("managed and WIT repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			directProofErasureManagedWitRepairImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureManagedWitRepairImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureManagedWitRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasureManagedWitRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("managed and WIT repair closes all three observed failures", () => {
	const wit = git(["show"
		, `${directProofErasureManagedWitRepairImplementation}:src/backends/wit/copied-host.mjs`]);
	const managed = git(["show"
		, `${directProofErasureManagedWitRepairImplementation}:tests/helpers/direct-proof-erasure-managed-report.mjs`]);
	const installed = git(["show"
		, `${directProofErasureManagedWitRepairImplementation}:tests/direct-proof-erasure-managed-installed.test.mjs`]);
	assert.match(wit, /while\(used\.has\(candidate\)\)/u);
	assert.match(managed, /no parameter with name '_before' found/u);
	assert.match(installed
		, /directProofErasureManagedFailureDiagnostic\(error\)/u);
});

test("managed and WIT repair authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, directProofErasureManagedWitRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("managed and WIT repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureManagedWitRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasureManagedWitRepairUpdate(current, forged));
});

test("managed and WIT repair writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-direct-proof-erasure-managed-wit-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /direct-proof-erasure-managed-wit-repair-source-history-20261030\.json/u);
});
