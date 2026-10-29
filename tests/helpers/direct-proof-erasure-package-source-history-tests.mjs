/**
 * Authenticate the direct proof-erasure package-foundation history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeDirectProofErasurePackageSource
	, directProofErasurePackageAddedPaths
	, directProofErasurePackageChangedPaths
	, directProofErasurePackageHistoryPath
	, directProofErasurePackageImplementation
	, directProofErasurePackageIntegrationPaths
	, directProofErasurePackageNormalizationPaths
	, directProofErasurePackagePredecessor
	, reverseDirectProofErasurePackageUpdate
} from "./direct-proof-erasure-package-source-history.mjs";
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
	directProofErasurePackageHistoryPath, "utf8"
));

test("direct proof erasure package controls record their exact implementation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "direct-proof-erasure-package-source-v1");
	assert.equal(value.predecessorCommit, directProofErasurePackagePredecessor);
	assert.equal(value.implementationCommit, directProofErasurePackageImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, directProofErasurePackageChangedPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, directProofErasurePackageIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, directProofErasurePackageAddedPaths);
});

test("direct proof erasure package controls reverse every source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show", `${directProofErasurePackageImplementation}:${update.path}`]);
		const previous = git(["show", `${directProofErasurePackagePredecessor}:${update.path}`]);
		assert.equal(reverseDirectProofErasurePackageUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeDirectProofErasurePackageSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = git(["show", `${directProofErasurePackageImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasurePackageUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of directProofErasurePackageNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("direct proof erasure package additions retain exact identities", async () => {
	for(const addition of (await record()).additions)
	{
		const live = exists(directProofErasurePackageImplementation, addition.path)
			? git(["show", `${directProofErasurePackageImplementation}:${addition.path}`])
			: await readFile(addition.path);
		const source = beforeFinRefinementSource(
			addition.path, live, addition.currentSha256
		);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
		assert.equal(exists(directProofErasurePackagePredecessor, addition.path)
			, false, addition.path);
	}
});

test("direct proof erasure package history rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show", `${directProofErasurePackageImplementation}:${update.path}`]);
	assert.throws(() => reverseDirectProofErasurePackageUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseDirectProofErasurePackageUpdate(
		current, { ...update, previousSha256: "0".repeat(64) }));
	assert.equal(beforeDirectProofErasurePackageSource(
		update.path, `${current}forged\n`), `${current}forged\n`);
});
