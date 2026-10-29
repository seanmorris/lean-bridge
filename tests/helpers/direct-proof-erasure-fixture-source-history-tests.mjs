/**
 * Authenticate direct proof-erasure fixture history and central registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeDirectProofErasureFixtureSource
	, directProofErasureFixtureAddedPaths
	, directProofErasureFixtureChangedPaths
	, directProofErasureFixtureHistoryPath
	, directProofErasureFixtureImplementation
	, directProofErasureFixtureIntegrationPaths
	, directProofErasureFixtureNormalizationPaths
	, directProofErasureFixturePredecessor
	, reverseDirectProofErasureFixtureUpdate
} from "./direct-proof-erasure-fixture-source-history.mjs";
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
	directProofErasureFixtureHistoryPath, "utf8"
));

test("direct proof erasure fixture records its exact implementation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "direct-proof-erasure-fixture-source-v1");
	assert.equal(value.predecessorCommit, directProofErasureFixturePredecessor);
	assert.equal(value.implementationCommit, directProofErasureFixtureImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, directProofErasureFixtureChangedPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, directProofErasureFixtureIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, directProofErasureFixtureAddedPaths);
});

test("direct proof erasure fixture reverses every recorded source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${directProofErasureFixtureImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${directProofErasureFixturePredecessor}:${update.path}`]);
		assert.equal(reverseDirectProofErasureFixtureUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeDirectProofErasureFixtureSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = git(["show"
			, `${directProofErasureFixtureImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureFixtureUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of directProofErasureFixtureNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("direct proof erasure fixture additions retain exact identities", async () => {
	for(const addition of (await record()).additions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
		assert.equal(exists(directProofErasureFixturePredecessor, addition.path)
			, false, addition.path);
	}
});

test("direct proof erasure fixture history rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureFixtureImplementation}:${update.path}`]);
	assert.throws(() => reverseDirectProofErasureFixtureUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseDirectProofErasureFixtureUpdate(
		current, { ...update, previousSha256: "0".repeat(64) }));
	assert.equal(beforeDirectProofErasureFixtureSource(
		update.path, `${current}forged\n`), `${current}forged\n`);
});
