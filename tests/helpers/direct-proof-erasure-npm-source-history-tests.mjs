/**
 * Authenticate direct proof-erasure npm and browser source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeDirectProofErasureNpmSource
	, directProofErasureNpmAddedPaths
	, directProofErasureNpmChangedPaths
	, directProofErasureNpmHistoryPath
	, directProofErasureNpmImplementation
	, directProofErasureNpmIntegrationPaths
	, directProofErasureNpmNormalizationPaths
	, directProofErasureNpmPredecessor
	, reverseDirectProofErasureNpmUpdate
} from "./direct-proof-erasure-npm-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const exists = (revision, path) => spawnSync("git", ["cat-file", "-e"
	, `${revision}:${path}`], { stdio: "ignore" }).status === 0;
const record = async () => JSON.parse(await readFile(
	directProofErasureNpmHistoryPath, "utf8"
));

test("direct proof erasure npm acceptance records its exact implementation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "direct-proof-erasure-npm-source-v1");
	assert.equal(value.predecessorCommit, directProofErasureNpmPredecessor);
	assert.equal(value.implementationCommit, directProofErasureNpmImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, directProofErasureNpmChangedPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, directProofErasureNpmIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, directProofErasureNpmAddedPaths);
});

test("direct proof erasure npm acceptance reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show", `${directProofErasureNpmImplementation}:${update.path}`]);
		const previous = git(["show", `${directProofErasureNpmPredecessor}:${update.path}`]);
		assert.equal(reverseDirectProofErasureNpmUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeDirectProofErasureNpmSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = git(["show", `${directProofErasureNpmImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureNpmUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of directProofErasureNpmNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("direct proof erasure npm additions retain exact identities", async () => {
	for(const addition of (await record()).additions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
		assert.equal(exists(directProofErasureNpmPredecessor, addition.path)
			, false, addition.path);
	}
});

test("direct proof erasure npm history rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show", `${directProofErasureNpmImplementation}:${update.path}`]);
	assert.throws(() => reverseDirectProofErasureNpmUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseDirectProofErasureNpmUpdate(
		current, { ...update, previousSha256: "0".repeat(64) }));
	assert.equal(beforeDirectProofErasureNpmSource(
		update.path, `${current}forged\n`), `${current}forged\n`);
});
