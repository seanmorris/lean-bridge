/**
 * Authenticate nominal constructor metadata changes while preserving earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { beforeSubtypeResultSource } from "./subtype-result-history.mjs";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalSubtypeNativeHistoryPath = "docs/evidence/nominal-subtype-native-source-history-20261011.json";
export const nominalSubtypeNativePredecessor = "8e4445fc08b8f39bb9b47887c8583bb21bb94a94";
export const nominalSubtypeNativeChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/abi/refinements.mjs"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/analyze/native-types.mjs"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "src/analyze/reviewed-subtypes.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/native/fin-refinements.mjs"
	, "src/backends/perl/generate.mjs"
	, "src/build/native-model.mjs"
	, "tests/fixtures/nominal-subtype-selection/NominalSelection.lean"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-selection-extractor-tests.mjs"
	, "tests/helpers/nominal-subtype-selection-fixture.mjs"
	, "tests/helpers/nominal-subtype-selection-history.mjs"
	, "tests/helpers/nominal-subtype-selection-tests.mjs"
	, "tests/helpers/structural-subtype-runtime-tests.mjs"
	, "tests/native-subtype.test.mjs"
];
let history;

/**
 * Restore only a complete recorded transition with matching before/after digests.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reverseNominalSubtypeNativeUpdate = (source, update) => {
	assert.ok(nominalSubtypeNativeChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Preserve unknown edits and exact requested stopping points.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeNominalSubtypeNativeSource = (path, source, expected) => {
	source = beforeSubtypeResultSource(path, source, expected);
	if(typeof source !== "string" || !nominalSubtypeNativeChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalSubtypeNativeHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalSubtypeNativeUpdate(source, update) : source;
};
