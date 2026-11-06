/**
 * Preserve the common native deferral lineage: the native branch, its merge
 * with the sealed Node deferral, and the three guard and split commits.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeDeferredLaneOracleGuardSource }
	from "./deferred-lane-oracle-guard-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const commonNativeDeferralLineageHistoryPath
	= "docs/evidence/common-native-deferral-lineage-source-history-20261106.json";
export const commonNativeDeferralLineageBase
	= "48db6f6d05cffe6deb9372ee97b544e00e036c4c";
export const commonNativeDeferralLineageNativeBranch
	= "50a36dde0a7486c60e84b86a4f70600ef739f998";
export const commonNativeDeferralLineageNodeParent
	= "3c90933657db89b638687e4df425485c106ebeb1";
export const commonNativeDeferralLineageMerge
	= "1f6628ea59c27cb0f8e81a9d0e25ab0b78bbc1d4";
export const commonNativeDeferralLineageGuard
	= "238c02004036390d1daf9b1e093acbcdf95e012a";
export const commonNativeDeferralLineageBrowserInstall
	= "afbf9998eb32873fbd50d2f5b13ec93701cc3eb8";
export const commonNativeDeferralLineageSplit
	= "1fa9c39e8d994847ff1c4ae70e21bda945ed82e3";
export const commonNativeDeferralLineageOracleSeal
	= "66168b1918d1f9da0eb19fcf9f0da60dd7599650";
export const commonNativeDeferralLineageStageAPaths = Object.freeze([
	"tests/helpers/fin-record-wit-format-tests.mjs"
	, "tests/helpers/fin-record-zero-ci-tests.mjs"
	, "tests/helpers/structural-subtype-runtime-tests.mjs"
	, "tests/native-fin-callbacks.test.mjs"
	, "tests/native-fin-record-zero.test.mjs"
	, "tests/native-fin-records.test.mjs"
	, "tests/native-subtype.test.mjs"
	, "tests/retained-contract-tests.test.mjs"
]);
export const commonNativeDeferralLineageResolutionPaths = Object.freeze([
	"tests/retained-contract-tests.test.mjs"
]);
export const commonNativeDeferralLineageGuardPaths = Object.freeze([
	"tests/retained-contract-tests.test.mjs"
]);
export const commonNativeDeferralLineageBrowserInstallPaths = Object.freeze([
	"tests/generic-records.test.mjs"
	, "tests/helpers/bounded-apt-tests.mjs"
	, "tests/retained-contract-tests.test.mjs"
]);
export const commonNativeDeferralLineageSplitPaths = Object.freeze([
	"tests/helpers/fin-nominal-refusals-tests.mjs"
	, "tests/helpers/native-fin-diagnostic-tests.mjs"
	, "tests/helpers/native-fin-nix-boundary-tests.mjs"
	, "tests/helpers/native-fin-reply-promotion-tests.mjs"
	, "tests/helpers/native-fin-reply-review-tests.mjs"
	, "tests/native-fin-callbacks.test.mjs"
	, "tests/native-fin-records.test.mjs"
	, "tests/retained-contract-tests.test.mjs"
]);
export const commonNativeDeferralLineageSplitAdditions = Object.freeze([
	"tests/helpers/native-fin-diagnostic-evidence-tests.mjs"
	, "tests/helpers/native-fin-nix-boundary-history-tests.mjs"
	, "tests/helpers/native-fin-reply-promotion-current-tests.mjs"
	, "tests/helpers/native-fin-reply-review-current-tests.mjs"
]);
export const commonNativeDeferralLineagePinPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const commonNativeDeferralLineageIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const commonNativeDeferralLineageHistoryAdditions = Object.freeze([
	"scripts/update-common-native-deferral-lineage-source-history.mjs"
	, "tests/helpers/common-native-deferral-lineage-source-history-tests.mjs"
	, "tests/helpers/common-native-deferral-lineage-source-history.mjs"
]);
export const commonNativeDeferralLineageNormalizationPaths
	= Object.freeze([...new Set([
		...commonNativeDeferralLineageStageAPaths
		, ...commonNativeDeferralLineageResolutionPaths
		, ...commonNativeDeferralLineageGuardPaths
		, ...commonNativeDeferralLineageBrowserInstallPaths
		, ...commonNativeDeferralLineageSplitPaths
		, ...commonNativeDeferralLineagePinPaths
		, ...commonNativeDeferralLineageIntegrationPaths
	])].sort());
// Current-expectation repairs bundled into the native branch, each literal a
// product string at the split commit; never counted as deferral.
export const commonNativeDeferralLineageExpectationLiterals = Object.freeze([
	"invalid Subtype refinement"
	, "checked Subtype refinements require a top-level or structural-container"
		+ " parameter or result"
	, "_lb_checked", "_lb_budget", "_root_.Subtype.val"
]);
export const commonNativeDeferralLineageBehavior = Object.freeze({
	stageAEdits: Object.freeze({
		deferral: 18, expectation: 10, staleHistoryCheck: 2, guard: 3
	})
	, mergePaths: Object.freeze({ native: 7, node: 12 })
	, resolutionPaths: 1, stageCTransitions: 12, splitAdditions: 4
	, refreshedPins: Object.freeze({
		"tests/generic-records.test.mjs": 12
		, "tests/native-subtype.test.mjs": 8
	})
	, changedSupportCells: 0, runtimeSemanticChanges: 0
});

let history;
const record = () => history ??= JSON.parse(readFileSync(
	commonNativeDeferralLineageHistoryPath, "utf8"));
const deferralEdit
	= /registerRetainedContractTests|=> import\(|^import |\nimport /u;

/**
 * Classify one native-branch edit: loader registration and import moves are
 * deferral; the stale digest-gated checks of the Fin 0 CI suite and the
 * first regex guard are named for what they are; everything else repaired a
 * current expectation.
 *
 * @param path - Repository-relative source path.
 * @param edit - Recorded edit with previous and current spans.
 */
