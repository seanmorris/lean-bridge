/**
 * Authenticate the checked-record browser archive without changing installed support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeCheckedRecordBrowserCiSource } from "./checked-record-browser-ci-history.mjs";

export const checkedRecordBrowserArchiveHistoryPath = "docs/evidence/checked-record-browser-archive-source-history-20261011.json";
export const checkedRecordBrowserArchivePredecessor = "db18006038829bf87c020f081d99b27a8932ee20";
export const checkedRecordBrowserArchiveChangedPaths = [
	"tests/checked-records.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/perl-container-subtype-ci-history.mjs"
];
let history;

/**
 * Restore only a complete recorded transition with matching before/after digests.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reverseCheckedRecordBrowserArchiveUpdate = (source, update) => {
	assert.ok(checkedRecordBrowserArchiveChangedPaths.includes(update.path));
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
export const beforeCheckedRecordBrowserArchiveSource = (path, source, expected) => {
	source = beforeCheckedRecordBrowserCiSource(path, source, expected);
	if(typeof source !== "string" || !checkedRecordBrowserArchiveChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(checkedRecordBrowserArchiveHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseCheckedRecordBrowserArchiveUpdate(source, update) : source;
};
