/**
 * Reverse the authenticated owned-Subtype analysis transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeAnalysisHistoryPath
	= "docs/evidence/owned-subtype-analysis-source-history-20261020.json";
export const ownedSubtypeAnalysisPredecessor
	= "52681bcfbd20c65871a9d0fa34c4e9e68797b4b8";
export const ownedSubtypeAnalysisImplementation
	= "bbefa9ea6fc15b86c1ea533ecedebc87f13a5eec";
export const ownedSubtypeAnalysisChangedPaths = Object.freeze([
	"src/abi/owned-aggregate-model.mjs"
	, "src/abi/refinements.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/export-configuration.mjs"
	, "src/analyze/native-types.mjs"
	, "src/analyze/owned-metadata-graph.mjs"
	, "src/analyze/reviewed-owned-source.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/build/owned-aggregate-carriers.mjs"
	, "tests/elaborated-metadata.test.mjs"
	, "tests/helpers/owned-aggregate-fixture.mjs"
	, "tests/owned-aggregate-metadata.test.mjs"
	, "tests/owned-aggregate-model.test.mjs"
	, "tests/reviewed-owned-source.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeAnalysisHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedSubtypeAnalysisUpdate = (source, update) => {
	assert.ok(ownedSubtypeAnalysisChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
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
 * Remove only this exact owned-Subtype analysis transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedSubtypeAnalysisSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !ownedSubtypeAnalysisChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseOwnedSubtypeAnalysisUpdate(source, update) : source;
};
