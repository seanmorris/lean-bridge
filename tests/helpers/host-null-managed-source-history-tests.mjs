/**
 * Authenticate the complete .NET, Java and Kotlin HostNull source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeHostNullManagedIntegrationSource
	, beforeHostNullManagedSource
	, hostNullManagedAddedPaths
	, hostNullManagedChangedPaths
	, hostNullManagedCommits
	, hostNullManagedExternalHistoryPaths
	, hostNullManagedHistoryPath
	, hostNullManagedImplementationAddedPaths
	, hostNullManagedIntegrationPaths
	, hostNullManagedPinRefresh
	, hostNullManagedPredecessor
	, reverseHostNullManagedUpdate
} from "./host-null-managed-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();
const record = async () => JSON.parse(await readFile(hostNullManagedHistoryPath, "utf8"));
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);

test("managed HostNull records every exact first-parent state", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "host-null-managed-source-v1");
	assert.equal(value.predecessorCommit, hostNullManagedPredecessor);
	assert.equal(value.implementationCommit, hostNullManagedPinRefresh);
	assert.deepEqual(value.commits.map(commit => commit.commit), hostNullManagedCommits);
	assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
		, `${hostNullManagedPredecessor}..${hostNullManagedPinRefresh}`])
		.trim().split("\n"), hostNullManagedCommits);
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, hostNullManagedPredecessor, hostNullManagedPinRefresh])
	, [...hostNullManagedChangedPaths, ...hostNullManagedExternalHistoryPaths].sort());
	assert.deepEqual([...new Set(value.updates.map(update => update.path))].sort()
		, [...hostNullManagedChangedPaths].sort());
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, hostNullManagedIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, hostNullManagedAddedPaths);
});

test("managed HostNull reverses every source and integration transition", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		const current = sourceAt(update.commit, update.path);
		const previous = sourceAt(update.parent, update.path);
		assert.equal(reverseHostNullManagedUpdate(current, update), previous, update.path);
		assert.equal(beforeHostNullManagedSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const previous = sourceAt(value.integrationParent, update.path);
		assert.equal(reverseHostNullManagedUpdate(current, update), previous, update.path);
		assert.equal(beforeHostNullManagedIntegrationSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("managed HostNull authenticates additions at their exact milestones", async () => {
	for(const addition of (await record()).additions)
	{
		const source = hostNullManagedImplementationAddedPaths.includes(addition.path)
			? sourceAt(hostNullManagedPinRefresh, addition.path)
			: await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
	}
});

test("managed HostNull leaves its inventory transition to the lineage ledger", async () => {
	assert.ok((await record()).updates.every(update =>
		!hostNullManagedExternalHistoryPaths.includes(update.path)));
});

test("managed HostNull refuses forged transitions and preserves scope", async () => {
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, hostNullManagedPredecessor, hostNullManagedPinRefresh])
	, [...hostNullManagedChangedPaths, ...hostNullManagedExternalHistoryPaths].sort());
	const update = (await record()).updates.find(item =>
		item.path !== "docs/type-surface.v1.json");
	const current = sourceAt(update.commit, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseHostNullManagedUpdate(current, forged));
	assert.equal(beforeHostNullManagedSource(update.path, `${current}unknown\n`)
		, `${current}unknown\n`);
});
