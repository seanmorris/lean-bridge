/**
 * Authenticate Perl checked-record support promotion without changing earlier observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordPerlPromotionHistoryPath = "docs/evidence/checked-record-perl-promotion-source-history-20261011.json";
export const checkedRecordPerlPromotionPredecessor = "715ca128d1c44a7f64d3609eabee9167857425d6";
export const checkedRecordPerlPromotionChangedPaths = [
	"docs/consume/perl.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/type-surface.v1.json"
	, "tests/helpers/checked-record-perl-ci-history-tests.mjs"
	, "tests/helpers/checked-record-perl-ci-history.mjs"
	, "tests/helpers/checked-record-perl-installed-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
];
let history;

/**
 * Reverse only the recorded complete-file transition.
 *
 * @param source - Current complete source text.
 * @param update - Authenticated predecessor, successor and exact edited spans.
 */
export const reverseCheckedRecordPerlPromotionUpdate = (source, update) => {
	assert.ok(checkedRecordPerlPromotionChangedPaths.includes(update.path));
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
 * Restore known predecessors; preserve unknown edits and exact requested stopping points.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeCheckedRecordPerlPromotionSource = (path, source, expected) => {
	if(typeof source !== "string" || !checkedRecordPerlPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(checkedRecordPerlPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseCheckedRecordPerlPromotionUpdate(source, update) : source;
};
