/**
 * Authenticate the complete Perl, Python and Ruby HostNull source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeHostNullScriptingIntegrationSource
	, beforeHostNullScriptingSource
	, hostNullScriptingAddedPaths
	, hostNullScriptingChangedPaths
	, hostNullScriptingCommits
	, hostNullScriptingExternalHistoryPaths
	, hostNullScriptingHistoryPath
	, hostNullScriptingImplementationAddedPaths
	, hostNullScriptingIntegrationPaths
	, hostNullScriptingPinCount
	, hostNullScriptingPinCounts
	, hostNullScriptingPinDefinition
	, hostNullScriptingPinRefresh
	, hostNullScriptingPredecessor
	, reverseHostNullScriptingUpdate
} from "./host-null-scripting-source-history.mjs";
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
	hostNullScriptingHistoryPath, "utf8"));
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);

test("scripting HostNull records every exact first-parent state", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "host-null-scripting-source-v1");
	assert.equal(value.predecessorCommit, hostNullScriptingPredecessor);
	assert.equal(value.implementationCommit, hostNullScriptingPinRefresh);
	assert.equal(value.externalTypeSurfacePointers, hostNullScriptingPinCount);
	assert.deepEqual(value.commits.map(commit => commit.commit)
		, hostNullScriptingCommits);
	assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
		, `${hostNullScriptingPredecessor}..${hostNullScriptingPinRefresh}`])
		.trim().split("\n"), hostNullScriptingCommits);
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, hostNullScriptingPredecessor, hostNullScriptingPinRefresh])
	, [...hostNullScriptingChangedPaths
		, ...hostNullScriptingExternalHistoryPaths].sort());
	assert.deepEqual([...new Set(value.updates.map(update => update.path))].sort()
		, [...hostNullScriptingChangedPaths].sort());
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, hostNullScriptingIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, hostNullScriptingAddedPaths);
});

test("scripting HostNull reverses every source and integration transition", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		const current = sourceAt(update.commit, update.path);
		const previous = sourceAt(update.parent, update.path);
		assert.equal(reverseHostNullScriptingUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeHostNullScriptingSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const previous = sourceAt(value.integrationParent, update.path);
		assert.equal(reverseHostNullScriptingUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeHostNullScriptingIntegrationSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("scripting HostNull authenticates every added file at its milestone", async () => {
	for(const addition of (await record()).additions)
	{
		const source = hostNullScriptingImplementationAddedPaths.includes(addition.path)
			? sourceAt(hostNullScriptingPinRefresh, addition.path)
			: await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
	}
});

test("scripting HostNull changes exactly 115 path-specific source pointers", () => {
	const before = JSON.parse(sourceAt(hostNullScriptingPinDefinition
		, "docs/type-surface.v1.json"));
	const after = JSON.parse(sourceAt(hostNullScriptingPinRefresh
		, "docs/type-surface.v1.json"));
	const counts = new Map();
	assert.equal(before.evidence.length, after.evidence.length);
	for(let index = 0; index < before.evidence.length; ++index)
	{
		const previous = before.evidence[index], current = after.evidence[index];
		assert.equal(previous.id, current.id);
		assert.equal(previous.files.length, current.files.length);
		for(let fileIndex = 0; fileIndex < previous.files.length; ++fileIndex)
		{
			const left = previous.files[fileIndex], right = current.files[fileIndex];
			assert.equal(left.path, right.path);
			if(left.sha256 === right.sha256) continue;
			assert.deepEqual({ ...left, sha256: right.sha256 }, right);
			counts.set(left.path, (counts.get(left.path) ?? 0) + 1);
		}
	}
	assert.deepEqual(Object.fromEntries(counts), hostNullScriptingPinCounts);
	assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0)
		, hostNullScriptingPinCount);
});

test("scripting HostNull refuses forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = sourceAt(update.commit, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseHostNullScriptingUpdate(current, forged));
	assert.equal(beforeHostNullScriptingSource(update.path, `${current}unknown\n`)
		, `${current}unknown\n`);
});
