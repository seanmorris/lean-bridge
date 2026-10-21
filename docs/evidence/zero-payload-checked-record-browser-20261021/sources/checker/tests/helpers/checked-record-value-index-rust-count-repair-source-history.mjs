/**
 * Authenticate the delayed Rust value-index receipt-count repair and its
 * current history registration as one reversible source layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexRustCountRepairHistoryPath
	= "docs/evidence/checked-record-value-index-rust-count-repair-source-history-20261020.json";
export const checkedRecordValueIndexRustCountRepairPreviousCommit
	= "ddcf369747f1ae3ac8770c236cec7e60f0edd488";
export const checkedRecordValueIndexRustCountRepairCurrentCommit
	= "8bc597686328278d4ea78551e08d7862c996eb0c";
export const checkedRecordValueIndexRustCountRepairRegistrationParent
	= "bb14e51b5a9f1fc5c0957f97c7c3d0ad7952326d";
export const checkedRecordValueIndexRustCountRepairHistoricalPaths
	= Object.freeze([
		"tests/fixtures/checked-record-value-index-rust/rust.rs"
		, "tests/helpers/checked-record-value-index-rust-fixture.mjs"
	]);
export const checkedRecordValueIndexRustCountRepairRegistrationPaths
	= Object.freeze([
		"tests/checked-record-value-index-rust.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const checkedRecordValueIndexRustCountRepairChangedPaths
	= Object.freeze([
		...checkedRecordValueIndexRustCountRepairRegistrationPaths
		, ...checkedRecordValueIndexRustCountRepairHistoricalPaths
	]);
export const checkedRecordValueIndexRustCountRepairAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-rust-count-repair-source-history.mjs"
		, "tests/helpers/checked-record-value-index-rust-count-repair-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-rust-count-repair-source-history.mjs"
	]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexRustCountRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact Rust count-repair or registration transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexRustCountRepairUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexRustCountRepairChangedPaths.includes(
		update.path
	));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove the exact Rust count-repair layer when its authenticated bytes appear.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexRustCountRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexRustCountRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest
	);
	return update
		? reverseCheckedRecordValueIndexRustCountRepairUpdate(source, update)
		: source;
};
