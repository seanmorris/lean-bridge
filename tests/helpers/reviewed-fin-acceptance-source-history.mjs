/**
 * Preserve exact source predecessors of the Reviewed Fin acceptance change (#1438).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNativeFinRecordsSource } from "./native-fin-records-source-history.mjs";

export const reviewedFinAcceptanceHistoryPath = "docs/evidence/reviewed-fin-acceptance-source-history-20261007.json";
export const reviewedFinAcceptanceChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/perl-consumer.yml"
	, "docs/type-surface.v1.json"
	, "tests/documentation.test.mjs"
	, "tests/generic-records.test.mjs"
	, "tests/helpers/fin-product-arrays-source-history-tests.mjs"
	, "tests/helpers/fin-product-arrays-source-history.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/managed-ci-isolation.mjs"
	, "tests/helpers/type-corpus-browser.mjs"
	, "tests/managed-ci-isolation.test.mjs"
	, "tests/perl-fin-containers.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseReviewedFinAcceptanceUpdate = (source, update) => {
	assert.ok(reviewedFinAcceptanceChangedPaths.includes(update.path));
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
 * Restore the source before #1438, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeReviewedFinAcceptanceSource = (path, source, expected) => {
	source = beforeNativeFinRecordsSource(path, source, expected);
	if(typeof source !== "string" || !reviewedFinAcceptanceChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(reviewedFinAcceptanceHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseReviewedFinAcceptanceUpdate(source, update) : source;
};
