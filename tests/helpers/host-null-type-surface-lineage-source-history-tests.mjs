/**
 * Authenticate the recovered type-surface transitions on the combined HostNull lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforeHostNullTypeSurfaceLineageIntegrationSource
	, beforeHostNullTypeSurfaceLineageSource
	, hostNullTypeSurfaceLineageAddedPaths
	, hostNullTypeSurfaceLineageAnchorSha256
	, hostNullTypeSurfaceLineageCommits
	, hostNullTypeSurfaceLineageHistoryPath
	, hostNullTypeSurfaceLineageIntegrationPaths
	, hostNullTypeSurfaceLineagePath
	, hostNullTypeSurfaceLineagePinCounts
	, hostNullTypeSurfaceLineagePredecessor
	, hostNullTypeSurfaceLineageTargetSha256
	, reverseHostNullTypeSurfaceLineageUpdate
} from "./host-null-type-surface-lineage-source-history.mjs";
import {
	npmRuntimeDefaultValueCopyRepairHistoryPath
} from "./npm-runtime-default-value-copy-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	hostNullTypeSurfaceLineageHistoryPath, "utf8"
));
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);
const blobDigest = (commit, path) => execFileSync("sh"
	, ["-c", "git show \"$1\" | sha256sum", "sh", `${commit}:${path}`]
	, { encoding: "utf8" }).slice(0, 64);
const digestPattern = /[0-9a-f]{64}/gu;

test("HostNull type-surface lineage records the exact first-parent type-surface changes", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "host-null-type-surface-lineage-source-v1");
	assert.equal(value.predecessorCommit, hostNullTypeSurfaceLineagePredecessor);
	assert.equal(value.anchorSha256, hostNullTypeSurfaceLineageAnchorSha256);
	assert.equal(value.targetSha256, hostNullTypeSurfaceLineageTargetSha256);
	assert.deepEqual(value.updates.map(update => update.commit), hostNullTypeSurfaceLineageCommits);
	assert.ok(value.updates.every(update => update.path === hostNullTypeSurfaceLineagePath));
	const changes = git(["rev-list", "--first-parent", "--reverse"
		, `${hostNullTypeSurfaceLineageCommits[0]}^1..${hostNullTypeSurfaceLineagePredecessor}`
		, "--", hostNullTypeSurfaceLineagePath]).trim().split("\n");
	assert.deepEqual(changes, hostNullTypeSurfaceLineageCommits);
	for(const update of value.updates)
	{
		assert.equal(blobDigest(`${update.commit}^1`, update.path), update.previousSha256);
		assert.equal(blobDigest(update.commit, update.path), update.currentSha256);
	}
	assert.equal(value.updates[0].previousSha256, hostNullTypeSurfaceLineageAnchorSha256);
	assert.equal(value.updates.at(-1).currentSha256, hostNullTypeSurfaceLineageTargetSha256);
	for(let index = 1; index < value.updates.length; ++index)
		assert.equal(value.updates[index].previousSha256, value.updates[index - 1].currentSha256);
	assert.equal(blobDigest(hostNullTypeSurfaceLineagePredecessor, hostNullTypeSurfaceLineagePath)
		, hostNullTypeSurfaceLineageTargetSha256);
});

test("HostNull type-surface lineage authenticates every recovered transition and its hub position", async () => {
	const value = await record();
	for(const update of value.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(update.commit
			, update.path), update), true, update.commit);
	assert.ok(finRefinementNormalizationPaths.includes(hostNullTypeSurfaceLineagePath));
	const hub = await readFile("tests/helpers/fin-refinement-source-history.mjs", "utf8");
	const order = ["beforeHostNullTypeSurfaceLineageIntegrationSource(path"
		, "beforeHostNullPartitionGapIntegrationSource(path"
		, "beforeNpmRuntimeDefaultValueCopyRepairSource(path"
		, "beforeHostNullTypeSurfaceLineageSource(path"
		, "beforeHostNullPartitionGapSource(path"
		, "beforeHostNullJavaScriptSource(path"].map(name => hub.indexOf(name));
	assert.ok(order.every(index => index > 0), String(order));
	assert.deepEqual([...order].sort((left, right) => left - right), order);
});

test("HostNull type-surface lineage edits only pins with the recorded counts", async () => {
	const value = await record();
	for(const [index, update] of value.updates.entries())
	{
		let pins = 0;
		for(const edit of update.edits)
		{
			assert.equal(edit.current.replace(digestPattern, "")
				, edit.previous.replace(digestPattern, ""), update.commit);
			pins += edit.current.match(digestPattern).length;
		}
		assert.equal(pins, hostNullTypeSurfaceLineagePinCounts[index], update.commit);
	}
	const npm = value.updates[1];
	const repaired = blobDigest(npm.commit, "src/release/component-npm-package.mjs");
	for(const edit of npm.edits)
		for(const digest of edit.current.match(digestPattern)) assert.equal(digest, repaired);
});

test("HostNull type-surface lineage additions and newest-first registration are exact", async () => {
	const value = await record();
	assert.deepEqual(value.additions.map(item => item.path), hostNullTypeSurfaceLineageAddedPaths);
	for(const addition of value.additions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, hostNullTypeSurfaceLineagePredecessor, "--", addition.path]).trim(), "");
		assert.equal(sha256(await sourceAtFinHistoryMilestone(addition.path
			, addition.currentSha256)), addition.currentSha256, addition.path);
	}
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, hostNullTypeSurfaceLineageIntegrationPaths);
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const previous = sourceAt(hostNullTypeSurfaceLineagePredecessor, update.path);
		assert.equal(reverseHostNullTypeSurfaceLineageUpdate(current, update), previous, update.path);
		assert.equal(beforeHostNullTypeSurfaceLineageIntegrationSource(update.path, current
			, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256)
			, previous, update.path);
	}
});

test("HostNull type-surface lineage retains the committed npm record and changes no product source", async () => {
	assert.equal(sha256(await readFile(npmRuntimeDefaultValueCopyRepairHistoryPath))
		, blobDigest(hostNullTypeSurfaceLineagePredecessor, npmRuntimeDefaultValueCopyRepairHistoryPath));
	const value = await record();
	const partition = value.integrationUpdates.find(update =>
		update.path === "tests/checked-javascript-partition-11.test.mjs");
	assert.deepEqual(partition.edits.map(edit => [edit.previous, edit.current])
		, [["", "import \"./helpers/host-null-type-surface-lineage-source-history-tests.mjs\";\n"]]);
	for(const update of value.updates)
		assert.deepEqual(git(["diff", "--name-only", `${update.commit}^1`, update.commit])
			.trim().split("\n"), [hostNullTypeSurfaceLineagePath], update.commit);
});

test("HostNull type-surface lineage rejects forged transitions", async () => {
	const update = (await record()).updates[1];
	const forgedSource = "unknown\n";
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseHostNullTypeSurfaceLineageUpdate(forgedSource, forged));
	assert.equal(beforeHostNullTypeSurfaceLineageSource(update.path, forgedSource), forgedSource);
	assert.equal(beforeHostNullTypeSurfaceLineageSource("unknown.mjs", forgedSource), forgedSource);
});
