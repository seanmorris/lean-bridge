/**
 * Authenticate the bounded downstream reporter checkouts and live pins.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeDownstreamReporterSparseCheckoutSource
	, downstreamReporterSparseCheckoutAddedPaths
	, downstreamReporterSparseCheckoutHistoryPath
	, downstreamReporterSparseCheckoutImplementation
	, downstreamReporterSparseCheckoutImplementationPaths
	, downstreamReporterSparseCheckoutIntegrationPaths
	, downstreamReporterSparseCheckoutNormalizationPaths
	, downstreamReporterSparseCheckoutPinPaths
	, downstreamReporterSparseCheckoutPinRepair
	, downstreamReporterSparseCheckoutPredecessor
	, reverseDownstreamReporterSparseCheckoutUpdate
} from "./downstream-reporter-sparse-checkout-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const record = async () => JSON.parse(await readFile(
	downstreamReporterSparseCheckoutHistoryPath, "utf8"
));
const job = (source, name, next) => source.split(`  ${name}:\n`)[1]
	.split(`  ${next}:\n`)[0];

test("downstream reporter sparse checkout records its exact source range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "downstream-reporter-sparse-checkout-source-v1");
	assert.equal(value.predecessorCommit
		, downstreamReporterSparseCheckoutPredecessor);
	assert.equal(value.implementationCommit
		, downstreamReporterSparseCheckoutImplementation);
	assert.equal(value.pinRepairCommit
		, downstreamReporterSparseCheckoutPinRepair);
	assert.equal(git(["rev-parse", `${value.integrationCommit}^`]).trim()
		, downstreamReporterSparseCheckoutPinRepair);
	assert.deepEqual(names(["diff", "--name-only"
		, downstreamReporterSparseCheckoutPredecessor
		, downstreamReporterSparseCheckoutImplementation])
		, [...downstreamReporterSparseCheckoutImplementationPaths].sort());
	assert.deepEqual(names(["diff", "--name-only"
		, downstreamReporterSparseCheckoutImplementation
		, downstreamReporterSparseCheckoutPinRepair])
		, [...downstreamReporterSparseCheckoutPinPaths].sort());
	assert.deepEqual(value.updates.map(update => update.path)
		, downstreamReporterSparseCheckoutImplementationPaths);
	assert.deepEqual(value.pinUpdates.map(update => update.path)
		, downstreamReporterSparseCheckoutPinPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, downstreamReporterSparseCheckoutIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, downstreamReporterSparseCheckoutAddedPaths);
});

test("downstream checkout keeps the full audit and bounds only its reporter", () => {
	const source = git(["show"
		, `${downstreamReporterSparseCheckoutImplementation}:.github/workflows/consumer-matrix.yml`]);
	const reviewed = job(source, "reviewed-ir-admission", "nix-cache");
	const observations = job(source, "php-wasm-observations"
		, "php-multi-profile");
	assert.match(reviewed, /timeout-minutes: 60/u);
	assert.match(reviewed
		, /intentionally re-hashes the complete retained type-surface/u);
	assert.doesNotMatch(reviewed, /sparse-checkout/u);
	assert.match(observations, /fetch-depth: 1/u);
	assert.match(observations, /sparse-checkout-cone-mode: false/u);
	assert.doesNotMatch(observations, /^\s+filter:/mu);
	const patterns = observations.split("sparse-checkout: |\n")[1]
		.split("          sparse-checkout-cone-mode")[0].trim()
		.split("\n").map(line => line.trim());
	assert.deepEqual(patterns, [
		"/scripts/consumer-ci.mjs"
		, "/src/adoption/consumer-support.mjs"
		, "/docs/consumer-support.v1.json"
	]);
	assert.match(observations, /timeout-minutes: 15/u);
});

test("downstream reporter sparse checkout reverses every endpoint", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${downstreamReporterSparseCheckoutImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${downstreamReporterSparseCheckoutPredecessor}:${update.path}`]);
		assert.equal(reverseDownstreamReporterSparseCheckoutUpdate(
			current, update), previous, update.path);
	}
	for(const update of value.pinUpdates)
	{
		const current = git(["show"
			, `${downstreamReporterSparseCheckoutPinRepair}:${update.path}`]);
		const previous = git(["show"
			, `${downstreamReporterSparseCheckoutImplementation}:${update.path}`]);
		assert.equal(reverseDownstreamReporterSparseCheckoutUpdate(
			current, update), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${downstreamReporterSparseCheckoutPinRepair}:${update.path}`]);
		assert.equal(reverseDownstreamReporterSparseCheckoutUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of downstreamReporterSparseCheckoutNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("downstream reporter sparse checkout rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${downstreamReporterSparseCheckoutImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.yml" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDownstreamReporterSparseCheckoutUpdate(current, forged));
	assert.equal(beforeDownstreamReporterSparseCheckoutSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
	for(const addition of (await record()).additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
});
