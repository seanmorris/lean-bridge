/**
 * Authenticate Checked-record Python archive without changing earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordPythonArchiveHistoryPath = "docs/evidence/checked-record-python-source-history-20261010.json";
export const checkedRecordPythonArchivePredecessor = "5a730e4a970ee43485553b6357ae68e4fbfab827";
export const checkedRecordPythonArchiveChangedPaths = [
	"docs/lean/existing-package.md"
	, "docs/type-surface.v1.json"
	, "tests/checked-records.test.mjs"
	, "tests/helpers/checked-record-native-installed-history-tests.mjs"
	, "tests/helpers/checked-record-native-installed-history.mjs"
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
export const reverseCheckedRecordPythonArchiveUpdate = (source, update) => {
	assert.ok(checkedRecordPythonArchiveChangedPaths.includes(update.path));
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
export const beforeCheckedRecordPythonArchiveSource = (path, source, expected) => {
	if(typeof source !== "string" || !checkedRecordPythonArchiveChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(checkedRecordPythonArchiveHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseCheckedRecordPythonArchiveUpdate(source, update) : source;
};
