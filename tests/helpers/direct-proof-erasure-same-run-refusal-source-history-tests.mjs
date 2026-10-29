/**
 * Authenticate the same-run fresh-Lean proof-refusal source history.
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
	beforeDirectProofErasureSameRunRefusalSource
	, directProofErasureSameRunRefusalHistoryAdditions
	, directProofErasureSameRunRefusalHistoryPath
	, directProofErasureSameRunRefusalImplementation
	, directProofErasureSameRunRefusalImplementationPaths
	, directProofErasureSameRunRefusalIntegrationPaths
	, directProofErasureSameRunRefusalPredecessor
	, reverseDirectProofErasureSameRunRefusalUpdate
} from "./direct-proof-erasure-same-run-refusal-source-history.mjs";
import { beforeFinRefinementSource }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureSameRunRefusalHistoryPath, "utf8"
));

test("same-run proof-refusal history records the exact implementation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "direct-proof-erasure-same-run-refusal-source-v1");
	assert.equal(value.predecessorCommit
		, directProofErasureSameRunRefusalPredecessor);
	assert.equal(value.implementationCommit
		, directProofErasureSameRunRefusalImplementation);
	assert.deepEqual(value.updates.map(update => update.path).sort()
		, [...directProofErasureSameRunRefusalImplementationPaths].sort());
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, directProofErasureSameRunRefusalIntegrationPaths);
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, directProofErasureSameRunRefusalHistoryAdditions);
});

test("same-run proof-refusal history reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			directProofErasureSameRunRefusalImplementation, update.path
		), update), true, update.path);
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureSameRunRefusalImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureSameRunRefusalUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasureSameRunRefusalSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("same-run proof-refusal history authenticates its new controls", async () => {
	for(const addition of (await record()).historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
});

test("same-run proof-refusal history rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureSameRunRefusalImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.yml" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasureSameRunRefusalUpdate(current, forged));
});

test("same-run proof-refusal history writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-direct-proof-erasure-same-run-refusal-source-history.mjs"
	], { cwd: new URL("../../", import.meta.url), encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /direct-proof-erasure-same-run-refusal-source-history-20261029\.json/u);
});
