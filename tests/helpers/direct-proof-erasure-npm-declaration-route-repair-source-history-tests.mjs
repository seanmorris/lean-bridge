/**
 * Authenticate the direct proof-erasure npm declaration route-name repair.
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
	beforeDirectProofErasureNpmDeclarationRouteRepairSource
	, directProofErasureNpmDeclarationRouteRepairHistoryAdditions
	, directProofErasureNpmDeclarationRouteRepairHistoryPath
	, directProofErasureNpmDeclarationRouteRepairImplementation
	, directProofErasureNpmDeclarationRouteRepairImplementationPaths
	, directProofErasureNpmDeclarationRouteRepairIntegrationPaths
	, directProofErasureNpmDeclarationRouteRepairPredecessor
	, reverseDirectProofErasureNpmDeclarationRouteRepairUpdate
} from "./direct-proof-erasure-npm-declaration-route-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureNpmDeclarationRouteRepairHistoryPath, "utf8"));

test("npm declaration route repair records its exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "direct-proof-erasure-npm-declaration-route-repair-source-v1");
	assert.equal(history.predecessorCommit
		, directProofErasureNpmDeclarationRouteRepairPredecessor);
	assert.equal(history.implementationCommit
		, directProofErasureNpmDeclarationRouteRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, directProofErasureNpmDeclarationRouteRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, directProofErasureNpmDeclarationRouteRepairIntegrationPaths);
	assert.equal(history.hostedRunId, 40992970885);
	assert.equal(history.failedJobId, 123859733407);
	assert.equal(history.failureCode, "ERR_ASSERTION");
});

test("npm declaration route repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			directProofErasureNpmDeclarationRouteRepairImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureNpmDeclarationRouteRepairImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureNpmDeclarationRouteRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasureNpmDeclarationRouteRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("npm declaration route repair preserves both author-route names", () => {
	const regression = git(["show"
		, `${directProofErasureNpmDeclarationRouteRepairImplementation}:tests/direct-proof-erasure-npm-installed.test.mjs`]);
	assert.match(regression
		, /route === "ordinary" \? "arg0" : "value"/u);
	assert.match(regression
		, /export declare function keep\\\\\(\$\{parameter\}: number\\\\\): number;/u);
});

test("npm declaration route repair authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, directProofErasureNpmDeclarationRouteRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("npm declaration route repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureNpmDeclarationRouteRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasureNpmDeclarationRouteRepairUpdate(current, forged));
});

test("npm declaration route repair writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-direct-proof-erasure-npm-declaration-route-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /direct-proof-erasure-npm-declaration-route-repair-source-history-20261030\.json/u);
});
