/**
 * Authenticate the complete proof-erasure audit entry points.
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
	beforeDirectProofErasureCompleteEntrypointsSource
	, directProofErasureCompleteEntrypointsHistoryAdditions
	, directProofErasureCompleteEntrypointsHistoryPath
	, directProofErasureCompleteEntrypointsImplementation
	, directProofErasureCompleteEntrypointsImplementationAdditions
	, directProofErasureCompleteEntrypointsImplementationPaths
	, directProofErasureCompleteEntrypointsIntegrationPaths
	, directProofErasureCompleteEntrypointsPredecessor
	, reverseDirectProofErasureCompleteEntrypointsUpdate
} from "./direct-proof-erasure-complete-entrypoints-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureCompleteEntrypointsHistoryPath, "utf8"));

test("proof-erasure completion entry points record their exact transaction"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "direct-proof-erasure-complete-entrypoints-source-v1");
		assert.equal(history.predecessorCommit
			, directProofErasureCompleteEntrypointsPredecessor);
		assert.equal(history.implementationCommit
			, directProofErasureCompleteEntrypointsImplementation);
		assert.deepEqual(history.updates.map(item => item.path)
			, directProofErasureCompleteEntrypointsImplementationPaths);
		assert.deepEqual(history.implementationAdditions.map(item => item.path)
			, directProofErasureCompleteEntrypointsImplementationAdditions);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, directProofErasureCompleteEntrypointsIntegrationPaths);
		assert.equal(history.auditEntrypoints, 2);
		assert.equal(history.hostedLanes, 10);
		assert.equal(history.cells, 204);
		assert.deepEqual(history.currentSourcePaths, []);
	}
);

test("proof-erasure completion entry points reverse every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			directProofErasureCompleteEntrypointsImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureCompleteEntrypointsImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureCompleteEntrypointsUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasureCompleteEntrypointsSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("proof-erasure completion entry points are workflow-owned", () => {
	const workflow = git(["show"
		, `${directProofErasureCompleteEntrypointsImplementation}:.github/workflows/direct-proof-erasure-complete.yml`]);
	const promotion = git(["show"
		, `${directProofErasureCompleteEntrypointsImplementation}:tests/helpers/direct-proof-erasure-complete-promotion.mjs`]);
	for(const path of directProofErasureCompleteEntrypointsImplementationAdditions)
	{
		assert.ok(workflow.includes(path), path);
		assert.ok(promotion.includes(path), path);
		assert.match(git(["show"
			, `${directProofErasureCompleteEntrypointsImplementation}:${path}`])
			, /node:test/u, path);
	}
});

test("proof-erasure entry-point history authenticates additions", async () => {
	const history = await record();
	for(const addition of history.implementationAdditions)
		assert.equal(addition.sha256, sha256(git(["show"
			, `${directProofErasureCompleteEntrypointsImplementation}:${addition.path}`]))
		, addition.path);
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, directProofErasureCompleteEntrypointsHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("proof-erasure entry-point history rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureCompleteEntrypointsImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.yml" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasureCompleteEntrypointsUpdate(current, forged));
});

test("proof-erasure entry-point history writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-direct-proof-erasure-complete-entrypoints-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /direct-proof-erasure-complete-entrypoints-source-history-20261029\.json/u);
});
