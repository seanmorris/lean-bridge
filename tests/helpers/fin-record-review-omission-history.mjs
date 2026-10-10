/**
 * Authenticate fresh-Lean record and variant omission controls without rewriting earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const finRecordOmissionHistoryPath = "docs/evidence/fin-record-review-omission-source-history-20261010.json";
export const finRecordOmissionPredecessor = "49795a9076d9c1e8233ab9c2b861a5ad403953dc";
export const finRecordOmissionChangedPaths = [
	"tests/fin-container-edge-integration-history.test.mjs"
	, "tests/helpers/fin-container-edge-ci-history-tests.mjs"
	, "tests/helpers/fin-container-foreign-history-tests.mjs"
	, "tests/helpers/fin-container-foreign-history.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/native-fin-diagnostic-ci-tests.mjs"
	, "tests/native-fin-records.test.mjs"
];
let history;

/**
 * Reverse registered spans only after authenticating both complete sources.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseFinRecordOmissionUpdate = (source, update) => {
	assert.ok(finRecordOmissionChangedPaths.includes(update.path));
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
export const beforeFinRecordOmissionSource = (path, source, expected) => {
	if(typeof source !== "string" || !finRecordOmissionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(finRecordOmissionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseFinRecordOmissionUpdate(source, update) : source;
};
