/**
 * Reverse the dependent generic-Subtype compiler/review transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentGenericSubtypeHistoryPath
	= "docs/evidence/dependent-generic-subtype-source-history-20261021.json";
export const dependentGenericSubtypePredecessor
	= "9bf2c5e61d82cb5e9b3210e81b22f1e521b86ee3";
export const dependentGenericSubtypeImplementation
	= "0072d22c60440a5a985d88406f4feb350d14b8f5";
export const dependentGenericSubtypePinnedPaths = Object.freeze([
	"src/abi/refinements.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/reviewed-source.mjs"
	, "src/backends/native/fin-refinements.mjs"
	, "src/backends/perl/generate.mjs"
	, "src/build/native-model.mjs"
]);
export const dependentGenericSubtypeChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, ...dependentGenericSubtypePinnedPaths
	, "tests/fixtures/nominal-subtype-selection/NominalSelection.lean"
	, "tests/helpers/nominal-subtype-native-source.mjs"
	, "tests/helpers/nominal-subtype-reviewed-fixture.mjs"
	, "tests/helpers/nominal-subtype-selection-extractor-tests.mjs"
	, "tests/helpers/nominal-subtype-selection-fixture.mjs"
]);
export const dependentGenericSubtypeIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentGenericSubtypeHistoryPath, "utf8"));

/**
 * Restore one authenticated dependent generic-Subtype transition.
 *
 * @param source - Complete source at the transition endpoint.
 * @param update - Authenticated transition record.
 */
export const reverseDependentGenericSubtypeUpdate = (source, update) => {
	assert.ok([...dependentGenericSubtypeChangedPaths
		, ...dependentGenericSubtypeIntegrationPaths].includes(update.path));
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
 * Remove only the exact dependent generic-Subtype history layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentGenericSubtypeSource = (path, source, expected) => {
	if(typeof source !== "string" || ![...dependentGenericSubtypeChangedPaths
		, ...dependentGenericSubtypeIntegrationPaths].includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseDependentGenericSubtypeUpdate(source, update) : source;
};
