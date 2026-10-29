/**
 * Authenticate the recovered checked-JavaScript partition 11 transitions after HostNull JavaScript.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeHostNullPartitionGapIntegrationSource
	, beforeHostNullPartitionGapSource
	, hostNullPartitionGapAddedPaths
	, hostNullPartitionGapAnchorSha256
	, hostNullPartitionGapCommits
	, hostNullPartitionGapHistoryPath
	, hostNullPartitionGapIntegrationPaths
	, hostNullPartitionGapPath
	, hostNullPartitionGapPredecessor
	, hostNullPartitionGapTargetSha256
	, reverseHostNullPartitionGapUpdate
} from "./host-null-partition-gap-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	hostNullPartitionGapHistoryPath, "utf8"
));
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);

test("HostNull partition gap records the exact first-parent partition 11 changes", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "host-null-partition-gap-source-v1");
	assert.equal(value.predecessorCommit, hostNullPartitionGapPredecessor);
	assert.equal(value.anchorSha256, hostNullPartitionGapAnchorSha256);
	assert.equal(value.targetSha256, hostNullPartitionGapTargetSha256);
	assert.deepEqual(value.updates.map(update => update.commit), hostNullPartitionGapCommits);
	assert.ok(value.updates.every(update => update.path === hostNullPartitionGapPath));
	const changes = git(["rev-list", "--first-parent", "--reverse"
		, `${hostNullPartitionGapCommits[0]}^1..${hostNullPartitionGapCommits.at(-1)}`
		, "--", hostNullPartitionGapPath]).trim().split("\n");
	assert.deepEqual(changes, hostNullPartitionGapCommits);
	for(const update of value.updates)
	{
		assert.equal(sha256(sourceAt(`${update.commit}^1`, update.path)), update.previousSha256);
		assert.equal(sha256(sourceAt(update.commit, update.path)), update.currentSha256);
	}
	assert.equal(value.updates[0].previousSha256, hostNullPartitionGapAnchorSha256);
	assert.equal(value.updates.at(-1).currentSha256, hostNullPartitionGapTargetSha256);
	for(let index = 1; index < value.updates.length; ++index)
		assert.equal(value.updates[index].previousSha256, value.updates[index - 1].currentSha256);
	assert.equal(sha256(sourceAt(hostNullPartitionGapCommits.at(-1), hostNullPartitionGapPath))
		, hostNullPartitionGapTargetSha256);
});

test("HostNull partition gap reverses every recovered transition through the hub", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = sourceAt(update.commit, update.path);
		const previous = sourceAt(`${update.commit}^1`, update.path);
		assert.equal(reverseHostNullPartitionGapUpdate(current, update), previous, update.commit);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256)
			, previous, update.commit);
	}
	const target = sourceAt(hostNullPartitionGapCommits.at(-1), hostNullPartitionGapPath);
	const anchor = beforeHostNullPartitionGapSource(hostNullPartitionGapPath, target);
	assert.equal(sha256(anchor), hostNullPartitionGapAnchorSha256);
	assert.equal(sha256(await sourceAtFinHistoryMilestone(hostNullPartitionGapPath
		, hostNullPartitionGapAnchorSha256)), hostNullPartitionGapAnchorSha256);
	assert.ok(finRefinementNormalizationPaths.includes(hostNullPartitionGapPath));
});

test("HostNull partition gap additions and newest-first registration are exact", async () => {
	const value = await record();
	assert.deepEqual(value.additions.map(item => item.path), hostNullPartitionGapAddedPaths);
	for(const addition of value.additions)
	{
		assert.equal(git(["ls-tree", "--name-only", hostNullPartitionGapPredecessor
			, "--", addition.path]).trim(), "");
		assert.equal(sha256(await sourceAtFinHistoryMilestone(addition.path
			, addition.currentSha256)), addition.currentSha256, addition.path);
	}
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, hostNullPartitionGapIntegrationPaths);
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const previous = sourceAt(hostNullPartitionGapPredecessor, update.path);
		assert.equal(reverseHostNullPartitionGapUpdate(current, update), previous, update.path);
		assert.equal(beforeHostNullPartitionGapIntegrationSource(update.path, current
			, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256)
			, previous, update.path);
	}
});

test("HostNull partition gap changes no test import, assertion, record or product source", async () => {
	const value = await record();
	const partition = value.integrationUpdates.find(update =>
		update.path === hostNullPartitionGapPath);
	for(const edit of partition.edits) assert.equal(edit.previous, "");
	assert.deepEqual(partition.edits.map(edit => edit.current)
		, ["import \"./helpers/host-null-partition-gap-source-history-tests.mjs\";\n"]);
	const hub = value.integrationUpdates.find(update =>
		update.path !== hostNullPartitionGapPath);
	const lines = text => text.split("\n");
	const count = list => list.reduce((map, line) =>
		map.set(line, (map.get(line) ?? 0) + 1), new Map());
	const difference = (left, right) => {
		const remaining = count(right);
		return left.filter(line => {
			const available = remaining.get(line) ?? 0;
			remaining.set(line, available - 1);
			return available <= 0;
		});
	};
	const before = lines(sourceAt(hostNullPartitionGapPredecessor, hub.path));
	const after = lines(await sourceAtFinHistoryMilestone(hub.path, hub.currentSha256));
	assert.deepEqual(difference(before, after).sort(), [
		"\t...npmRuntimeDefaultValueCopyRepairNormalizationPaths"
		, "\tlet stage = beforeNpmRuntimeDefaultValueCopyRepairSource(path, text, expected);"
	]);
	const scaffold = new Set([
		"\tif(expected !== undefined && sha256(stage) === expected)"
		, "\t\treturn stage;"
		, "\ttext = stage;"
		, "\tstage = beforeNpmRuntimeDefaultValueCopyRepairSource(path, text, expected);"
		, "\t, ...npmRuntimeDefaultValueCopyRepairNormalizationPaths"
		, "\t// The recovered HostNull PHP and promotion partition transitions"
			+ " precede the npm repair."
	]);
	for(const line of difference(after, before))
		assert.ok(/[Hh]ostNullPartitionGap/u.test(line) || scaffold.has(line), line);
});

test("HostNull partition gap rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = sourceAt(update.commit, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseHostNullPartitionGapUpdate(current, forged));
	assert.equal(beforeHostNullPartitionGapSource(update.path, `${current}unknown\n`)
		, `${current}unknown\n`);
	assert.equal(beforeHostNullPartitionGapSource("unknown.mjs", current), current);
});
