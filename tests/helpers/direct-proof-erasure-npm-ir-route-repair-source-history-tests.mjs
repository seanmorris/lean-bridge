/**
 * Authenticate the direct proof-erasure npm author-route IR repair.
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
	beforeDirectProofErasureNpmIrRouteRepairSource
	, directProofErasureNpmIrRouteRepairHistoryAdditions
	, directProofErasureNpmIrRouteRepairHistoryPath
	, directProofErasureNpmIrRouteRepairImplementation
	, directProofErasureNpmIrRouteRepairImplementationPaths
	, directProofErasureNpmIrRouteRepairIntegrationPaths
	, directProofErasureNpmIrRouteRepairPredecessor
	, reverseDirectProofErasureNpmIrRouteRepairUpdate
} from "./direct-proof-erasure-npm-ir-route-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureNpmIrRouteRepairHistoryPath, "utf8"));

test("npm IR-route repair records its exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "direct-proof-erasure-npm-ir-route-repair-source-v1");
	assert.equal(history.predecessorCommit
		, directProofErasureNpmIrRouteRepairPredecessor);
	assert.equal(history.implementationCommit
		, directProofErasureNpmIrRouteRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, directProofErasureNpmIrRouteRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, directProofErasureNpmIrRouteRepairIntegrationPaths);
	assert.equal(history.hostedRunId, 41006389958);
	assert.equal(history.failedJobId, 123902408087);
	assert.equal(history.artifactId, 12956701954);
	assert.equal(history.replayedArtifact, true);
	assert.equal(history.ordinaryParameter, "arg0");
	assert.equal(history.reviewedParameter, "value");
});

test("npm IR-route repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			directProofErasureNpmIrRouteRepairImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureNpmIrRouteRepairImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureNpmIrRouteRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasureNpmIrRouteRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("npm IR-route repair shares one exact author-route mapping", () => {
	const report = git(["show"
		, `${directProofErasureNpmIrRouteRepairImplementation}:tests/helpers/direct-proof-erasure-npm-report.mjs`]);
	const tests = git(["show"
		, `${directProofErasureNpmIrRouteRepairImplementation}:tests/helpers/direct-proof-erasure-npm-report-tests.mjs`]);
	assert.match(report, /directProofErasureNpmParameterName/u);
	assert.match(report, /route === "ordinary" \? "arg0" : "value"/u);
	assert.match(report, /assertDirectProofErasureIr\(/u);
	assert.match(report, /keep _root_\.True\.intro \$\{parameter\}/u);
	assert.match(tests, /directProofErasureNpmParameterName\("ordinary"\), "arg0"/u);
	assert.match(tests, /directProofErasureNpmParameterName\("unknown"\)/u);
});

test("npm IR-route repair authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, directProofErasureNpmIrRouteRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("npm IR-route repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureNpmIrRouteRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasureNpmIrRouteRepairUpdate(current, forged));
});

test("npm IR-route repair writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-direct-proof-erasure-npm-ir-route-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /direct-proof-erasure-npm-ir-route-repair-source-history-20261030\.json/u);
});
