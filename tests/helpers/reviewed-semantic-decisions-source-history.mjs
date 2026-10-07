/**
 * Preserve exact source predecessors of the Reviewed semantic decisions (#1437).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const reviewedSemanticDecisionsHistoryPath = "docs/evidence/reviewed-semantic-decisions-source-history-20261007.json";
export const reviewedSemanticDecisionsChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/analyze/reviewed-source.mjs"
	, "tests/helpers/container-host-dispatch-source-history-tests.mjs"
	, "tests/helpers/container-host-dispatch-source-history.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/reviewed-source.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseReviewedSemanticDecisionsUpdate = (source, update) => {
	assert.ok(reviewedSemanticDecisionsChangedPaths.includes(update.path));
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
 * Restore the source before #1437, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeReviewedSemanticDecisionsSource = (path, source, expected) => {
	if(typeof source !== "string" || !reviewedSemanticDecisionsChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(reviewedSemanticDecisionsHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseReviewedSemanticDecisionsUpdate(source, update) : source;
};
