/**
 * Authenticate the complete optional-parameter implementation and history
 * registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeOptionalParameterSource, optionalParameterFeatureCommit
	, optionalParameterHistoryAdditions, optionalParameterHistoryPath
	, optionalParameterImplementation, optionalParameterImplementationAdditions
	, optionalParameterImplementationCommits, optionalParameterIntegrationPaths
	, optionalParameterNormalizationPaths, optionalParameterPredecessor
	, reverseOptionalParameterUpdate
} from "./optional-parameter-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const exists = (revision, path) => spawnSync("git", ["cat-file", "-e"
	, `${revision}:${path}`], { stdio: "ignore" }).status === 0;
const record = async () => JSON.parse(await readFile(
	optionalParameterHistoryPath, "utf8"));

test("optional parameters record their exact implementation sequence", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "optional-parameter-source-v1");
	assert.equal(value.predecessorCommit, optionalParameterPredecessor);
	assert.equal(value.featureCommit, optionalParameterFeatureCommit);
	assert.equal(value.implementationCommit, optionalParameterImplementation);
	assert.deepEqual(value.implementationCommits
		, optionalParameterImplementationCommits);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${optionalParameterPredecessor}..${optionalParameterImplementation}`])
		.trim().split("\n"), optionalParameterImplementationCommits);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, optionalParameterIntegrationPaths);
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, optionalParameterHistoryAdditions);
});

test("optional parameters reverse every modified source exactly", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show", `${update.currentCommit}:${update.path}`]);
		const previous = git(["show", `${update.previousCommit}:${update.path}`]);
		assert.equal(reverseOptionalParameterUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeOptionalParameterSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${optionalParameterImplementation}:${update.path}`]);
		assert.equal(reverseOptionalParameterUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of optionalParameterNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("optional parameters authenticate every added source", async () => {
	const value = await record();
	assert.deepEqual(value.implementationAdditions.map(item => item.path)
		, optionalParameterImplementationAdditions);
	for(const addition of value.implementationAdditions)
	{
		assert.equal(exists(optionalParameterPredecessor, addition.path)
			, false, addition.path);
		const source = git(["show"
			, `${optionalParameterImplementation}:${addition.path}`]);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
	}
	for(const addition of value.historyAdditions)
	{
		assert.equal(exists(optionalParameterImplementation, addition.path)
			, false, addition.path);
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
	}
});

test("optional parameter pin reconciliation changes only 960 exact hashes", () => {
	const previous = JSON.parse(git(["show"
		, `${optionalParameterFeatureCommit}:docs/type-surface.v1.json`]));
	const current = JSON.parse(git(["show"
		, `${optionalParameterImplementation}:docs/type-surface.v1.json`]));
	let changed = 0;
	const paths = new Set();
	assert.equal(previous.evidence.length, current.evidence.length);
	for(const [index, evidence] of current.evidence.entries())
	{
		const before = previous.evidence[index];
		assert.deepEqual(Object.keys(evidence), Object.keys(before));
		assert.equal(evidence.files.length, before.files.length);
		for(const [fileIndex, file] of evidence.files.entries())
		{
			const old = before.files[fileIndex];
			assert.equal(file.path, old.path);
			const clean = value => ({ ...value, sha256: "<source>" });
			assert.deepEqual(clean(file), clean(old));
			if(file.sha256 === old.sha256) continue;
			changed++; paths.add(file.path);
			assert.equal(file.sha256, sha256(git(["show"
				, `${optionalParameterFeatureCommit}:${file.path}`])), file.path);
		}
	}
	assert.equal(changed, 960);
	assert.equal(paths.size, 40);
});

test("optional parameter history rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show", `${update.currentCommit}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseOptionalParameterUpdate(current, forged));
	assert.equal(beforeOptionalParameterSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});

test("optional parameter history covers the exact implementation file set", async () => {
	const value = await record();
	const recorded = [
		...value.updates.filter(item =>
			item.currentCommit === optionalParameterFeatureCommit)
			.map(item => item.path)
		, ...value.implementationAdditions.map(item => item.path)
	].filter(path => path !== "scripts/refresh-optional-parameter-pins.mjs")
		.sort();
	assert.deepEqual(recorded, names(["diff", "--name-only"
		, optionalParameterPredecessor, optionalParameterFeatureCommit]));
});
