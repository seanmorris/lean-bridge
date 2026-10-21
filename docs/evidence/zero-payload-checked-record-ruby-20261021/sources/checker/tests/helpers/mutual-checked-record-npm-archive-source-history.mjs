/**
 * Authenticate the archive-era historical-comparison and source-pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeMutualCheckedRecordNpmPins
	, beforeMutualCheckedRecordNpmSource
} from "./mutual-checked-record-npm-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const mutualCheckedRecordNpmArchiveHistoryPath
	= "docs/evidence/mutual-checked-record-npm-archive-source-history-20261016.json";
export const mutualCheckedRecordNpmArchivePredecessor
	= "14ed7f4fdb81e6f31188105b19b40c522401fef7";
export const mutualCheckedRecordNpmArchiveDraftParent
	= mutualCheckedRecordNpmArchivePredecessor;
export const mutualCheckedRecordNpmArchiveChangedPaths = [
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse one complete transition after checking its path, digests and edits.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseMutualCheckedRecordNpmArchiveUpdate = (source, update) => {
	assert.ok(mutualCheckedRecordNpmArchiveChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor
			&& edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this archive-era transition at its exact current identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutMutualCheckedRecordNpmArchive = (path, source) => {
	if(typeof source !== "string"
		|| !mutualCheckedRecordNpmArchiveChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		mutualCheckedRecordNpmArchiveHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseMutualCheckedRecordNpmArchiveUpdate(source, update) : source;
};

/**
 * Reverse this transition, then continue through older authenticated layers.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeMutualCheckedRecordNpmArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !mutualCheckedRecordNpmArchiveChangedPaths.includes(path))
		return beforeMutualCheckedRecordNpmSource(path, source, expected);
	if(sha256(source) === expected) return source;
	const previous = withoutMutualCheckedRecordNpmArchive(path, source);
	if(previous !== source) return previous;
	return beforeMutualCheckedRecordNpmSource(path, source, expected);
};

/**
 * Restore source pins through this transition and every preceding milestone.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeMutualCheckedRecordNpmArchivePins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(
		mutualCheckedRecordNpmArchiveHistoryPath, "utf8"
	));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256)
			file.sha256 = update.previousSha256;
	}
	return beforeMutualCheckedRecordNpmPins(previous);
};
