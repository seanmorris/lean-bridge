/**
 * Authenticate nominal constructor metadata changes while preserving earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNominalSubtypeNativeSource } from "./nominal-subtype-native-history.mjs";

export const nominalSubtypeSelectionHistoryPath = "docs/evidence/nominal-subtype-selection-source-history-20261011.json";
export const nominalSubtypeSelectionPredecessor = "b0cabee3ac47be0feeb4cf7154b3ce32ecfa56f5";
export const nominalSubtypeSelectionChangedPaths = [
	"docs/type-surface.v1.json"
	, "schema/lean-export-configuration.schema.json"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/checked-refinement-selection.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/perl-history-checkout-history.mjs"
	, "tests/helpers/structural-subtype-extractor-tests.mjs"
	, "tests/native-subtype.test.mjs"
];
let history;

/**
 * Restore only a complete recorded transition with matching before/after digests.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reverseNominalSubtypeSelectionUpdate = (source, update) => {
	assert.ok(nominalSubtypeSelectionChangedPaths.includes(update.path));
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
export const beforeNominalSubtypeSelectionSource = (path, source, expected) => {
	source = beforeNominalSubtypeNativeSource(path, source, expected);
	if(typeof source !== "string" || !nominalSubtypeSelectionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalSubtypeSelectionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalSubtypeSelectionUpdate(source, update) : source;
};
