/**
 * Authenticate the native proof producer repair and its registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeDirectProofErasureNativeProducerRepairSource
	, directProofErasureNativeProducerRepairAddedPaths
	, directProofErasureNativeProducerRepairCommits
	, directProofErasureNativeProducerRepairHistoryPath
	, directProofErasureNativeProducerRepairImplementation
	, directProofErasureNativeProducerRepairImplementationPaths
	, directProofErasureNativeProducerRepairIntegrationPaths
	, directProofErasureNativeProducerRepairPredecessor
	, reverseDirectProofErasureNativeProducerRepairUpdate
} from "./direct-proof-erasure-native-producer-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureNativeProducerRepairHistoryPath, "utf8"
));

test("native proof producer repair records its exact range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "direct-proof-erasure-native-producer-repair-source-v1");
	assert.equal(value.predecessorCommit
		, directProofErasureNativeProducerRepairPredecessor);
	assert.equal(value.implementationCommit
		, directProofErasureNativeProducerRepairImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, directProofErasureNativeProducerRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, directProofErasureNativeProducerRepairIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, directProofErasureNativeProducerRepairAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${directProofErasureNativeProducerRepairPredecessor}..${directProofErasureNativeProducerRepairImplementation}`]).trim().split("\n")
	, directProofErasureNativeProducerRepairCommits);
});

test("native proof producer repair reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${directProofErasureNativeProducerRepairImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${directProofErasureNativeProducerRepairPredecessor}:${update.path}`]);
		assert.equal(reverseDirectProofErasureNativeProducerRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasureNativeProducerRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureNativeProducerRepairImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureNativeProducerRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of [
		...directProofErasureNativeProducerRepairImplementationPaths
		, ...directProofErasureNativeProducerRepairIntegrationPaths
	]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("native proof producer repair closes all three hosted failures", () => {
	const source = path => git(["show"
		, `${directProofErasureNativeProducerRepairImplementation}:${path}`]);
	const generator = source("src/backends/c/native-copied-values.mjs");
	for(const name of [
		"_lb_budget", "_lb_checked", "_lb_boxed", "_lb_value"
		, "_lb_result", "_lb_status"
	]) assert.ok(generator.includes(name), name);
	const workflow = source(".github/workflows/consumer-matrix.yml");
	const start = workflow.indexOf("\n  native-consumers:");
	const native = workflow.slice(start
		, workflow.indexOf("\n  managed-consumers:", start));
	assert.ok(native.indexOf("Free hosted runner disk before native builds")
		< native.indexOf("Check out the exact revision"));
	const history = source(
		"tests/helpers/fin-callback-diagnostic-source-history-tests.mjs");
	assert.match(history
		, /git", \["show", `\$\{implementation\}:\$\{update\.path\}`\]/u);
	assert.doesNotMatch(history, /sourceAtFinHistoryMilestone/u);
});

test("native proof producer repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureNativeProducerRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasureNativeProducerRepairUpdate(current, forged));
	assert.equal(beforeDirectProofErasureNativeProducerRepairSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
