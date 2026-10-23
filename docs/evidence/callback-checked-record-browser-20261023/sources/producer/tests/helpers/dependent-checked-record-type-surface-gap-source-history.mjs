/**
 * Restore the type-surface transitions omitted while dependent checked-record
 * source, archive and control histories were recorded. Each transition comes
 * from exact Git blobs; no historical evidence is rewritten.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordTypeSurfaceGapHistoryPath
	= "docs/evidence/dependent-checked-record-type-surface-gap-source-history-20261021.json";
export const dependentCheckedRecordTypeSurfaceGapPredecessor
	= "fa28d1e0e55fd96426152db9d4c61699ac61730d";
export const dependentCheckedRecordTypeSurfaceGapHistoricalPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const dependentCheckedRecordTypeSurfaceGapIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/native-subtype.test.mjs"
	]);
export const dependentCheckedRecordTypeSurfaceGapAddedPaths = Object.freeze([
	"scripts/update-dependent-checked-record-type-surface-gap-source-history.mjs"
	, "tests/helpers/dependent-checked-record-type-surface-gap-source-history-tests.mjs"
	, "tests/helpers/dependent-checked-record-type-surface-gap-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordTypeSurfaceGapHistoryPath, "utf8"));

const reverse = (source, update, paths) => {
	assert.ok(paths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Reverse one exact repair-integration transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition.
 */
export const reverseDependentCheckedRecordTypeSurfaceGapIntegration
	= (source, update) => reverse(source, update
		, dependentCheckedRecordTypeSurfaceGapIntegrationPaths);
/**
 * Reverse one exact omitted historical transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition.
 */
export const reverseDependentCheckedRecordTypeSurfaceGapHistorical
	= (source, update) => reverse(source, update
		, dependentCheckedRecordTypeSurfaceGapHistoricalPaths);

/**
 * Reverse this repair integration and then every contiguous omitted
 * type-surface transition, stopping at an optional exact digest.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which reconstruction stops.
 */
export const beforeDependentCheckedRecordTypeSurfaceGapSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	if(dependentCheckedRecordTypeSurfaceGapIntegrationPaths.includes(path))
	{
		const update = record().integrationUpdates.find(item => item.path === path);
		if(update?.currentSha256 === digest)
		{
			source = reverseDependentCheckedRecordTypeSurfaceGapIntegration(
				source, update);
			digest = sha256(source);
			if(digest === expected) return source;
		}
	}
	if(!dependentCheckedRecordTypeSurfaceGapHistoricalPaths.includes(path))
		return source;
	while(true)
	{
		const update = record().historicalTransitions.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(!update) return source;
		source = reverseDependentCheckedRecordTypeSurfaceGapHistorical(
			source, update);
		digest = sha256(source);
		if(digest === expected) return source;
	}
};
