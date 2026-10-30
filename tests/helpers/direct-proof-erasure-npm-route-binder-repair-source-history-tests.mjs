/**
 * Authenticate the direct proof-erasure npm route-binder repair.
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
	beforeDirectProofErasureNpmRouteBinderRepairSource
	, directProofErasureNpmRouteBinderRepairHistoryAdditions
	, directProofErasureNpmRouteBinderRepairHistoryPath
	, directProofErasureNpmRouteBinderRepairImplementation
	, directProofErasureNpmRouteBinderRepairImplementationPaths
	, directProofErasureNpmRouteBinderRepairIntegrationPaths
	, directProofErasureNpmRouteBinderRepairPredecessor
	, reverseDirectProofErasureNpmRouteBinderRepairUpdate
} from "./direct-proof-erasure-npm-route-binder-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureNpmRouteBinderRepairHistoryPath, "utf8"));

test("npm route-binder repair records its exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "direct-proof-erasure-npm-route-binder-repair-source-v1");
	assert.equal(history.predecessorCommit
		, directProofErasureNpmRouteBinderRepairPredecessor);
	assert.equal(history.implementationCommit
		, directProofErasureNpmRouteBinderRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, directProofErasureNpmRouteBinderRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, directProofErasureNpmRouteBinderRepairIntegrationPaths);
	assert.equal(history.hostedRunId, 40986444238);
	assert.equal(history.failedJobId, 123838738073);
	assert.equal(history.failureCode, "ERR_ASSERTION");
});

test("npm route-binder repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			directProofErasureNpmRouteBinderRepairImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureNpmRouteBinderRepairImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureNpmRouteBinderRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasureNpmRouteBinderRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("npm route-binder repair preserves each route's exact name", () => {
	const packages = git(["show"
		, `${directProofErasureNpmRouteBinderRepairImplementation}:tests/helpers/direct-proof-erasure-packages.mjs`]);
	assert.match(packages
		, /directProofErasureModule, \["arg0", "value"\]/u);
	assert.match(packages
		, /const parameterName = declaration\.parameters\[0\]\.name/u);
	assert.match(packages
		, /name: parameterName, leanType: "_root_\.UInt32"/u);
});

test("npm route-binder repair authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, directProofErasureNpmRouteBinderRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("npm route-binder repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureNpmRouteBinderRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasureNpmRouteBinderRepairUpdate(current, forged));
});

test("npm route-binder repair writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-direct-proof-erasure-npm-route-binder-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /direct-proof-erasure-npm-route-binder-repair-source-history-20261030\.json/u);
});
