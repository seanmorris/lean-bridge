/**
 * Preserve earlier product-test identities while correcting the reviewed-IR documentation assertion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeCheckedRecordPerlCiSource } from "./checked-record-perl-ci-history.mjs";

export const refinementPerlCiHistoryPath = "docs/evidence/refinement-perl-ci-source-history-20261011.json";
export const refinementPerlCiPredecessor = "0f0baca890a48ae2a0e1170746a39c1e13f3c5f4";
export const refinementPerlCiChangedPaths = [
	"tests/helpers/checked-record-perl-installed-history.mjs"
	, "tests/native-fin-products.test.mjs"
];
let history;

/**
 * Reverse only the recorded complete-file transition.
 *
 * @param source - Current complete source text.
 * @param update - Authenticated predecessor, successor and exact edited spans.
 */
export const reverseRefinementPerlCiUpdate = (source, update) => {
	assert.ok(refinementPerlCiChangedPaths.includes(update.path));
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
export const beforeRefinementPerlCiSource = (path, source, expected) => {
	source = beforeCheckedRecordPerlCiSource(path, source, expected);
	if(typeof source !== "string" || !refinementPerlCiChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(refinementPerlCiHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseRefinementPerlCiUpdate(source, update) : source;
};
