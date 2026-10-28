/**
 * Authenticate downstream direct-proof repairs and their source-pin closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeDirectProofErasureDownstreamRepairSource
	, directProofErasureDownstreamRepairAddedPaths
	, directProofErasureDownstreamRepairCommits
	, directProofErasureDownstreamRepairHistoryPath
	, directProofErasureDownstreamRepairImplementation
	, directProofErasureDownstreamRepairImplementationPaths
	, directProofErasureDownstreamRepairIntegrationPaths
	, directProofErasureDownstreamRepairPredecessor
	, reverseDirectProofErasureDownstreamRepairUpdate
} from "./direct-proof-erasure-downstream-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureDownstreamRepairHistoryPath, "utf8"
));

test("downstream proof repair records its exact three-commit range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "direct-proof-erasure-downstream-repair-source-v1");
	assert.equal(value.predecessorCommit
		, directProofErasureDownstreamRepairPredecessor);
	assert.equal(value.implementationCommit
		, directProofErasureDownstreamRepairImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, directProofErasureDownstreamRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, directProofErasureDownstreamRepairIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, directProofErasureDownstreamRepairAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${directProofErasureDownstreamRepairPredecessor}..${directProofErasureDownstreamRepairImplementation}`]).trim().split("\n")
	, directProofErasureDownstreamRepairCommits);
	assert.match(value.scope, /exactly 271 current-source pins across eleven paths/u);
});

test("downstream proof repair reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${directProofErasureDownstreamRepairImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${directProofErasureDownstreamRepairPredecessor}:${update.path}`]);
		assert.equal(reverseDirectProofErasureDownstreamRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasureDownstreamRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureDownstreamRepairImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureDownstreamRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of [
		...directProofErasureDownstreamRepairImplementationPaths
		, ...directProofErasureDownstreamRepairIntegrationPaths
	]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("downstream proof repair closes the observed consumer failures", () => {
	const source = path => git(["show"
		, `${directProofErasureDownstreamRepairImplementation}:${path}`]);
	const metadata = source("src/analyze/elaborated-metadata.mjs");
	assert.match(metadata, /depth > 32/u);
	const callable = source("src/build/component-structured-callable-lean.mjs");
	assert.match(callable, /sourceCallbackType/u);
	assert.match(callable, /wireCallbackType/u);
	const fixture = source("tests/helpers/php-wasm-subtype-fixture.mjs");
	assert.match(fixture, /phpWasmSubtypeHistoricalRefinements/u);
	assert.match(fixture, /constructor: null/u);
	const report = source("tests/helpers/php-wasm-subtype-report.mjs");
	assert.match(report, /one exact supported producer contract/u);
	assert.match(report, /producer-era review byte-for-byte/u);
	const owned = source("tests/php-wasm-fin.test.mjs");
	assert.match(owned, /Owned\.newTicket/u);
	assert.match(owned, /ownedModel\.ownedGraph/u);
});

test("downstream proof repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureDownstreamRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasureDownstreamRepairUpdate(current, forged));
	assert.equal(beforeDirectProofErasureDownstreamRepairSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
