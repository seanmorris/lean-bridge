/**
 * Authenticate the bounded nested-promotion cell-expansion repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220NestedPromotionMemoryBoundHistoryPath
	= "docs/evidence/vo1220-nested-promotion-memory-bound-source-history-20261108.json";
export const vo1220NestedPromotionMemoryBoundPredecessor
	= "0f0f168cacfa0b939bcaed09a158906456c279d4";
export const vo1220NestedPromotionMemoryBoundImplementation
	= "f41031c5492311c7ae8c8a109486d8a74dad2ae5";
export const vo1220NestedPromotionMemoryBoundImplementationPaths
	= Object.freeze([
		"tests/helpers/nested-checked-record-native-promotion-tests.mjs"
		, "tests/helpers/nested-checked-record-python-promotion-tests.mjs"
		, "tests/helpers/recursive-checked-record-promotion-tests.mjs"
		, "tests/nested-checked-record-history-partition-05.test.mjs"
	]);
export const vo1220NestedPromotionMemoryBoundIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220NestedPromotionMemoryBoundHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-nested-promotion-memory-bound-source-history.mjs"
		, "tests/helpers/vo1220-nested-promotion-memory-bound-source-history-tests.mjs"
		, "tests/helpers/vo1220-nested-promotion-memory-bound-source-history.mjs"
	]);
export const vo1220NestedPromotionMemoryBoundBehavior = Object.freeze({
	promotionSuites: 3, boundedCellExpansions: 6
	, selectedCells: 200, wholeObservationGuards: 3
	, changedSupportCells: 0, runtimeSemanticChanges: 0
});

const historyUrl = new URL("../../"
	+ vo1220NestedPromotionMemoryBoundHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const vo1220NestedPromotionMemoryBoundNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: vo1220NestedPromotionMemoryBoundImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path)
			: vo1220NestedPromotionMemoryBoundIntegrationPaths)
	])].sort());

/**
 * Require the exact bounded-expansion and no-other-change controls.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220NestedPromotionMemoryBound = sources => {
	for(const path of vo1220NestedPromotionMemoryBoundImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const native = sources[
		"tests/helpers/nested-checked-record-native-promotion-tests.mjs"];
	const python = sources[
		"tests/helpers/nested-checked-record-python-promotion-tests.mjs"];
	const recursive = sources[
		"tests/helpers/recursive-checked-record-promotion-tests.mjs"];
	const audit = sources[
		"tests/nested-checked-record-history-partition-05.test.mjs"];
	for(const [path, source] of Object.entries({ native, python, recursive }))
	{
		assert.equal(source.split("typeSurfaceCells(").length - 1, 2, path);
		assert.equal(source.split(", contracts, selected)").length - 1, 2, path);
		assert.match(source, /cell\.shape === "checked-record"/u, path);
		assert.match(source
			, /\["ordinary-source", "reviewed-ir"\]\.includes\(cell\.path\)/u
			, path);
		assert.match(source, /const stableSurface = /u, path);
		assert.match(source, /const affectedObservations = /u, path);
	}
	assert.match(native, /nestedCheckedRecordNativeProfiles\.includes\(cell\.profile\)/u);
	assert.match(native, /const changedExistingIndexes = original\.observations/u);
	assert.match(native
		, /const addedObservations = promoted\.observations\.slice/u);
	assert.match(python, /cell\.profile === "python"/u);
	assert.match(python, /const changedExistingIndexes = original\.observations/u);
	assert.match(python
		, /const addedObservations = proposed\.observations\.slice/u);
	assert.match(recursive, /expectedProfiles\.includes\(cell\.profile\)/u);
	assert.match(recursive, /assert\.equal\(changedObservations\.length, 102\)/u);
	assert.match(recursive, /liveEvidenceIds\.has\(item\.id\)/u);
	assert.doesNotMatch(recursive, /assert\.deepEqual\(current, milestone\)/u);
	assert.match(audit, /const boundedCellExpansionPaths = \[/u);
	assert.match(audit
		, /assert\.equal\(source\.split\("typeSurfaceCells\("\)\.length - 1, 2/u);
	assert.match(audit
		, /assert\.equal\(source\.split\(", contracts, selected\)"\)\.length - 1, 2/u);
	assert.match(audit, /assert\.match\(source, \/const stableSurface = \/u/u);
	assert.match(audit
		, /assert\.match\(source, \/const affectedObservations = \/u/u);
	return { ...vo1220NestedPromotionMemoryBoundBehavior };
};

/**
 * Reverse one authenticated memory-bound transition.
 *
 * @param source - Exact later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseVo1220NestedPromotionMemoryBoundUpdate = (
	source, update
) => {
	assert.ok(vo1220NestedPromotionMemoryBoundNormalizationPaths
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
 * Remove only this exact repair and its integration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220NestedPromotionMemoryBoundSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220NestedPromotionMemoryBoundNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220NestedPromotionMemoryBoundUpdate(
				current, update);
	}
	return current;
};