export const classifyCommonNativeDeferralEdit = (path, edit) => {
	if(commonNativeDeferralLineageGuardPaths.includes(path)) return "guard";
	if(deferralEdit.test(`${edit.current}\n${edit.previous}`)) return "deferral";
	return path === "tests/helpers/fin-record-zero-ci-tests.mjs"
		? "staleHistoryCheck" : "expectation";
};

/**
 * Reverse one exact authenticated transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseCommonNativeDeferralLineageUpdate = (source, update) => {
	assert.ok(commonNativeDeferralLineageNormalizationPaths.includes(update.path)
		, update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

const reverseMatching = (path, source, updates) => {
	const digest = sha256(source);
	const update = updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update === undefined ? source
		: reverseCommonNativeDeferralLineageUpdate(source, update);
};

/**
 * Walk the lineage newest-first: this seal's registration and pin refresh,
 * the oracle seal's own edits, the split, browser-install and guard commits,
 * the merge, then the native branch. At the merge a path whose source equals
 * the merge result is routed to the Node parent (the sealed Node deferral
 * continues to the base) unless the requested digest belongs to the native
 * parent, in which case the dropped native change is restored exactly.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeCommonNativeDeferralLineageSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !commonNativeDeferralLineageNormalizationPaths.includes(path))
		return source;
	const value = record();
	let current = source;
	const reached = () => expected !== undefined && sha256(current) === expected;
	for(const updates of [value.integrationUpdates, value.pinRepair.updates])
	{
		if(reached()) return current;
		current = reverseMatching(path, current, updates);
	}
	if(reached()) return current;
	// The oracle seal's own edits sit between this seal's registration and the
	// split commit, so they are removed here, after the C2 and C1 edits and
	// before any native transition can match.
	current = beforeDeferredLaneOracleGuardSource(path, current, expected);
	for(const updates of [
		value.stageC.split.updates, value.stageC.browserInstall.updates
		, value.stageC.guard.updates
	]) {
		if(reached()) return current;
		current = reverseMatching(path, current, updates);
	}
	if(reached()) return current;
	const nativeDigests = value.merge.nativeExpectedDigests
		.find(item => item.path === path)?.digests ?? [];
	if(expected !== undefined && nativeDigests.includes(expected))
		current = reverseMatching(path, current, value.merge.nativeParentUpdates);
	if(reached()) return current;
	return reverseMatching(path, current, value.stageA.updates);
};
