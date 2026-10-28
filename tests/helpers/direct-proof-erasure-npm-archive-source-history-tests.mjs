/**
 * Authenticate npm handoff archive retention for direct proof erasure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeDirectProofErasureNpmArchiveSource
	, directProofErasureNpmArchiveAddedPaths
	, directProofErasureNpmArchiveHistoryPath
	, directProofErasureNpmArchiveImplementation
	, directProofErasureNpmArchiveImplementationPaths
	, directProofErasureNpmArchiveIntegrationPaths
	, directProofErasureNpmArchivePredecessor
	, reverseDirectProofErasureNpmArchiveUpdate
} from "./direct-proof-erasure-npm-archive-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureNpmArchiveHistoryPath, "utf8"
));

test("direct proof npm archive retention records its exact implementation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "direct-proof-erasure-npm-archive-source-v1");
	assert.equal(value.predecessorCommit
		, directProofErasureNpmArchivePredecessor);
	assert.equal(value.implementationCommit
		, directProofErasureNpmArchiveImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, directProofErasureNpmArchiveImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, directProofErasureNpmArchiveIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, directProofErasureNpmArchiveAddedPaths);
});

test("direct proof npm archive retention reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${directProofErasureNpmArchiveImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${directProofErasureNpmArchivePredecessor}:${update.path}`]);
		assert.equal(reverseDirectProofErasureNpmArchiveUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeDirectProofErasureNpmArchiveSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureNpmArchiveImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureNpmArchiveUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of directProofErasureNpmArchiveIntegrationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("direct proof npm archive history additions retain exact identities", async () => {
	for(const addition of (await record()).additions)
	{
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
		assert.equal(git(["ls-tree", "--name-only"
			, directProofErasureNpmArchivePredecessor, "--", addition.path]).trim()
			, "", addition.path);
	}
});

test("direct proof npm archive history rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureNpmArchiveImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasureNpmArchiveUpdate(current, forged));
	assert.equal(beforeDirectProofErasureNpmArchiveSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
