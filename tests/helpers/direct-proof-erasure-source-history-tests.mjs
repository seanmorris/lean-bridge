/**
 * Authenticate direct proof-erasure source history and central registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeDirectProofErasureSource
	, directProofErasureAddedPaths
	, directProofErasureChangedPaths
	, directProofErasureHistoryPath
	, directProofErasureImplementation
	, directProofErasureIntegrationPaths
	, directProofErasureNormalizationPaths
	, directProofErasurePredecessor
	, reverseDirectProofErasureUpdate
} from "./direct-proof-erasure-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureHistoryPath, "utf8"
));

test("direct proof erasure records its exact implementation transition", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "direct-proof-erasure-source-v1");
	assert.equal(value.predecessorCommit, directProofErasurePredecessor);
	assert.equal(value.implementationCommit, directProofErasureImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, directProofErasureChangedPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, directProofErasureIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, directProofErasureAddedPaths);
});

test("direct proof erasure reverses implementation and integration bytes", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${directProofErasureImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${directProofErasurePredecessor}:${update.path}`]);
		assert.equal(reverseDirectProofErasureUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeDirectProofErasureSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const live = await readFile(update.path, "utf8");
		const current = beforeFinRefinementSource(
			update.path, live, update.currentSha256
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = git(["show"
			, `${directProofErasureImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of directProofErasureNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("direct proof erasure history additions retain exact identities", async () => {
	for(const addition of (await record()).additions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, directProofErasureImplementation, "--", addition.path]).trim(), "");
		const source = beforeFinRefinementSource(
			addition.path, await readFile(addition.path), addition.currentSha256
		);
		assert.equal(sha256(source)
			, addition.currentSha256, addition.path);
	}
});

test("direct proof erasure history rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureImplementation}:${update.path}`]);
	assert.throws(() => reverseDirectProofErasureUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseDirectProofErasureUpdate(
		current, { ...update, previousSha256: "0".repeat(64) }));
	assert.equal(beforeDirectProofErasureSource(
		update.path, `${current}forged\n`), `${current}forged\n`);
});
