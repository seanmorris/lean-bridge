/**
 * Authenticate the common native deferral lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeCommonNativeDeferralLineageSource
	, classifyCommonNativeDeferralEdit
	, commonNativeDeferralLineageBase
	, commonNativeDeferralLineageBehavior
	, commonNativeDeferralLineageBrowserInstall
	, commonNativeDeferralLineageExpectationLiterals
	, commonNativeDeferralLineageGuard
	, commonNativeDeferralLineageHistoryAdditions
	, commonNativeDeferralLineageHistoryPath
	, commonNativeDeferralLineageIntegrationPaths
	, commonNativeDeferralLineageMerge
	, commonNativeDeferralLineageNativeBranch
	, commonNativeDeferralLineageNodeParent
	, commonNativeDeferralLineageNormalizationPaths
	, commonNativeDeferralLineageOracleSeal
	, commonNativeDeferralLineageResolutionPaths
	, commonNativeDeferralLineageSplit
	, commonNativeDeferralLineageSplitAdditions
	, commonNativeDeferralLineageStageAPaths
	, reverseCommonNativeDeferralLineageUpdate
} from "./common-native-deferral-lineage-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const blob = (commit, path) => {
	const result = spawnSync("git", ["show", `${commit}:${path}`]
		, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	return result.status === 0 ? result.stdout : null;
};
const record = async () => JSON.parse(await readFile(
	commonNativeDeferralLineageHistoryPath, "utf8"));
const base = commonNativeDeferralLineageBase;
const nativeBranch = commonNativeDeferralLineageNativeBranch;
const nodeParent = commonNativeDeferralLineageNodeParent;
const merge = commonNativeDeferralLineageMerge;
const guard = commonNativeDeferralLineageGuard;
const browserInstall = commonNativeDeferralLineageBrowserInstall;
const split = commonNativeDeferralLineageSplit;
const oracleSeal = commonNativeDeferralLineageOracleSeal;
const inventoryPath = "docs/type-surface.v1.json";

test("common native lineage records every commit, parent and classification", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "common-native-deferral-lineage-v1");
	assert.equal(git(["rev-parse", `${nativeBranch}^`]).trim(), base);
	assert.equal(git(["show", "-s", "--format=%P", merge]).trim()
		, `${nativeBranch} ${nodeParent}`);
	assert.equal(git(["rev-parse", `${guard}^`]).trim(), merge);
	assert.equal(git(["rev-parse", `${browserInstall}^`]).trim(), guard);
	assert.equal(git(["rev-parse", `${split}^`]).trim(), browserInstall);
	assert.equal(git(["rev-parse", `${oracleSeal}^^`]).trim(), split);
	assert.equal(git(["rev-parse", `${value.pinRepairCommit}^`]).trim()
		, oracleSeal);
	assert.deepEqual(value.lineage.map(item => item.commit)
		, [nativeBranch, merge, guard, browserInstall, split]);
	assert.deepEqual(value.lineage[1].parents, [nativeBranch, nodeParent]);
	assert.deepEqual(value.merge.parents, { native: nativeBranch
		, node: nodeParent });
	assert.equal(value.merge.defaultRoute, "node");
	assert.deepEqual(value.behavior, { ...commonNativeDeferralLineageBehavior
		, stageAEdits: { ...commonNativeDeferralLineageBehavior.stageAEdits }
		, mergePaths: { ...commonNativeDeferralLineageBehavior.mergePaths }
		, refreshedPins: { ...commonNativeDeferralLineageBehavior.refreshedPins }
	});
	assert.deepEqual(value.stageA.updates.map(item => item.path)
		, commonNativeDeferralLineageStageAPaths);
	const counts = { deferral: 0, expectation: 0, staleHistoryCheck: 0
		, guard: 0 };
	for(const [index, item] of value.stageA.editClassification.entries())
	{
		const update = value.stageA.updates[index];
		assert.equal(item.path, update.path);
		assert.deepEqual(item.edits.map(edit => edit.start)
			, update.edits.map(edit => edit.start), item.path);
		for(const [position, edit] of item.edits.entries())
		{
			assert.equal(edit.kind, classifyCommonNativeDeferralEdit(
				item.path, update.edits[position]), item.path);
			counts[edit.kind] += 1;
		}
	}
	assert.deepEqual(counts
		, { ...commonNativeDeferralLineageBehavior.stageAEdits });
	for(const literal of commonNativeDeferralLineageExpectationLiterals)
		assert.notEqual(git(["grep", "-l", "-F", literal, split, "--", "src"])
			.trim(), "", literal);
	assert.equal(value.changedSupportCells, 0);
	assert.equal(value.runtimeSemanticChanges, 0);
	assert.deepEqual(git(["diff", "--name-only", nodeParent, split, "--", "src"
		, "scripts", ".github", "docs", "package.json"]).trim(), "");
});

test("common native lineage keeps every merged path at exactly one parent", async () => {
	const value = await record();
	const selection = value.merge.parentSelection;
	assert.deepEqual({
		native: selection.filter(item => item.selectedParent === "native").length
		, node: selection.filter(item => item.selectedParent === "node").length
	}, { ...commonNativeDeferralLineageBehavior.mergePaths });
	for(const item of selection)
	{
		const mergeSource = blob(merge, item.path);
		assert.equal(sha256(mergeSource), item.mergeSha256, item.path);
		const chosen = item.selectedParent === "native" ? nativeBranch
			: nodeParent;
		assert.equal(blob(chosen, item.path), mergeSource, item.path);
		if(item.selectedParent === "native")
			assert.equal(item.nodeParentSha256, item.baseSha256, item.path);
	}
	assert.deepEqual(value.merge.nativeParentUpdates.map(item => item.path)
		, commonNativeDeferralLineageResolutionPaths);
	for(const [path] of commonNativeDeferralLineageResolutionPaths.entries())
	{
		const item = selection.find(entry => entry.path
			=== commonNativeDeferralLineageResolutionPaths[path]);
		assert.equal(item.selectedParent, "node");
		assert.notEqual(item.nativeParentSha256, item.baseSha256);
		assert.deepEqual(value.merge.nativeExpectedDigests[path]
			, { path: item.path, digests: [item.nativeParentSha256] });
	}
});

test("common native lineage reaches every endpoint of every path through the hub", async () => {
	const value = await record();
	const commits = [base, nativeBranch, nodeParent, merge, guard
		, browserInstall, split, oracleSeal];
	const paths = commonNativeDeferralLineageNormalizationPaths
		.filter(path => path !== inventoryPath);
	let reached = 0;
	for(const path of paths)
	{
		const live = await readFile(path, "utf8");
		for(const commit of commits)
		{
			const expected = blob(commit, path);
			if(expected === null) continue;
			assert.equal(beforeFinRefinementSource(path, live, sha256(expected))
				, expected, `${path} @ ${commit.slice(0, 7)}`);
			reached += 1;
		}
	}
	assert.ok(reached >= 100, String(reached));
	const liveInventory = await readFile(inventoryPath, "utf8");
	for(const commit of [base, nodeParent, split, oracleSeal])
	{
		const expected = blob(commit, inventoryPath);
		assert.equal(beforeFinRefinementSource(inventoryPath, liveInventory
			, sha256(expected)), expected, commit.slice(0, 7));
	}
	for(const path of commonNativeDeferralLineageSplitAdditions)
	{
		assert.equal(blob(browserInstall, path), null, path);
		assert.equal(sha256(blob(split, path)), value.stageC.split.additions
			.find(item => item.path === path).sha256, path);
	}
});

test("common native lineage routes the merge by requested digest", async () => {
	const value = await record();
	const [path] = commonNativeDeferralLineageResolutionPaths;
	const mergeSource = blob(merge, path);
	const nativeSource = blob(nativeBranch, path);
	const baseSource = blob(base, path);
	assert.equal(beforeCommonNativeDeferralLineageSource(path, mergeSource
		, sha256(nativeSource)), nativeSource);
	assert.equal(beforeCommonNativeDeferralLineageSource(path, mergeSource)
		, mergeSource);
	assert.equal(beforeFinRefinementSource(path, mergeSource
		, sha256(baseSource)), baseSource);
	for(const item of value.merge.parentSelection)
	{
		if(item.selectedParent !== "native") continue;
		const source = blob(merge, item.path);
		assert.equal(beforeCommonNativeDeferralLineageSource(item.path, source)
			, blob(base, item.path), item.path);
	}
});

test("common native lineage refreshes twenty pins and no model cell", async () => {
	const value = await record();
	const before = blob(oracleSeal, inventoryPath);
	const after = blob(value.pinRepairCommit, inventoryPath);
	let restored = after;
	for(const [path, entry] of Object.entries(value.pinRepair.refreshed))
	{
		assert.equal(entry.count
			, commonNativeDeferralLineageBehavior.refreshedPins[path], path);
		assert.equal(entry.previous, sha256(blob(nodeParent, path)), path);
		assert.equal(entry.current, sha256(blob(split, path)), path);
		assert.equal(after.split(entry.current).length - 1, entry.count, path);
		assert.equal(after.includes(entry.previous), false, path);
		restored = restored.replaceAll(entry.current, entry.previous);
	}
	assert.equal(restored, before);
	assert.deepEqual(value.inventorySha256, { before: sha256(before)
		, after: sha256(after) });
	assert.equal(sha256(blob(nodeParent, inventoryPath)), sha256(before));
	assert.deepEqual(value.exactModel, {
		sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
		, bytes: 16916757, cells: 1054, stageEntries: 5270
	});
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryRecordSource(
			commonNativeDeferralLineageHistoryPath, update.path
			, update.currentSha256);
		const previous = blob(value.pinRepairCommit, update.path);
		assert.equal(reverseCommonNativeDeferralLineageUpdate(current, update)
			, previous, update.path);
	}
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, commonNativeDeferralLineageIntegrationPaths);
	for(const path of commonNativeDeferralLineageNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("common native lineage rejects forgeries and another writer", async () => {
	const value = await record();
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, commonNativeDeferralLineageHistoryAdditions);
	for(const addition of value.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = value.stageA.updates[0];
	const current = blob(nativeBranch, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseCommonNativeDeferralLineageUpdate(current
		, forged));
	assert.equal(beforeCommonNativeDeferralLineageSource(update.path
		, `${current}unknown\n`), `${current}unknown\n`);
	assert.equal(beforeCommonNativeDeferralLineageSource("unknown.mjs", current)
		, current);
	const result = spawnSync(process.execPath, [
		"scripts/update-common-native-deferral-lineage-source-history.mjs"
	], { encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /History already exists/u);
});
