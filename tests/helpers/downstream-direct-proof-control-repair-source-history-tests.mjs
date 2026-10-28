/**
 * Authenticate downstream direct-proof controls and their source-pin closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeDownstreamDirectProofControlRepairSource
	, downstreamDirectProofControlRepairAddedPaths
	, downstreamDirectProofControlRepairCommits
	, downstreamDirectProofControlRepairHistoryPath
	, downstreamDirectProofControlRepairImplementation
	, downstreamDirectProofControlRepairImplementationPaths
	, downstreamDirectProofControlRepairIntegrationPaths
	, downstreamDirectProofControlRepairPredecessor
	, reverseDownstreamDirectProofControlRepairUpdate
} from "./downstream-direct-proof-control-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	downstreamDirectProofControlRepairHistoryPath, "utf8"
));

test("downstream control repair records its exact two-commit range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "downstream-direct-proof-control-repair-source-v1");
	assert.equal(value.predecessorCommit
		, downstreamDirectProofControlRepairPredecessor);
	assert.equal(value.implementationCommit
		, downstreamDirectProofControlRepairImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, downstreamDirectProofControlRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, downstreamDirectProofControlRepairIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, downstreamDirectProofControlRepairAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${downstreamDirectProofControlRepairPredecessor}..${downstreamDirectProofControlRepairImplementation}`]).trim().split("\n")
	, downstreamDirectProofControlRepairCommits);
	assert.match(value.scope, /37 exact current-source pins across two paths/u);
});

test("downstream control repair reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${downstreamDirectProofControlRepairImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${downstreamDirectProofControlRepairPredecessor}:${update.path}`]);
		assert.equal(reverseDownstreamDirectProofControlRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDownstreamDirectProofControlRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${downstreamDirectProofControlRepairImplementation}:${update.path}`]);
		assert.equal(reverseDownstreamDirectProofControlRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of [
		...downstreamDirectProofControlRepairImplementationPaths
		, ...downstreamDirectProofControlRepairIntegrationPaths
	]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("downstream control repair closes every observed stale contract", () => {
	const source = path => git(["show"
		, `${downstreamDirectProofControlRepairImplementation}:${path}`]);
	const managed = source("tests/helpers/managed-ci-isolation.mjs");
	assert.match(managed, /const additionalOutcomes/u);
	assert.match(managed, /continueOnError/u);
	const current = source("tests/managed-ci-isolation.test.mjs");
	assert.match(current, /direct_proof_managed/u);
	assert.match(current, /selectedOutcomeCases: 39/u);
	const native = source("tests/helpers/native-ci-isolation.mjs");
	assert.match(native, /direct_proof_native/u);
	assert.match(native, /direct_proof_language/u);
	const fixture = source("tests/helpers/reviewed-subtype-host-fixture.mjs");
	assert.match(fixture, /reviewedSubtypeHistoricalHostIr/u);
	const report = source("tests/helpers/reviewed-subtype-host-report.mjs");
	assert.match(report, /historicalReviewedSelection/u);
	const structural = source("tests/helpers/structural-subtype-ci-workflow.mjs");
	assert.match(structural, /Require direct proof erasure in Node/u);
	assert.match(structural, /nodeFailure, nodeFailure \+ structuralFailure/u);
});

test("downstream control repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${downstreamDirectProofControlRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDownstreamDirectProofControlRepairUpdate(current, forged));
	assert.equal(beforeDownstreamDirectProofControlRepairSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
