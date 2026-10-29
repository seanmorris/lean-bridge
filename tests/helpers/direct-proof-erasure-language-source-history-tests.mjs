/**
 * Authenticate Perl/Python/Ruby/Rust direct proof-erasure source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeDirectProofErasureLanguageSource
	, directProofErasureLanguageAddedPaths
	, directProofErasureLanguageChangedPaths
	, directProofErasureLanguageHistoryPath
	, directProofErasureLanguageImplementation
	, directProofErasureLanguageIntegrationPaths
	, directProofErasureLanguageNormalizationPaths
	, directProofErasureLanguagePredecessor
	, reverseDirectProofErasureLanguageUpdate
} from "./direct-proof-erasure-language-source-history.mjs";
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
	directProofErasureLanguageHistoryPath, "utf8"
));

test("language direct proof acceptance records its exact implementation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "direct-proof-erasure-language-source-v1");
	assert.equal(value.predecessorCommit
		, directProofErasureLanguagePredecessor);
	assert.equal(value.implementationCommit
		, directProofErasureLanguageImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, directProofErasureLanguageChangedPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, directProofErasureLanguageIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, directProofErasureLanguageAddedPaths);
});

test("language direct proof acceptance reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${directProofErasureLanguageImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${directProofErasureLanguagePredecessor}:${update.path}`]);
		assert.equal(reverseDirectProofErasureLanguageUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeDirectProofErasureLanguageSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = git(["show"
			, `${directProofErasureLanguageImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureLanguageUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of directProofErasureLanguageNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("language direct proof additions retain exact identities", async () => {
	for(const addition of (await record()).additions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
		assert.equal(exists(directProofErasureLanguagePredecessor, addition.path)
			, false, addition.path);
	}
});

test("language direct proof history rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureLanguageImplementation}:${update.path}`]);
	assert.throws(() => reverseDirectProofErasureLanguageUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseDirectProofErasureLanguageUpdate(
		current, { ...update, previousSha256: "0".repeat(64) }));
	assert.equal(beforeDirectProofErasureLanguageSource(
		update.path, `${current}forged\n`), `${current}forged\n`);
});
