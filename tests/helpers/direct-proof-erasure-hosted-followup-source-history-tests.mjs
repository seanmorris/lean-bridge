/**
 * Authenticate the hosted proof-producer follow-up and its registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeDirectProofErasureHostedFollowupSource
	, directProofErasureHostedFollowupAddedPaths
	, directProofErasureHostedFollowupCommits
	, directProofErasureHostedFollowupHistoryPath
	, directProofErasureHostedFollowupImplementation
	, directProofErasureHostedFollowupImplementationPaths
	, directProofErasureHostedFollowupIntegrationPaths
	, directProofErasureHostedFollowupPredecessor
	, reverseDirectProofErasureHostedFollowupUpdate
} from "./direct-proof-erasure-hosted-followup-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureHostedFollowupHistoryPath, "utf8"
));

test("hosted proof follow-up records its exact range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "direct-proof-erasure-hosted-followup-source-v1");
	assert.equal(value.predecessorCommit
		, directProofErasureHostedFollowupPredecessor);
	assert.equal(value.implementationCommit
		, directProofErasureHostedFollowupImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, directProofErasureHostedFollowupImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, directProofErasureHostedFollowupIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, directProofErasureHostedFollowupAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${directProofErasureHostedFollowupPredecessor}..${directProofErasureHostedFollowupImplementation}`]).trim().split("\n")
	, directProofErasureHostedFollowupCommits);
});

test("hosted proof follow-up reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${directProofErasureHostedFollowupImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${directProofErasureHostedFollowupPredecessor}:${update.path}`]);
		assert.equal(reverseDirectProofErasureHostedFollowupUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasureHostedFollowupSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureHostedFollowupImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureHostedFollowupUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of [
		...directProofErasureHostedFollowupImplementationPaths
		, ...directProofErasureHostedFollowupIntegrationPaths
	]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("hosted proof follow-up closes both observed failures", () => {
	const source = path => git(["show"
		, `${directProofErasureHostedFollowupImplementation}:${path}`]);
	const fixture = source("tests/helpers/reviewed-subtype-fixture.mjs");
	assert.match(fixture, /constructor: null/u);
	assert.match(fixture, /parameters: parameters\.map\(inputSubtype\)/u);
	const build = source("tests/helpers/reviewed-subtype-build-tests.mjs");
	assert.match(build, /output constructor selection/u);
	const wit = source(
		"tests/helpers/wit-owned-callback-result-runtime-evidence.mjs");
	assert.match(wit, /historicalOutputs/u);
	assert.match(wit, /historicalObservedSource/u);
	assert.doesNotMatch(wit, /ownedWitCallbackNativeSource/u);
	const mutations = source(
		"tests/wit-owned-callback-result-runtime-evidence.test.mjs");
	assert.match(mutations, /hostCallbacks\.trampolineSha256 = zero/u);
});

test("hosted proof follow-up rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureHostedFollowupImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasureHostedFollowupUpdate(current, forged));
	assert.equal(beforeDirectProofErasureHostedFollowupSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
