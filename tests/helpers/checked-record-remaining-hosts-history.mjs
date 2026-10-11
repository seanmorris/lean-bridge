/**
 * Authenticate Checked-record remaining native hosts archive without changing earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordRemainingHostsArchiveHistoryPath = "docs/evidence/checked-record-remaining-hosts-source-history-20261010.json";
export const checkedRecordRemainingHostsArchivePredecessor = "c9d11f7ac8fd76d13bcc48f6f679eb22fd86b722";
export const checkedRecordRemainingHostsArchiveChangedPaths = [
	"docs/lean/existing-package.md"
	, "docs/type-surface.v1.json"
	, "tests/checked-records.test.mjs"
	, "tests/helpers/checked-record-ruby-jvm-history-tests.mjs"
	, "tests/helpers/checked-record-ruby-jvm-history.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/lean-author-documentation.test.mjs"
];
let history;

/**
 * Reverse registered spans only after authenticating both complete sources.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCheckedRecordRemainingHostsArchiveUpdate = (source, update) => {
	assert.ok(checkedRecordRemainingHostsArchiveChangedPaths.includes(update.path));
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
export const beforeCheckedRecordRemainingHostsArchiveSource = (path, source, expected) => {
	if(typeof source !== "string" || !checkedRecordRemainingHostsArchiveChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(checkedRecordRemainingHostsArchiveHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseCheckedRecordRemainingHostsArchiveUpdate(source, update) : source;
};

