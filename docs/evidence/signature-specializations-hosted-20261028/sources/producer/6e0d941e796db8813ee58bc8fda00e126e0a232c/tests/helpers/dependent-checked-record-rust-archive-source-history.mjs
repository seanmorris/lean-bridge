/**
 * Preserve the exact hosted Rust dependent checked-record archive milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordRustArchiveHistoryPath
	= "docs/evidence/dependent-checked-record-rust-archive-source-history-20261021.json";
export const dependentCheckedRecordRustArchivePredecessor
	= "318a1d09bbba9dfe9c90a99fa7e7ada7b3924b32";
export const dependentCheckedRecordRustArchiveImplementation
	= "19bfe7dba146a0f6e9f756f734827df595ccf65b";
export const dependentCheckedRecordRustArchiveRoot
	= "docs/evidence/dependent-checked-record-rust-20261021";
export const dependentCheckedRecordRustArchiveIndexSha256
	= "72338890cb5b3be545196b9267887cb097bfa4758f7909b6323e49da11b6b197";
export const dependentCheckedRecordRustArchiveIndexedFileCount = 1549;
export const dependentCheckedRecordRustArchiveFileCount = 1550;
export const dependentCheckedRecordRustArchiveAddedFileCount = 1552;
export const dependentCheckedRecordRustArchiveFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/dependent-checked-record-rust-evidence-tests.mjs"
		, "tests/helpers/dependent-checked-record-rust-evidence.mjs"
	]);
export const dependentCheckedRecordRustArchiveIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/native-subtype.test.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordRustArchiveHistoryPath, "utf8"
));

/**
 * Authenticate and reverse one exact archive integration update.
 *
 * @param source - Complete current source text.
 * @param update - Exact transition record.
 */
export const reverseDependentCheckedRecordRustArchiveUpdate = (
	source, update
) => {
	assert.ok(dependentCheckedRecordRustArchiveIntegrationPaths
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
 * Remove only this exact Rust archive integration layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentCheckedRecordRustArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !dependentCheckedRecordRustArchiveIntegrationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().integrationUpdates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseDependentCheckedRecordRustArchiveUpdate(source, update)
		: source;
};
