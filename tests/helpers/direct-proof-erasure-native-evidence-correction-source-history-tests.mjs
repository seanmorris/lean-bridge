/**
 * Authenticate the native proof-erasure evidence-path correction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeDirectProofErasureNativeEvidenceCorrectionSource
	, directProofErasureNativeEvidenceCorrectionAddedPaths
	, directProofErasureNativeEvidenceCorrectionCommits
	, directProofErasureNativeEvidenceCorrectionHistoryPath
	, directProofErasureNativeEvidenceCorrectionImplementation
	, directProofErasureNativeEvidenceCorrectionImplementationPaths
	, directProofErasureNativeEvidenceCorrectionIntegrationPaths
	, directProofErasureNativeEvidenceCorrectionPredecessor
	, reverseDirectProofErasureNativeEvidenceCorrectionUpdate
} from "./direct-proof-erasure-native-evidence-correction-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureNativeEvidenceCorrectionHistoryPath, "utf8"
));

test("native proof-erasure evidence correction records its exact range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "direct-proof-erasure-native-evidence-correction-source-v1");
	assert.equal(value.predecessorCommit
		, directProofErasureNativeEvidenceCorrectionPredecessor);
	assert.equal(value.implementationCommit
		, directProofErasureNativeEvidenceCorrectionImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, directProofErasureNativeEvidenceCorrectionImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, directProofErasureNativeEvidenceCorrectionIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, directProofErasureNativeEvidenceCorrectionAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${directProofErasureNativeEvidenceCorrectionPredecessor}..${directProofErasureNativeEvidenceCorrectionImplementation}`]).trim().split("\n")
	, directProofErasureNativeEvidenceCorrectionCommits);
});

test("native proof-erasure correction reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${directProofErasureNativeEvidenceCorrectionImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${directProofErasureNativeEvidenceCorrectionPredecessor}:${update.path}`]);
		assert.equal(reverseDirectProofErasureNativeEvidenceCorrectionUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasureNativeEvidenceCorrectionSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureNativeEvidenceCorrectionImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureNativeEvidenceCorrectionUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of [
		...directProofErasureNativeEvidenceCorrectionImplementationPaths
		, ...directProofErasureNativeEvidenceCorrectionIntegrationPaths
	]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("native proof-erasure correction uses the actual compiled evidence", () => {
	const source = path => git(["show"
		, `${directProofErasureNativeEvidenceCorrectionImplementation}:${path}`]);
	const packages = source("tests/helpers/direct-proof-erasure-packages.mjs");
	assert.match(packages, /readVerifiedNativeComponent/u);
	for(const name of [
		"artifacts.json", "binding-ir.json", "generated.lean", "metadata.json"
		, "model.json", "native-component.json"
	]) assert.ok(packages.includes(`"${name}"`), name);
	for(const path of [
		"tests/direct-proof-erasure-language-installed.test.mjs"
		, "tests/direct-proof-erasure-managed-installed.test.mjs"
		, "tests/direct-proof-erasure-native-installed.test.mjs"
		, "tests/direct-proof-erasure-wit-installed.test.mjs"
	]) {
		const installed = source(path);
		assert.match(installed, /assertDirectProofErasureNativeComponent/u);
		assert.doesNotMatch(installed, /join\(outputRoot, "bundle"\)/u);
	}
});

test("native proof-erasure correction rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureNativeEvidenceCorrectionImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasureNativeEvidenceCorrectionUpdate(current, forged));
	assert.equal(beforeDirectProofErasureNativeEvidenceCorrectionSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
