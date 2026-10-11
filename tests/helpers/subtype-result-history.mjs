/**
 * Authenticate constructor-free native result metadata changes while preserving earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { beforeNominalSubtypeAuthorSource } from "./nominal-subtype-author-history.mjs";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const subtypeResultHistoryPath = "docs/evidence/subtype-result-source-history-20261011.json";
export const subtypeResultPredecessor = "9e9c99a0000cd9bee80339a9ed971248cb68dacc";
export const subtypeResultChangedPaths = [
	"docs/type-surface.v1.json"
	, "schema/native-metadata-type.schema.json"
	, "src/abi/refinements.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/analyze/native-types.mjs"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/analyze/reviewed-subtypes.mjs"
	, "src/backends/native/fin-refinements.mjs"
	, "src/backends/perl/generate.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-native-history.mjs"
	, "tests/helpers/nominal-subtype-selection-extractor-tests.mjs"
	, "tests/native-subtype.test.mjs"
];
let history;

/**
 * Restore only a complete recorded transition with matching before/after digests.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reverseSubtypeResultUpdate = (source, update) => {
	assert.ok(subtypeResultChangedPaths.includes(update.path));
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
export const beforeSubtypeResultSource = (path, source, expected) => {
	source = beforeNominalSubtypeAuthorSource(path, source, expected);
	if(typeof source !== "string" || !subtypeResultChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(subtypeResultHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseSubtypeResultUpdate(source, update) : source;
};
