/**
 * Authenticate the workflow release-asset current-source pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220WorkflowReleaseAssetPinRefreshHistoryPath
	= "docs/evidence/vo1220-workflow-release-asset-pin-refresh-source-history-20261109.json";
export const vo1220WorkflowReleaseAssetPinRefreshPredecessor
	= "228cd1d226dd0ff8a6b615cb2da41fb6f7890910";
export const vo1220WorkflowReleaseAssetPinRefreshImplementation
	= "2f4b4edf124e6aac121bef42ada81610142c7ef0";
export const vo1220WorkflowReleaseAssetPinRefreshChangedPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const vo1220WorkflowReleaseAssetPinRefreshImplementationAddedPaths
	= Object.freeze([
		"scripts/refresh-vo1220-workflow-release-asset-pins.mjs"
	]);
export const vo1220WorkflowReleaseAssetPinRefreshImplementationPaths
	= Object.freeze([
		...vo1220WorkflowReleaseAssetPinRefreshChangedPaths
		, ...vo1220WorkflowReleaseAssetPinRefreshImplementationAddedPaths
	]);
export const vo1220WorkflowReleaseAssetPinRefreshIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220WorkflowReleaseAssetPinRefreshNormalizationPaths
	= Object.freeze([
		...vo1220WorkflowReleaseAssetPinRefreshChangedPaths
		, ...vo1220WorkflowReleaseAssetPinRefreshIntegrationPaths
	]);
export const vo1220WorkflowReleaseAssetPinRefreshHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-workflow-release-asset-pin-refresh-source-history.mjs"
		, "tests/helpers/vo1220-workflow-release-asset-pin-refresh-source-history-tests.mjs"
		, "tests/helpers/vo1220-workflow-release-asset-pin-refresh-source-history.mjs"
	]);
export const vo1220WorkflowReleaseAssetPinRefreshBehavior = Object.freeze({
	changedSupportCells: 0, runtimeSemanticChanges: 0
	, packageSemanticChanges: 0, measurementSemanticChanges: 0
	, currentSourcePaths: 18, refreshedPins: 271
	, stalePinsAfter: 0, missingPinsAfter: 0, conflictingPinsAfter: 0
});

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220WorkflowReleaseAssetPinRefreshHistoryPath, "utf8"
));

/**
 * Require the exact bounded pin refresh implementation.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220WorkflowReleaseAssetPinRefresh = sources => {
	for(const path of vo1220WorkflowReleaseAssetPinRefreshImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const script = sources[
		"scripts/refresh-vo1220-workflow-release-asset-pins.mjs"
	];
	assert.match(script
		, /const implementation = "228cd1d226dd0ff8a6b615cb2da41fb6f7890910";/u);
	assert.match(script, /paths: 18, refreshed: 271/u);
	assert.match(script, /assert\.equal\(reconciled\.refreshed, 271\)/u);
	assert.match(script, /auditCurrentSourcePins/u);
	assert.match(script, /reconcileDependentCheckedRecordSourcePins/u);
	const inventory = JSON.parse(sources["docs/type-surface.v1.json"]);
	assert.ok(Array.isArray(inventory.evidence) && inventory.evidence.length > 0);
	return { ...vo1220WorkflowReleaseAssetPinRefreshBehavior };
};

/**
 * Reverse one authenticated pin-refresh transition.
 *
 * @param source - Exact later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseVo1220WorkflowReleaseAssetPinRefreshUpdate = (
	source, update
) => {
	assert.ok(vo1220WorkflowReleaseAssetPinRefreshNormalizationPaths
		.includes(update.path));
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

/**
 * Remove only this pin refresh and its registration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220WorkflowReleaseAssetPinRefreshSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220WorkflowReleaseAssetPinRefreshNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220WorkflowReleaseAssetPinRefreshUpdate(
				current, update);
	}
	return current;
};
