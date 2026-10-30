/**
 * Authenticate the systems HostNull route-versus-semantic identity repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import {
	beforeHostNullSystemsSemanticIdentityRepairSource
	, hostNullSystemsSemanticIdentityRepairHistoryAdditions
	, hostNullSystemsSemanticIdentityRepairHistoryPath
	, hostNullSystemsSemanticIdentityRepairImplementation
	, hostNullSystemsSemanticIdentityRepairImplementationPaths
	, hostNullSystemsSemanticIdentityRepairIntegrationPaths
	, hostNullSystemsSemanticIdentityRepairPredecessor
	, reverseHostNullSystemsSemanticIdentityRepairUpdate
} from "./host-null-systems-semantic-identity-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	hostNullSystemsSemanticIdentityRepairHistoryPath, "utf8"));

test("systems HostNull semantic identity repair records its exact failed run", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "host-null-systems-semantic-identity-repair-source-v1");
	assert.equal(history.predecessorCommit
		, hostNullSystemsSemanticIdentityRepairPredecessor);
	assert.equal(history.implementationCommit
		, hostNullSystemsSemanticIdentityRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, hostNullSystemsSemanticIdentityRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, hostNullSystemsSemanticIdentityRepairIntegrationPaths);
	assert.equal(history.hostedRunId, 41046161910);
	assert.equal(history.failedJobId, 124043563884);
	assert.equal(history.diagnosticArtifactId, 12974567214);
	assert.deepEqual([
		history.replayedCells, history.replayedChecks, history.replayedExecutions
	], [40, 500, 16]);
	assert.deepEqual([
		history.rawRouteIdentities, history.semanticRouteIdentities
	], [2, 1]);
	assert.equal(history.supportClaimsChanged, false);
});

test("systems HostNull semantic identity repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			hostNullSystemsSemanticIdentityRepairImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${hostNullSystemsSemanticIdentityRepairImplementation}:${update.path}`]);
		assert.equal(reverseHostNullSystemsSemanticIdentityRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeHostNullSystemsSemanticIdentityRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("systems HostNull semantic identity repair binds the hosted diagnosis", () => {
	const checker = git(["show"
		, `${hostNullSystemsSemanticIdentityRepairImplementation}:scripts/check-host-null-systems-ci.mjs`]);
	const producer = git(["show"
		, `${hostNullSystemsSemanticIdentityRepairImplementation}:tests/helpers/host-null-systems-installed.mjs`]);
	assert.match(checker, /expectedBindingIrSemanticSha256/u);
	assert.match(checker
		, /route\.bindingIrSha256\)\)\.size\s*, summary\.routes\.length/u);
	assert.match(checker
		, /route\.bindingIrSemanticSha256\)\)\.size, 1/u);
	assert.match(producer
		, /bindingIrSemanticSha256: sha256\(canonicalJson\(privateShape\(model\.bindingIr\)\)\)/u);
	assert.match(producer
		, /route\.bindingIrSha256\)\)\.size\s*, selectedRoutes\.length/u);
	assert.doesNotMatch(producer
		, /route\.bindingIrSha256\)\)\.size, 1/u);
});

test("systems HostNull semantic identity repair authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, hostNullSystemsSemanticIdentityRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("systems HostNull semantic identity repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${hostNullSystemsSemanticIdentityRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseHostNullSystemsSemanticIdentityRepairUpdate(
		current, forged));
});

test("systems HostNull semantic identity repair writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-host-null-systems-semantic-identity-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /host-null-systems-semantic-identity-repair-source-history-20261030\.json/u);
});
