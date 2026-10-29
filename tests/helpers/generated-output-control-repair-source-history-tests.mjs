/**
 * Authenticate the generated-output repair source milestones.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeGeneratedOutputControlRepairIntegrationSource
	, beforeGeneratedOutputControlRepairSource
	, generatedOutputControlRepairAddedPaths
	, generatedOutputControlRepairChangedPaths
	, generatedOutputControlRepairCommits
	, generatedOutputControlRepairExternalHistoryPaths
	, generatedOutputControlRepairHistoryPath
	, generatedOutputControlRepairImplementationAddedPaths
	, generatedOutputControlRepairIntegrationPaths
	, generatedOutputControlRepairPinCount
	, generatedOutputControlRepairPinRefresh
	, generatedOutputControlRepairPredecessor
	, reverseGeneratedOutputControlRepairUpdate
} from "./generated-output-control-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();
const record = async () => JSON.parse(await readFile(
	generatedOutputControlRepairHistoryPath, "utf8"));
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);

test("generated-output repair records every exact first-parent state", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "generated-output-control-repair-source-v1");
	assert.equal(value.predecessorCommit, generatedOutputControlRepairPredecessor);
	assert.equal(value.implementationCommit, generatedOutputControlRepairPinRefresh);
	assert.equal(value.externalTypeSurfacePointers, generatedOutputControlRepairPinCount);
	assert.deepEqual(value.commits.map(commit => commit.commit)
		, generatedOutputControlRepairCommits);
	assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
		, `${generatedOutputControlRepairPredecessor}..${generatedOutputControlRepairPinRefresh}`])
		.trim().split("\n"), generatedOutputControlRepairCommits);
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, generatedOutputControlRepairPredecessor
		, generatedOutputControlRepairPinRefresh])
	, [...generatedOutputControlRepairChangedPaths
		, ...generatedOutputControlRepairExternalHistoryPaths].sort());
	assert.deepEqual([...new Set(value.updates.map(update => update.path))].sort()
		, [...generatedOutputControlRepairChangedPaths].sort());
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, generatedOutputControlRepairIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, generatedOutputControlRepairAddedPaths);
});

test("generated-output repair reverses every source and integration transition", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		const current = sourceAt(update.commit, update.path);
		const previous = sourceAt(update.parent, update.path);
		assert.equal(reverseGeneratedOutputControlRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeGeneratedOutputControlRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const previous = sourceAt(value.integrationParent, update.path);
		assert.equal(reverseGeneratedOutputControlRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeGeneratedOutputControlRepairIntegrationSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("generated-output repair authenticates every added file at its milestone", async () => {
	for(const addition of (await record()).additions)
	{
		const source = generatedOutputControlRepairImplementationAddedPaths.includes(addition.path)
			? sourceAt(generatedOutputControlRepairPinRefresh, addition.path)
			: await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
	}
});

test("generated-output repair refuses forged and out-of-scope transitions", async () => {
	const update = (await record()).updates[0];
	const current = sourceAt(update.commit, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseGeneratedOutputControlRepairUpdate(current, forged));
	assert.equal(beforeGeneratedOutputControlRepairSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
	assert.equal(beforeGeneratedOutputControlRepairSource(
		"unknown.mjs", current), current);
});
