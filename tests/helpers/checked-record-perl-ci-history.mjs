/**
 * Preserve earlier workflow identities while requiring full installed Perl checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeCheckedRecordPerlPromotionSource } from "./checked-record-perl-promotion-history.mjs";

export const checkedRecordPerlCiHistoryPath = "docs/evidence/checked-record-perl-ci-source-history-20261011.json";
export const checkedRecordPerlCiPredecessor = "e6ea18b0ab28021a18cf9cb8bdf764af5f070bc5";
export const checkedRecordPerlCiChangedPaths = [
	".github/workflows/perl-consumer.yml"
	, "docs/type-surface.v1.json"
	, "tests/helpers/checked-record-perl-installed-history-tests.mjs"
	, "tests/helpers/refinement-perl-ci-history-tests.mjs"
	, "tests/helpers/refinement-perl-ci-history.mjs"
];
let history;

/**
 * Reverse only the recorded complete-file transition.
 *
 * @param source - Current complete source text.
 * @param update - Authenticated predecessor, successor and exact edited spans.
 */
export const reverseCheckedRecordPerlCiUpdate = (source, update) => {
	assert.ok(checkedRecordPerlCiChangedPaths.includes(update.path));
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
export const beforeCheckedRecordPerlCiSource = (path, source, expected) => {
	source = beforeCheckedRecordPerlPromotionSource(path, source, expected);
	if(typeof source !== "string" || !checkedRecordPerlCiChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(checkedRecordPerlCiHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseCheckedRecordPerlCiUpdate(source, update) : source;
};
