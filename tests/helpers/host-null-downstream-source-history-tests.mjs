/**
 * Authenticate installed managed HostNull acceptance and downstream pins.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeHostNullDownstreamIntegrationSource
	, beforeHostNullDownstreamSource
	, hostNullDownstreamAddedPaths
	, hostNullDownstreamChangedPaths
	, hostNullDownstreamCommits
	, hostNullDownstreamExternalHistoryPaths
	, hostNullDownstreamHistoryPath
	, hostNullDownstreamImplementationAddedPaths
	, hostNullDownstreamIntegrationPaths
	, hostNullDownstreamPinCount
	, hostNullDownstreamPinCounts
	, hostNullDownstreamPinDefinition
	, hostNullDownstreamPinRefresh
	, hostNullDownstreamPredecessor
	, reverseHostNullDownstreamUpdate
} from "./host-null-downstream-source-history.mjs";
import { beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	hostNullDownstreamHistoryPath, "utf8"));
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);

test("downstream HostNull records every exact first-parent state", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "host-null-downstream-source-v1");
	assert.equal(value.predecessorCommit, hostNullDownstreamPredecessor);
	assert.equal(value.implementationCommit, hostNullDownstreamPinRefresh);
	assert.equal(value.externalTypeSurfacePointers, hostNullDownstreamPinCount);
	assert.deepEqual(value.commits.map(commit => commit.commit)
		, hostNullDownstreamCommits);
	assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
		, `${hostNullDownstreamPredecessor}..${hostNullDownstreamPinRefresh}`])
		.trim().split("\n"), hostNullDownstreamCommits);
	assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
		, hostNullDownstreamPredecessor, hostNullDownstreamPinRefresh])
		.trim().split("\n").sort()
	, [...hostNullDownstreamChangedPaths
		, ...hostNullDownstreamExternalHistoryPaths].sort());
	assert.deepEqual([...new Set(value.updates.map(update => update.path))].sort()
		, [...hostNullDownstreamChangedPaths].sort());
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, hostNullDownstreamIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, hostNullDownstreamAddedPaths);
});

test("downstream HostNull reverses every source and integration transition", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		const current = sourceAt(update.commit, update.path);
		const previous = sourceAt(update.parent, update.path);
		assert.equal(reverseHostNullDownstreamUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeHostNullDownstreamSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const previous = sourceAt(value.integrationParent, update.path);
		assert.equal(reverseHostNullDownstreamUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeHostNullDownstreamIntegrationSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("downstream HostNull authenticates every added file at its milestone", async () => {
	for(const addition of (await record()).additions)
	{
		const source = hostNullDownstreamImplementationAddedPaths.includes(addition.path)
			? sourceAt(hostNullDownstreamPinRefresh, addition.path)
			: await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
	}
});

test("downstream HostNull changes exactly 579 path-specific source pointers", () => {
	const before = JSON.parse(sourceAt(hostNullDownstreamPinDefinition
		, "docs/type-surface.v1.json"));
	const after = JSON.parse(sourceAt(hostNullDownstreamPinRefresh
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
	assert.deepEqual(Object.fromEntries(counts), hostNullDownstreamPinCounts);
	assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0)
		, hostNullDownstreamPinCount);
});

test("downstream HostNull refuses forged transitions", async () => {
	const update = (await record()).updates.find(item =>
		item.path !== "docs/type-surface.v1.json");
	const current = sourceAt(update.commit, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseHostNullDownstreamUpdate(current, forged));
	assert.equal(beforeHostNullDownstreamSource(update.path, `${current}unknown\n`)
		, `${current}unknown\n`);
});
