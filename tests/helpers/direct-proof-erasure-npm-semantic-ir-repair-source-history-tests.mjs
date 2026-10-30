/**
 * Authenticate the direct proof-erasure npm semantic Binding IR repair.
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
	beforeDirectProofErasureNpmSemanticIrRepairSource
	, directProofErasureNpmSemanticIrRepairHistoryAdditions
	, directProofErasureNpmSemanticIrRepairHistoryPath
	, directProofErasureNpmSemanticIrRepairImplementation
	, directProofErasureNpmSemanticIrRepairImplementationPaths
	, directProofErasureNpmSemanticIrRepairIntegrationPaths
	, directProofErasureNpmSemanticIrRepairPredecessor
	, reverseDirectProofErasureNpmSemanticIrRepairUpdate
} from "./direct-proof-erasure-npm-semantic-ir-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureNpmSemanticIrRepairHistoryPath, "utf8"));

test("npm semantic-IR repair records its exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "direct-proof-erasure-npm-semantic-ir-repair-source-v1");
	assert.equal(history.predecessorCommit
		, directProofErasureNpmSemanticIrRepairPredecessor);
	assert.equal(history.implementationCommit
		, directProofErasureNpmSemanticIrRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, directProofErasureNpmSemanticIrRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, directProofErasureNpmSemanticIrRepairIntegrationPaths);
	assert.equal(history.hostedRunId, 41006389958);
	assert.equal(history.failedJobId, 123902408087);
	assert.equal(history.artifactId, 12956701954);
	assert.equal(history.packageExecutionPassed, true);
	assert.equal(history.missingField, "bindingIrSha256");
});

test("npm semantic-IR repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			directProofErasureNpmSemanticIrRepairImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureNpmSemanticIrRepairImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureNpmSemanticIrRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasureNpmSemanticIrRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("npm semantic-IR repair binds producer, receipt and retained IR", () => {
	const installed = git(["show"
		, `${directProofErasureNpmSemanticIrRepairImplementation}:tests/direct-proof-erasure-npm-installed.test.mjs`]);
	const report = git(["show"
		, `${directProofErasureNpmSemanticIrRepairImplementation}:tests/helpers/direct-proof-erasure-npm-report.mjs`]);
	const tests = git(["show"
		, `${directProofErasureNpmSemanticIrRepairImplementation}:tests/helpers/direct-proof-erasure-npm-report-tests.mjs`]);
	assert.match(installed
		, /release\.report\.bindingIrSha256, hashBindingIr\(bindingIr\)/u);
	assert.match(installed
		, /bindingIrSha256: release\.report\.bindingIrSha256/u);
	assert.match(report, /fact\.bindingIrSha256, hashBindingIr\(ir\)/u);
	assert.match(report, /validateDirectProofErasureNpmBuildFact/u);
	assert.match(tests, /key !== "bindingIrSha256"/u);
	assert.match(tests, /unexpected: true/u);
});

test("npm semantic-IR repair authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, directProofErasureNpmSemanticIrRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("npm semantic-IR repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureNpmSemanticIrRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasureNpmSemanticIrRepairUpdate(current, forged));
});

test("npm semantic-IR repair writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-direct-proof-erasure-npm-semantic-ir-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /direct-proof-erasure-npm-semantic-ir-repair-source-history-20261030\.json/u);
});
