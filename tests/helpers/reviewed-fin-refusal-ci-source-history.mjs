/**
 * Preserve exact predecessors when enabling recurring native compiler-refusal acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const reviewedFinRefusalCiHistoryPath = "docs/evidence/reviewed-fin-refusal-ci-source-history-20261009.json";
export const reviewedFinRefusalCiPredecessor = "5466a9613a115da4769bb47fb69e4fa7c58d6302";
export const reviewedFinRefusalCiChangedPaths = [
	"docs/type-surface.v1.json"
	, ".github/workflows/consumer-matrix.yml"
	, "tests/documentation.test.mjs"
	, "tests/helpers/dotnet-dispatch-integration-source-history-tests.mjs"
	, "tests/helpers/native-fin-reply-ci-tests.mjs"
	, "tests/helpers/reviewed-fin-refusal-source-history.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/reviewed-fin-refusal-history.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseReviewedFinRefusalCiUpdate = (source, update) => {
	assert.ok(reviewedFinRefusalCiChangedPaths.includes(update.path));
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
 * Restore the source before CI wiring, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeReviewedFinRefusalCiSource = (path, source, expected) => {
	if(typeof source !== "string" || !reviewedFinRefusalCiChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(reviewedFinRefusalCiHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseReviewedFinRefusalCiUpdate(source, update) : source;
};
