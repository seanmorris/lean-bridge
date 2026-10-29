/**
 * Authenticate the complete C, C++, Rust and WIT/WASI HostNull source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeHostNullSystemsIntegrationSource
	, beforeHostNullSystemsSource
	, hostNullSystemsAddedPaths
	, hostNullSystemsChangedPaths
	, hostNullSystemsCommits
	, hostNullSystemsExternalHistoryPaths
	, hostNullSystemsHistoryPath
	, hostNullSystemsImplementationAddedPaths
	, hostNullSystemsIntegrationPaths
	, hostNullSystemsPinCount
	, hostNullSystemsPinCounts
	, hostNullSystemsPinRefresh
	, hostNullSystemsPredecessor
	, reverseHostNullSystemsUpdate
} from "./host-null-systems-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();
const record = async () => JSON.parse(await readFile(hostNullSystemsHistoryPath, "utf8"));
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);

test("systems HostNull records every exact first-parent state", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "host-null-systems-source-v1");
	assert.equal(value.predecessorCommit, hostNullSystemsPredecessor);
	assert.equal(value.implementationCommit, hostNullSystemsPinRefresh);
	assert.deepEqual(value.commits.map(commit => commit.commit), hostNullSystemsCommits);
	assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
		, `${hostNullSystemsPredecessor}..${hostNullSystemsPinRefresh}`])
		.trim().split("\n"), hostNullSystemsCommits);
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, hostNullSystemsPredecessor, hostNullSystemsPinRefresh])
	, [...hostNullSystemsChangedPaths, ...hostNullSystemsExternalHistoryPaths].sort());
	assert.deepEqual([...new Set(value.updates.map(update => update.path))].sort()
		, [...hostNullSystemsChangedPaths].sort());
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, hostNullSystemsIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, hostNullSystemsAddedPaths);
});

test("systems HostNull reverses every source and integration transition", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		const current = sourceAt(update.commit, update.path);
		const previous = sourceAt(update.parent, update.path);
		assert.equal(reverseHostNullSystemsUpdate(current, update), previous, update.path);
		assert.equal(beforeHostNullSystemsSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const previous = sourceAt(value.integrationParent, update.path);
		assert.equal(reverseHostNullSystemsUpdate(current, update), previous, update.path);
		assert.equal(beforeHostNullSystemsIntegrationSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("systems HostNull authenticates additions and its exact pin budget", async () => {
	for(const addition of (await record()).additions)
	{
		const source = hostNullSystemsImplementationAddedPaths.includes(addition.path)
			? sourceAt(hostNullSystemsPinRefresh, addition.path)
			: await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
	}
	assert.equal(Object.values(hostNullSystemsPinCounts)
		.reduce((sum, count) => sum + count, 0), hostNullSystemsPinCount);
	assert.equal(hostNullSystemsPinCount, 308);
});

test("systems HostNull leaves its inventory transition to the lineage ledger", async () => {
	assert.ok((await record()).updates.every(update =>
		!hostNullSystemsExternalHistoryPaths.includes(update.path)));
});

test("systems HostNull refuses forged transitions and preserves scope", async () => {
	const update = (await record()).updates[0];
	const current = sourceAt(update.commit, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseHostNullSystemsUpdate(current, forged));
	assert.equal(beforeHostNullSystemsSource(update.path, `${current}unknown\n`)
		, `${current}unknown\n`);
});
