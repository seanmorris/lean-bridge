/**
 * Authenticate the Rust source-inventory verifier repair and its history
 * registration as one exact, reversible layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexRustInventoryRepairHistoryPath
	= "docs/evidence/checked-record-value-index-rust-inventory-repair-source-history-20261020.json";
export const checkedRecordValueIndexRustInventoryRepairPreviousCommit
	= "ac17ed03d7071151ce3b232fb7dd5cf3b78119ae";
export const checkedRecordValueIndexRustInventoryRepairCurrentCommit
	= "45d13fb3eea6f041998d659a3b96eb5109363321";
export const checkedRecordValueIndexRustInventoryRepairRegistrationParent
	= "a62018388d33a75ef46a5ea10ec02457b2c1bbc9";
export const checkedRecordValueIndexRustInventoryRepairHistoricalPaths
	= Object.freeze([
		"tests/helpers/checked-record-value-index-rust-report.mjs"
	]);
export const checkedRecordValueIndexRustInventoryRepairRegistrationPaths
	= Object.freeze([
		"tests/checked-record-value-index-rust.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const checkedRecordValueIndexRustInventoryRepairChangedPaths
	= Object.freeze([
		...checkedRecordValueIndexRustInventoryRepairRegistrationPaths
		, ...checkedRecordValueIndexRustInventoryRepairHistoricalPaths
	]);
export const checkedRecordValueIndexRustInventoryRepairAddedPaths
	= Object.freeze([
		"tests/helpers/checked-record-value-index-rust-inventory-repair-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-rust-inventory-repair-source-history.mjs"
	]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexRustInventoryRepairHistoryPath, "utf8"
));

/** Reverse one authenticated Rust inventory-verifier transition. */
export const reverseCheckedRecordValueIndexRustInventoryRepairUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexRustInventoryRepairChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor
			&& edit.start <= source.length);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		assert.notEqual(edit.previous, edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/** Remove only the exact Rust source-inventory verifier repair. */
export const beforeCheckedRecordValueIndexRustInventoryRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexRustInventoryRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest
	);
	return update
		? reverseCheckedRecordValueIndexRustInventoryRepairUpdate(source, update)
		: source;
};
