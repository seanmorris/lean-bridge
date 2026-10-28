/**
 * Authenticate managed direct proof-erasure package source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeDirectProofErasureManagedSource
	, directProofErasureManagedAddedPaths
	, directProofErasureManagedChangedPaths
	, directProofErasureManagedHistoryPath
	, directProofErasureManagedImplementation
	, directProofErasureManagedIntegrationPaths
	, directProofErasureManagedNormalizationPaths
	, directProofErasureManagedPredecessor
	, reverseDirectProofErasureManagedUpdate
} from "./direct-proof-erasure-managed-source-history.mjs";
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
	directProofErasureManagedHistoryPath, "utf8"
));

test("managed direct proof acceptance records its exact implementation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "direct-proof-erasure-managed-source-v1");
	assert.equal(value.predecessorCommit
		, directProofErasureManagedPredecessor);
	assert.equal(value.implementationCommit
		, directProofErasureManagedImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, directProofErasureManagedChangedPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, directProofErasureManagedIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, directProofErasureManagedAddedPaths);
});

test("managed direct proof acceptance reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${directProofErasureManagedImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${directProofErasureManagedPredecessor}:${update.path}`]);
		assert.equal(reverseDirectProofErasureManagedUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeDirectProofErasureManagedSource(
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
			, `${directProofErasureManagedImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureManagedUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of directProofErasureManagedNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("managed direct proof additions retain exact identities", async () => {
	for(const addition of (await record()).additions)
	{
		const live = exists(directProofErasureManagedImplementation, addition.path)
			? git(["show"
				, `${directProofErasureManagedImplementation}:${addition.path}`])
			: await readFile(addition.path);
		const source = beforeFinRefinementSource(
			addition.path, live, addition.currentSha256
		);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
		assert.equal(exists(directProofErasureManagedPredecessor, addition.path)
			, false, addition.path);
	}
});

test("managed direct proof history rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureManagedImplementation}:${update.path}`]);
	assert.throws(() => reverseDirectProofErasureManagedUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseDirectProofErasureManagedUpdate(
		current, { ...update, previousSha256: "0".repeat(64) }));
	assert.equal(beforeDirectProofErasureManagedSource(
		update.path, `${current}forged\n`), `${current}forged\n`);
});
