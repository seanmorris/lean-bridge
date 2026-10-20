/**
 * Authenticate Fin history Buffer repair without changing earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeReviewedSubtypeNativePromotionSource } from "./reviewed-subtype-native-promotion-history.mjs";

export const finHistoryBufferRepairHistoryPath = "docs/evidence/fin-history-buffer-repair-source-history-20261010.json";
export const finHistoryBufferRepairPredecessor = "69d82afba73db3ac876f850acd170c8194a238c5";
export const finHistoryBufferRepairChangedPaths = [
	"tests/helpers/fin-alias-closure-history-tests.mjs"
	, "tests/helpers/fin-nominal-refusal-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/native-fin-diagnostic-ci-tests.mjs"
	, "tests/helpers/refinement-followup-history-tests.mjs"
	, "tests/helpers/refinement-followup-history.mjs"
];
let history;

/**
 * Reverse registered spans only after authenticating both complete sources.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseFinHistoryBufferRepairUpdate = (source, update) => {
	assert.ok(finHistoryBufferRepairChangedPaths.includes(update.path));
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
 * Restore only authenticated predecessors, preserving requested stopping digests.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeFinHistoryBufferRepairSource = (path, source, expected) => {
	source = beforeReviewedSubtypeNativePromotionSource(path, source, expected);
	if(typeof source !== "string" || !finHistoryBufferRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(finHistoryBufferRepairHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseFinHistoryBufferRepairUpdate(source, update) : source;
};
