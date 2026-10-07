/**
 * Preserve exact source predecessors of the Refinement history cache change (#1440).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeReviewedFinEvidenceSource } from "./reviewed-fin-evidence-source-history.mjs";

export const refinementHistoryCacheHistoryPath = "docs/evidence/refinement-history-cache-source-history-20261007.json";
export const refinementHistoryCacheChangedPaths = [
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/reviewed-fin-source-history-tests.mjs"
	, "tests/helpers/reviewed-fin-source-history.mjs"
	, "tests/source-history-memo.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseRefinementHistoryCacheUpdate = (source, update) => {
	assert.ok(refinementHistoryCacheChangedPaths.includes(update.path));
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
 * Restore the source before #1440, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeRefinementHistoryCacheSource = (path, source, expected) => {
	source = beforeReviewedFinEvidenceSource(path, source, expected);
	if(typeof source !== "string" || !refinementHistoryCacheChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(refinementHistoryCacheHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseRefinementHistoryCacheUpdate(source, update) : source;
};
