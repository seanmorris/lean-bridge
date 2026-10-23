/**
 * Preserve the WIT value-index Core registration as a reversible source layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexWitHistoryPath
	= "docs/evidence/checked-record-value-index-wit-foundation-source-history-20261020.json";
export const checkedRecordValueIndexWitPredecessor
	= "8524753e5fd8e66f0926d2c166a4d1db42f04582";
export const checkedRecordValueIndexWitChangedPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const checkedRecordValueIndexWitAddedPaths = Object.freeze([
	"scripts/update-checked-record-value-index-wit-source-history.mjs"
	, "tests/checked-record-value-index-wit.test.mjs"
	, "tests/fixtures/checked-record-value-index-wit/wit-values.h"
	, "tests/fixtures/checked-record-value-index-wit/wit-wasi.c"
	, "tests/helpers/checked-record-value-index-wit-fixture-tests.mjs"
	, "tests/helpers/checked-record-value-index-wit-fixture.mjs"
	, "tests/helpers/checked-record-value-index-wit-source-history-tests.mjs"
	, "tests/helpers/checked-record-value-index-wit-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(checkedRecordValueIndexWitHistoryPath, "utf8"));

/**
 * Reverse one exact WIT foundation transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for one path.
 */
export const reverseCheckedRecordValueIndexWitUpdate = (source, update) => {
	assert.ok(checkedRecordValueIndexWitChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join(""); assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the WIT value-index source foundation.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCheckedRecordValueIndexWitSource = (path, source, expected) => {
	if(typeof source !== "string" || !checkedRecordValueIndexWitChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseCheckedRecordValueIndexWitUpdate(source, update) : source;
};
