/**
 * Authenticate Perl checked-record author documentation evidence registration without rewriting earlier source receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const perlAuthorDocsHistoryPath = "docs/evidence/checked-record-perl-author-docs-source-history-20261011.json";
export const perlAuthorDocsPredecessor = "20539c53406f365d90e07251fd141c14ebf5fb0e";
export const perlAuthorDocsChangedPaths = ["docs/lean/existing-package.md"
	, "tests/lean-author-documentation.test.mjs"
	, "tests/helpers/checked-record-perl-promotion-tests.mjs"
	, "docs/type-surface.v1.json"
	, "tests/helpers/native-observation-split-history.mjs"];
let history;

/**
 * Restore only a complete recorded transition with matching before/after digests.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reversePerlAuthorDocsUpdate = (source, update) => {
	assert.ok(perlAuthorDocsChangedPaths.includes(update.path));
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
export const beforePerlAuthorDocsSource = (path, source, expected) => {
	if(typeof source !== "string" || !perlAuthorDocsChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(perlAuthorDocsHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reversePerlAuthorDocsUpdate(source, update) : source;
};
