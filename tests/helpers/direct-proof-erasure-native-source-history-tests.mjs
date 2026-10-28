/**
 * Authenticate direct proof-erasure C/C++ package source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeDirectProofErasureNativeSource
	, directProofErasureNativeAddedPaths
	, directProofErasureNativeChangedPaths
	, directProofErasureNativeHistoryPath
	, directProofErasureNativeImplementation
	, directProofErasureNativeIntegrationPaths
	, directProofErasureNativeNormalizationPaths
	, directProofErasureNativePredecessor
	, reverseDirectProofErasureNativeUpdate
} from "./direct-proof-erasure-native-source-history.mjs";
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
	directProofErasureNativeHistoryPath, "utf8"
));

test("direct proof erasure native acceptance records its exact implementation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "direct-proof-erasure-native-source-v1");
	assert.equal(value.predecessorCommit, directProofErasureNativePredecessor);
	assert.equal(value.implementationCommit, directProofErasureNativeImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, directProofErasureNativeChangedPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, directProofErasureNativeIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, directProofErasureNativeAddedPaths);
});

test("direct proof erasure native acceptance reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show", `${directProofErasureNativeImplementation}:${update.path}`]);
		const previous = git(["show", `${directProofErasureNativePredecessor}:${update.path}`]);
		assert.equal(reverseDirectProofErasureNativeUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeDirectProofErasureNativeSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await readFile(update.path, "utf8");
		const previous = git(["show", `${directProofErasureNativeImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureNativeUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of directProofErasureNativeNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("direct proof erasure native additions retain exact identities", async () => {
	for(const addition of (await record()).additions)
	{
		const source = exists(directProofErasureNativeImplementation, addition.path)
			? git(["show", `${directProofErasureNativeImplementation}:${addition.path}`])
			: await readFile(addition.path);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
		assert.equal(exists(directProofErasureNativePredecessor, addition.path)
			, false, addition.path);
	}
});

test("direct proof erasure native history rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show", `${directProofErasureNativeImplementation}:${update.path}`]);
	assert.throws(() => reverseDirectProofErasureNativeUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseDirectProofErasureNativeUpdate(
		current, { ...update, previousSha256: "0".repeat(64) }));
	assert.equal(beforeDirectProofErasureNativeSource(
		update.path, `${current}forged\n`), `${current}forged\n`);
});
