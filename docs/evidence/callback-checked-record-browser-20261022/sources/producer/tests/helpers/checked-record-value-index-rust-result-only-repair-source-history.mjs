/**
 * Authenticate the Rust result-only caller warning repair and its current
 * source-history registration as one reversible layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexRustResultOnlyRepairHistoryPath
	= "docs/evidence/checked-record-value-index-rust-result-only-repair-source-history-20261020.json";
export const checkedRecordValueIndexRustResultOnlyRepairPreviousCommit
	= "f9839b7f13facf1d0ec4135202cb91ef5e0ccfe0";
export const checkedRecordValueIndexRustResultOnlyRepairCurrentCommit
	= "dacfbb77a33f801723d4bf0cbb75c9d1e422b7fb";
export const checkedRecordValueIndexRustResultOnlyRepairRegistrationParent
	= checkedRecordValueIndexRustResultOnlyRepairCurrentCommit;
export const checkedRecordValueIndexRustResultOnlyRepairHistoricalPaths
	= Object.freeze([
		"tests/fixtures/checked-record-value-index-rust/rust.rs"
		, "tests/helpers/checked-record-value-index-rust-fixture-tests.mjs"
	]);
export const checkedRecordValueIndexRustResultOnlyRepairRegistrationPaths
	= Object.freeze([
		"tests/checked-record-value-index-rust.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const checkedRecordValueIndexRustResultOnlyRepairChangedPaths
	= Object.freeze([
		...checkedRecordValueIndexRustResultOnlyRepairRegistrationPaths
		, ...checkedRecordValueIndexRustResultOnlyRepairHistoricalPaths
	]);
export const checkedRecordValueIndexRustResultOnlyRepairAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-rust-result-only-repair-source-history.mjs"
		, "tests/helpers/checked-record-value-index-rust-result-only-repair-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-rust-result-only-repair-source-history.mjs"
	]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexRustResultOnlyRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact Rust result-only repair or registration transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexRustResultOnlyRepairUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexRustResultOnlyRepairChangedPaths.includes(
		update.path));
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
 * Remove the exact Rust result-only repair layer when its bytes appear.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexRustResultOnlyRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexRustResultOnlyRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest
	);
	return update
		? reverseCheckedRecordValueIndexRustResultOnlyRepairUpdate(source, update)
		: source;
};
