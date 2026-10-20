/**
 * Authenticate the recursive checked-record npm/runtime diagnostic transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeMutualCheckedRecordPins
	, beforeMutualCheckedRecordSource
} from "./mutual-checked-record-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const mutualCheckedRecordNpmHistoryPath
	= "docs/evidence/mutual-checked-record-npm-source-history-20261016.json";
export const mutualCheckedRecordNpmPredecessor
	= "bd5749bda5de2729c14b446090d46ec5e4172bf6";
export const mutualCheckedRecordNpmDraftParent
	= "c3e8099992d277bdb68e8696de31f4ae8e070ee7";
export const mutualCheckedRecordNpmChangedPaths = [
	"docs/type-surface.v1.json"
	, "package.json"
	, "src/build/component-recursive-adapters.mjs"
	, "src/release/component-copied-runtime.mjs"
	, "tests/component-refinement-mirrors.test.mjs"
	, "tests/component-structured-codec.test.mjs"
	, "tests/fixtures/mutual-checked-record-consumers/javascript.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/mutual-checked-record-source-history-tests.mjs"
	, "tests/helpers/mutual-checked-record-npm-fixture.mjs"
	, "tests/helpers/recursive-source-history.mjs"
	, "tests/mutual-checked-records.test.mjs"
];
export const mutualCheckedRecordNpmAddedPaths = [
	"src/build/component-recursive-diagnostics.mjs"
];
let history;

/**
 * Reverse one complete transition after checking its path, digests and edits.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseMutualCheckedRecordNpmUpdate = (source, update) => {
	assert.ok(mutualCheckedRecordNpmChangedPaths.includes(update.path));
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
 * Remove only this npm/runtime transition at its exact current identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutMutualCheckedRecordNpm = (path, source) => {
	if(typeof source !== "string"
		|| !mutualCheckedRecordNpmChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		mutualCheckedRecordNpmHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseMutualCheckedRecordNpmUpdate(source, update) : source;
};

/**
 * Reverse this transition, then continue through older authenticated layers.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeMutualCheckedRecordNpmSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !mutualCheckedRecordNpmChangedPaths.includes(path))
		return beforeMutualCheckedRecordSource(path, source, expected);
	if(sha256(source) === expected) return source;
	const previous = withoutMutualCheckedRecordNpm(path, source);
	if(previous !== source) return previous;
	return beforeMutualCheckedRecordSource(path, source, expected);
};

/**
 * Restore source pins through this transition and every preceding milestone.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeMutualCheckedRecordNpmPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(
		mutualCheckedRecordNpmHistoryPath, "utf8"
	));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256)
			file.sha256 = update.previousSha256;
	}
	return beforeMutualCheckedRecordPins(previous);
};
