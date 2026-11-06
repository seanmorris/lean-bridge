#!/usr/bin/env node
/**
 * Record the common native deferral lineage: native branch, dual-parent
 * merge, guard, browser-install and split commits, the pin refresh and the
 * newest-first registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	classifyCommonNativeDeferralEdit as classify
	, commonNativeDeferralLineageBase as base
	, commonNativeDeferralLineageBehavior as behavior
	, commonNativeDeferralLineageBrowserInstall as browserInstall
	, commonNativeDeferralLineageBrowserInstallPaths as browserInstallPaths
	, commonNativeDeferralLineageExpectationLiterals as literals
	, commonNativeDeferralLineageGuard as guard
	, commonNativeDeferralLineageGuardPaths as guardPaths
	, commonNativeDeferralLineageHistoryAdditions as historyAdditions
	, commonNativeDeferralLineageHistoryPath as historyPath
	, commonNativeDeferralLineageIntegrationPaths as integrationPaths
	, commonNativeDeferralLineageMerge as merge
	, commonNativeDeferralLineageNativeBranch as nativeBranch
	, commonNativeDeferralLineageNodeParent as nodeParent
	, commonNativeDeferralLineageOracleSeal as oracleSeal
	, commonNativeDeferralLineagePinPaths as pinPaths
	, commonNativeDeferralLineageResolutionPaths as resolutionPaths
	, commonNativeDeferralLineageSplit as split
	, commonNativeDeferralLineageSplitAdditions as splitAdditions
	, commonNativeDeferralLineageSplitPaths as splitPaths
	, commonNativeDeferralLineageStageAPaths as stageAPaths
} from "../tests/helpers/common-native-deferral-lineage-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const budget = { maximumEditBytes: 64 * 1024 * 1024 };
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const blob = (commit, path) => {
	const result = spawnSync("git", ["show", `${commit}:${path}`]
		, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	return result.status === 0 ? result.stdout : null;
};
const digest = (commit, path) => {
	const source = blob(commit, path);
	return source === null ? null : sha256(source);
};
const transitions = async (previous, current, paths) => {
	const updates = [];
	for(const path of paths)
		updates.push(await gitSourceHistoryTransition(path, previous, current
			, budget));
	return updates;
};

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-common-native-deferral-lineage-source-history.mjs");
assert.equal(existsSync(historyPath), false, "History already exists");
const pinRepair = git(["rev-parse", "HEAD"]).trim();
assert.equal(git(["rev-parse", "HEAD^"]).trim(), oracleSeal);
assert.deepEqual(names(["diff", "--name-only", oracleSeal, pinRepair, "--"])
	, [...pinPaths]);
assert.equal(git(["rev-parse", `${nativeBranch}^`]).trim(), base);
assert.equal(git(["show", "-s", "--format=%P", merge]).trim()
	, `${nativeBranch} ${nodeParent}`);
assert.equal(git(["rev-parse", `${guard}^`]).trim(), merge);
assert.equal(git(["rev-parse", `${browserInstall}^`]).trim(), guard);
assert.equal(git(["rev-parse", `${split}^`]).trim(), browserInstall);
assert.equal(git(["rev-parse", `${oracleSeal}^^`]).trim(), split);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${pinRepair}:${historyPath}`], { stdio: "ignore" }).status, 0);
// Zero semantic drift across the native line: no product, workflow, support,
// evidence or inventory change between the sealed Node state and the split.
assert.deepEqual(names(["diff", "--name-only", nodeParent, split, "--", "src"
	, "scripts", ".github", "docs", "package.json", "nix", "config"]), []);

// Stage A: the native branch over the common base.
assert.deepEqual(names(["diff", "--name-only", base, nativeBranch, "--"])
	, [...stageAPaths].sort());
const stageAUpdates = await transitions(base, nativeBranch, stageAPaths);
const editClassification = stageAUpdates.map(update => ({
	path: update.path
	, edits: update.edits.map(edit => ({
		start: edit.start, kind: classify(update.path, edit)
	}))
}));
const counts = { deferral: 0, expectation: 0, staleHistoryCheck: 0, guard: 0 };
for(const item of editClassification)
	for(const edit of item.edits) counts[edit.kind] += 1;
assert.deepEqual(counts, { ...behavior.stageAEdits });
for(const literal of literals)
	assert.notEqual(git(["grep", "-l", "-F", literal, split, "--", "src"])
		.trim(), "", literal);
const expectationSpans = stageAUpdates.flatMap(update => update.edits
	.filter(edit => classify(update.path, edit) === "expectation")
	.map(edit => edit.current)).join("\n");
for(const literal of literals)
	assert.ok(expectationSpans.includes(literal), literal);

// Merge: every path equals exactly one parent; the one dropped native change
// is kept reversible toward the native parent.
const nativeSide = names(["diff", "--name-only", nodeParent, merge, "--"]);
const nodeSide = names(["diff", "--name-only", nativeBranch, merge, "--"]);
const parentSelection = [...new Set([...nativeSide, ...nodeSide])].sort()
	.map(path => {
		const mergeSha256 = digest(merge, path);
		const nativeParentSha256 = digest(nativeBranch, path);
		const nodeParentSha256 = digest(nodeParent, path);
		const baseSha256 = digest(base, path);
		const selectedParent = mergeSha256 === nativeParentSha256 ? "native"
			: mergeSha256 === nodeParentSha256 ? "node" : null;
		assert.notEqual(selectedParent, null, path);
		return { path, selectedParent, mergeSha256, nativeParentSha256
			, nodeParentSha256, baseSha256 };
	});
assert.deepEqual({
	native: parentSelection.filter(item => item.selectedParent === "native")
		.length
	, node: parentSelection.filter(item => item.selectedParent === "node").length
}, { ...behavior.mergePaths });
for(const item of parentSelection)
	if(item.selectedParent === "native")
		assert.equal(item.nodeParentSha256, item.baseSha256, item.path);
const dropped = parentSelection.filter(item => item.selectedParent === "node"
	&& item.nativeParentSha256 !== null
	&& item.nativeParentSha256 !== item.baseSha256).map(item => item.path);
assert.deepEqual(dropped, [...resolutionPaths]);
const nativeParentUpdates = await transitions(nativeBranch, merge
	, resolutionPaths);
const nativeExpectedDigests = resolutionPaths.map(path => ({
	path, digests: [digest(nativeBranch, path)]
}));

// Stage C: guard, browser-install and split commits.
assert.deepEqual(names(["diff", "--name-only", merge, guard, "--"])
	, [...guardPaths].sort());
assert.deepEqual(names(["diff", "--name-only", guard, browserInstall, "--"])
	, [...browserInstallPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, browserInstall, split, "--"]), [...splitPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, browserInstall, split, "--"]), [...splitAdditions].sort());
const stage = async (predecessorCommit, implementationCommit, paths) => ({
	predecessorCommit, implementationCommit
	, updates: await transitions(predecessorCommit, implementationCommit, paths)
});
const splitStage = await stage(browserInstall, split, splitPaths);
splitStage.additions = splitAdditions.map(path => ({
	path, sha256: digest(split, path)
}));
const stageC = {
	guard: await stage(merge, guard, guardPaths)
	, browserInstall: await stage(guard, browserInstall, browserInstallPaths)
	, split: splitStage
};
assert.equal(stageC.guard.updates.length + stageC.browserInstall.updates.length
	+ stageC.split.updates.length, behavior.stageCTransitions);

// Pin refresh: exactly the twenty live occurrences of the two moved files.
const pinUpdates = await transitions(oracleSeal, pinRepair, pinPaths);
const beforeInventory = blob(oracleSeal, pinPaths[0]);
const afterInventory = blob(pinRepair, pinPaths[0]);
const refreshed = {};
let expectedInventory = afterInventory;
for(const [path, count] of Object.entries(behavior.refreshedPins))
{
	const previous = digest(nodeParent, path);
	const current = digest(split, path);
	assert.equal(digest(base, path), previous, path);
	assert.equal(beforeInventory.split(previous).length - 1, count, path);
	assert.equal(afterInventory.split(current).length - 1, count, path);
	assert.equal(afterInventory.includes(previous), false, path);
	expectedInventory = expectedInventory.replaceAll(current, previous);
	refreshed[path] = { count, previous, current };
}
assert.equal(expectedInventory, beforeInventory);
for(const commit of [base, nativeBranch, nodeParent, merge, split, oracleSeal])
	assert.equal(digest(commit, pinPaths[0]) === digest(nodeParent, pinPaths[0])
		, commit !== base && commit !== nativeBranch, commit);
const exactSources = [base, nativeBranch, nodeParent, merge, split, oracleSeal
	, pinRepair].map(commit => blob(commit, exactModelPath));
assert.equal(new Set(exactSources.map(source => sha256(source))).size, 1);
const exact = JSON.parse(exactSources[0]);

const treePaths = commit => names([
	"diff-tree", "--no-commit-id", "--name-only", "-r", "-m", "--first-parent"
	, commit
]).map(path => ({ path, sha256: digest(commit, path) }));
const describe = commit => ({
	commit
	, parents: git(["show", "-s", "--format=%P", commit]).trim().split(" ")
	, subject: git(["show", "-s", "--format=%s", commit]).trim()
	, paths: treePaths(commit)
});

const directory = await mkdtemp(join(tmpdir()
	, "lean-common-native-deferral-lineage-history-"));
try
{
	const environment = {
		...process.env, GIT_INDEX_FILE: join(directory, "index")
		, GIT_AUTHOR_NAME: "Lean Bridge history writer"
		, GIT_AUTHOR_EMAIL: "history@example.invalid"
		, GIT_COMMITTER_NAME: "Lean Bridge history writer"
		, GIT_COMMITTER_EMAIL: "history@example.invalid"
		, GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z"
		, GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z"
	};
	const temporaryGit = (arguments_, options = {}) => execFileSync(
		"git", arguments_, {
			encoding: "utf8", maxBuffer: 512 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", pinRepair]);
	temporaryGit(["add", "--sparse", "--", ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", pinRepair
	], { input: "Authenticate common native deferral lineage\n" }).trim();
	const integrationUpdates = await transitions(pinRepair, integrationCommit
		, integrationPaths);
	const additions = [];
	for(const path of historyAdditions)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "common-native-deferral-lineage-v1"
		, baseCommit: base, nativeBranchCommit: nativeBranch
		, nodeParentCommit: nodeParent, mergeCommit: merge
		, guardCommit: guard, browserInstallCommit: browserInstall
		, splitCommit: split, oracleSealCommit: oracleSeal
		, pinRepairCommit: pinRepair, integrationCommit
		, lineage: [nativeBranch, merge, guard, browserInstall, split]
			.map(describe)
		, mergeResolution: "The merge kept every path at exactly one parent: the seven native-branch paths at 50a36dd, the twelve Node-deferral paths at 3c90933, and tests/retained-contract-tests.test.mjs at 3c90933, dropping the native branch's first regex guard, which re-entered as the AST guard in 238c020 and was later superseded by deferred-lane-oracle-guard-v1."
		, scope: "Authenticate the native consumer deferral and its lineage without conflating it with current-expectation repairs: the native branch over the common base with every edit classified, the dual-parent merge with the sealed Node deferral and digest-selected parent routing, the AST guard, the browser-install loader and the current/retained split, the refresh of exactly twenty live pins, and the newest-first registration. The sealed Node deferral record keeps ownership of its own transitions. No product, workflow, support cell, observation or evidence archive changes."
		, behavior
		, stageA: { predecessorCommit: base, implementationCommit: nativeBranch
			, updates: stageAUpdates, editClassification }
		, merge: { commit: merge
			, parents: { native: nativeBranch, node: nodeParent }
			, defaultRoute: "node", parentSelection, nativeParentUpdates
			, nativeExpectedDigests }
		, stageC
		, pinRepair: { commit: pinRepair, refreshed, updates: pinUpdates }
		, integrationUpdates
		, exactModel: {
			sha256: sha256(exactSources[0])
			, bytes: Buffer.byteLength(exactSources[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, inventorySha256: { before: sha256(beforeInventory)
			, after: sha256(afterInventory) }
		, validation: {
			reportedByCodex: {
				base: split
				, sparseSevenEntryWall: { tests: 189, pass: 153, skip: 36
					, fail: 0, seconds: 38.2 }
				, atOracleSeal: { tests: 189, pass: 153, skip: 36, fail: 0
					, seconds: 42.9 }
				, note: "Reported on the coordination board; not re-measured here."
			}
		}
		, changedSupportCells: 0, runtimeSemanticChanges: 0
		, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${stageAUpdates.length} native, `
		+ `${nativeParentUpdates.length} merge-resolution, `
		+ `${behavior.stageCTransitions} later, ${pinUpdates.length} pin and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
