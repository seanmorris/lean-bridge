/**
 * Authenticate direct proof-erasure PHP package source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeDirectProofErasurePhpSource
	, directProofErasurePhpAddedPaths
	, directProofErasurePhpChangedPaths
	, directProofErasurePhpHistoryPath
	, directProofErasurePhpImplementation
	, directProofErasurePhpIntegrationPaths
	, directProofErasurePhpNormalizationPaths
	, directProofErasurePhpPredecessor
	, reverseDirectProofErasurePhpUpdate
} from "./direct-proof-erasure-php-source-history.mjs";
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
	directProofErasurePhpHistoryPath, "utf8"
));

test("direct proof erasure PHP acceptance records its exact implementation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "direct-proof-erasure-php-source-v1");
	assert.equal(value.predecessorCommit, directProofErasurePhpPredecessor);
	assert.equal(value.implementationCommit, directProofErasurePhpImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, directProofErasurePhpChangedPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, directProofErasurePhpIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, directProofErasurePhpAddedPaths);
});

test("direct proof erasure PHP acceptance reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show", `${directProofErasurePhpImplementation}:${update.path}`]);
		const previous = git(["show", `${directProofErasurePhpPredecessor}:${update.path}`]);
		assert.equal(reverseDirectProofErasurePhpUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeDirectProofErasurePhpSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = git(["show", `${directProofErasurePhpImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasurePhpUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of directProofErasurePhpNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("direct proof erasure PHP additions retain exact identities", async () => {
	for(const addition of (await record()).additions)
	{
		const live = exists(directProofErasurePhpImplementation, addition.path)
			? git(["show", `${directProofErasurePhpImplementation}:${addition.path}`])
			: await readFile(addition.path, "utf8");
		const source = beforeFinRefinementSource(
			addition.path, live, addition.currentSha256
		);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
		assert.equal(exists(directProofErasurePhpPredecessor, addition.path)
			, false, addition.path);
	}
});

test("direct proof erasure PHP history rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show", `${directProofErasurePhpImplementation}:${update.path}`]);
	assert.throws(() => reverseDirectProofErasurePhpUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseDirectProofErasurePhpUpdate(
		current, { ...update, previousSha256: "0".repeat(64) }));
	assert.equal(beforeDirectProofErasurePhpSource(
		update.path, `${current}forged\n`), `${current}forged\n`);
});
