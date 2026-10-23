/**
 * Authenticate the WIT value-index verifier shadowing repair as one exact,
 * reversible source layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexWitVerifierRepairHistoryPath
	= "docs/evidence/checked-record-value-index-wit-verifier-repair-source-history-20261020.json";
export const checkedRecordValueIndexWitVerifierRepairPredecessor
	= "96f80a2acbe1214a6888a4b700d04bb97cf480eb";
export const checkedRecordValueIndexWitVerifierRepairDraftParent
	= "187622cc603bbcb6bc48322e934d64c26e59478c";
export const checkedRecordValueIndexWitVerifierRepairFoundationPaths
	= Object.freeze([
		"tests/helpers/checked-record-value-index-wit-model-records.mjs"
	]);
export const checkedRecordValueIndexWitVerifierRepairAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-wit-verifier-repair-source-history.mjs"
		, "tests/helpers/checked-record-value-index-wit-verifier-repair-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-wit-verifier-repair-source-history.mjs"
	]);
export const checkedRecordValueIndexWitVerifierRepairChangedPaths
	= Object.freeze([
		"tests/checked-record-value-index-wit.test.mjs"
		, "tests/helpers/checked-record-value-index-wit-acceptance-source-history-tests.mjs"
		, ...checkedRecordValueIndexWitVerifierRepairFoundationPaths
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexWitVerifierRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact WIT value-index verifier repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexWitVerifierRepairUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexWitVerifierRepairChangedPaths.includes(
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
 * Remove only the exact WIT value-index verifier repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexWitVerifierRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexWitVerifierRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexWitVerifierRepairUpdate(source, update)
		: source;
};
