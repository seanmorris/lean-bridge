/**
 * Reverse the dependent checked-record archive route-selection repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordArchiveSelectionRepairHistoryPath
	= "docs/evidence/dependent-checked-record-archive-selection-repair-source-history-20261021.json";
export const dependentCheckedRecordArchiveSelectionRepairPredecessor
	= "1560d6953429b5d0c143165ce55046af7629f7ef";
export const dependentCheckedRecordArchiveSelectionRepairImplementation
	= "9949ea979f9a3fd4ccf0db4d2fb0006c088cfc29";
export const dependentCheckedRecordArchiveSelectionRepairChangedPaths
	= Object.freeze([
		"scripts/archive-dependent-checked-record-ruby-evidence.mjs"
		, "scripts/archive-dependent-checked-record-rust-evidence.mjs"
	]);
export const dependentCheckedRecordArchiveSelectionRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/native-subtype.test.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordArchiveSelectionRepairHistoryPath, "utf8"
));

/**
 * Authenticate both endpoints and restore one exact source update.
 *
 * @param source - Complete current source text.
 * @param update - Exact transition record.
 */
export const reverseDependentCheckedRecordArchiveSelectionRepairUpdate = (
	source, update
) => {
	assert.ok([...dependentCheckedRecordArchiveSelectionRepairChangedPaths
		, ...dependentCheckedRecordArchiveSelectionRepairIntegrationPaths]
		.includes(update.path));
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
 * Remove only this exact archive selection repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentCheckedRecordArchiveSelectionRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || ![
		...dependentCheckedRecordArchiveSelectionRepairChangedPaths
		, ...dependentCheckedRecordArchiveSelectionRepairIntegrationPaths
	].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseDependentCheckedRecordArchiveSelectionRepairUpdate(
			source, update
		) : source;
};
