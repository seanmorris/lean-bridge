/**
 * Authenticate WIT/WASI direct proof-erasure source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeDirectProofErasureWitSource
	, directProofErasureWitAddedPaths
	, directProofErasureWitChangedPaths
	, directProofErasureWitHistoryPath
	, directProofErasureWitImplementation
	, directProofErasureWitIntegrationPaths
	, directProofErasureWitNormalizationPaths
	, directProofErasureWitPredecessor
	, reverseDirectProofErasureWitUpdate
} from "./direct-proof-erasure-wit-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const exists = (revision, path) => spawnSync("git", ["cat-file", "-e"
	, `${revision}:${path}`], { stdio: "ignore" }).status === 0;
const record = async () => JSON.parse(await readFile(
	directProofErasureWitHistoryPath, "utf8"
));

test("WIT direct proof acceptance records its exact implementation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "direct-proof-erasure-wit-source-v1");
	assert.equal(value.predecessorCommit, directProofErasureWitPredecessor);
	assert.equal(value.implementationCommit, directProofErasureWitImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, directProofErasureWitChangedPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, directProofErasureWitIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, directProofErasureWitAddedPaths);
});

test("WIT direct proof acceptance reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${directProofErasureWitImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${directProofErasureWitPredecessor}:${update.path}`]);
		assert.equal(reverseDirectProofErasureWitUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeDirectProofErasureWitSource(
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
			, `${directProofErasureWitImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureWitUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of directProofErasureWitNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("WIT direct proof additions retain exact identities", async () => {
	for(const addition of (await record()).additions)
	{
		const live = exists(directProofErasureWitImplementation, addition.path)
			? git(["show"
				, `${directProofErasureWitImplementation}:${addition.path}`])
			: await readFile(addition.path);
		const source = beforeFinRefinementSource(
			addition.path, live, addition.currentSha256
		);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
		assert.equal(exists(directProofErasureWitPredecessor, addition.path)
			, false, addition.path);
	}
});

test("WIT direct proof history rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureWitImplementation}:${update.path}`]);
	assert.throws(() => reverseDirectProofErasureWitUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseDirectProofErasureWitUpdate(
		current, { ...update, previousSha256: "0".repeat(64) }));
	assert.equal(beforeDirectProofErasureWitSource(
		update.path, `${current}forged\n`), `${current}forged\n`);
});
