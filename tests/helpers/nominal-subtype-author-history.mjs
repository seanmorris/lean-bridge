/**
 * Authenticate native nominal and constructor-free result documentation changes while preserving earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { beforeComponentRefinementMirrorSource } from "./component-refinement-mirror-history.mjs";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalSubtypeAuthorHistoryPath = "docs/evidence/nominal-subtype-author-source-history-20261011.json";
export const nominalSubtypeAuthorPredecessor = "8af7aea7f2488554a3ad1fb340d7a8af2a4b6f4c";
export const nominalSubtypeAuthorChangedPaths = [
	"docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/subtype-result-history.mjs"
	, "tests/lean-author-documentation.test.mjs"
	, "tests/native-subtype.test.mjs"
];
let history;

/**
 * Restore only a complete recorded transition with matching before/after digests.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reverseNominalSubtypeAuthorUpdate = (source, update) => {
	assert.ok(nominalSubtypeAuthorChangedPaths.includes(update.path));
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
export const beforeNominalSubtypeAuthorSource = (path, source, expected) => {
	source = beforeComponentRefinementMirrorSource(path, source, expected);
	if(typeof source !== "string" || !nominalSubtypeAuthorChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalSubtypeAuthorHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalSubtypeAuthorUpdate(source, update) : source;
};
