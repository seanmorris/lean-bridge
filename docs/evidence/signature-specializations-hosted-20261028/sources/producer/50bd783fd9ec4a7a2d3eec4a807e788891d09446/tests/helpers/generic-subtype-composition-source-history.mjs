/**
 * Reverse the authenticated generic-Subtype composition transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericSubtypeCompositionHistoryPath
	= "docs/evidence/generic-subtype-composition-source-history-20261021.json";
export const genericSubtypeCompositionPredecessor
	= "4b5ff6743e18a7f8ebbff68741fd13f63c357eec";
export const genericSubtypeCompositionImplementation
	= "132e365aba4e6d5b3a993fc81ed36f69fd3dc385";
export const genericSubtypeCompositionChangedPaths = Object.freeze([
	"src/abi/refinements.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/native-types.mjs"
	, "src/build/native-model.mjs"
	, "tests/elaborated-metadata.test.mjs"
	, "tests/fixtures/nominal-subtype-selection/NominalSelection.lean"
	, "tests/helpers/component-nominal-subtype-source.mjs"
	, "tests/helpers/nominal-subtype-conversion-fixture.mjs"
	, "tests/helpers/nominal-subtype-native-fixture.mjs"
	, "tests/helpers/nominal-subtype-native-source.mjs"
	, "tests/helpers/nominal-subtype-native-tests.mjs"
	, "tests/helpers/nominal-subtype-reviewed-fixture.mjs"
	, "tests/helpers/nominal-subtype-selection-extractor-tests.mjs"
	, "tests/helpers/nominal-subtype-selection-fixture.mjs"
	, "tests/helpers/nominal-subtype-selection-tests.mjs"
	, "tests/helpers/subtype-result-tests.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	genericSubtypeCompositionHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseGenericSubtypeCompositionUpdate = (source, update) => {
	assert.ok(genericSubtypeCompositionChangedPaths.includes(update.path));
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
 * Remove only this exact generic-Subtype composition transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeGenericSubtypeCompositionSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !genericSubtypeCompositionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseGenericSubtypeCompositionUpdate(source, update) : source;
};
