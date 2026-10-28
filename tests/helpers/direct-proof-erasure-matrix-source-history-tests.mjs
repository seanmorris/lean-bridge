/**
 * Authenticate the direct proof-erasure matrix closure model and central
 * history registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeDirectProofErasureMatrixSource
	, directProofErasureMatrixAddedPaths
	, directProofErasureMatrixChangedPaths
	, directProofErasureMatrixHistoryPath
	, directProofErasureMatrixImplementation
	, directProofErasureMatrixImplementationAdditions
	, directProofErasureMatrixIntegrationPaths
	, directProofErasureMatrixPredecessor
	, reverseDirectProofErasureMatrixUpdate
} from "./direct-proof-erasure-matrix-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const exists = (revision, path) => spawnSync("git", ["cat-file", "-e"
	, `${revision}:${path}`], { stdio: "ignore" }).status === 0;
const record = async () => JSON.parse(await readFile(
	directProofErasureMatrixHistoryPath, "utf8"
));

test("direct proof matrix records its exact implementation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "direct-proof-erasure-matrix-source-v1");
	assert.equal(value.predecessorCommit, directProofErasureMatrixPredecessor);
	assert.equal(value.implementationCommit, directProofErasureMatrixImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, directProofErasureMatrixChangedPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, directProofErasureMatrixIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, directProofErasureMatrixAddedPaths);
});

test("direct proof matrix reverses every exact source transition", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${directProofErasureMatrixImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${directProofErasureMatrixPredecessor}:${update.path}`]);
		assert.equal(reverseDirectProofErasureMatrixUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeDirectProofErasureMatrixSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureMatrixImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureMatrixUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of directProofErasureMatrixIntegrationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("direct proof matrix additions retain exact identities", async () => {
	for(const addition of (await record()).additions)
	{
		const source = exists(directProofErasureMatrixImplementation, addition.path)
			? git(["show"
				, `${directProofErasureMatrixImplementation}:${addition.path}`])
			: await readFile(addition.path);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
		assert.equal(exists(directProofErasureMatrixPredecessor, addition.path)
			, false, addition.path);
	}
	assert.equal(directProofErasureMatrixImplementationAdditions.length, 2);
});

test("direct proof matrix history rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureMatrixImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasureMatrixUpdate(current, forged));
	assert.equal(beforeDirectProofErasureMatrixSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
