/**
 * Authenticate the recursive checked-record JVM source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeMutualCheckedRecordDotnetPins, beforeMutualCheckedRecordDotnetSource
} from "./mutual-checked-record-dotnet-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const mutualCheckedRecordJvmHistoryPath
	= "docs/evidence/mutual-checked-record-jvm-source-history-20261016.json";
export const mutualCheckedRecordJvmPredecessor
	= "703c69d98df381ec776d59b4aa927ca2e20c1d66";
export const mutualCheckedRecordJvmDraftParent
	= "a96cfe9e06628dc0db73c658b8e660bd5cd423f0";
export const mutualCheckedRecordJvmChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/backends/jvm/copied-graph-assets.mjs"
	, "src/backends/jvm/copied-graph-conversions.mjs"
	, "src/backends/jvm/copied-graph-package.mjs"
	, "src/backends/jvm/copied-graph-runtime.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/mutual-checked-record-npm-source-history-tests.mjs"
	, "tests/helpers/mutual-checked-record-source-history-tests.mjs"
	, "tests/helpers/nested-checked-record-matrix-closure-source-history-tests.mjs"
	, "tests/helpers/nested-checked-record-native-correction-source-history-tests.mjs"
	, "tests/helpers/nested-checked-record-quality-source-history-tests.mjs"
	, "tests/mutual-checked-record-dotnet-source-history.test.mjs"
	, "tests/mutual-checked-record-npm-archive-source-history.test.mjs"
	, "tests/type-surface.test.mjs"
]);
let history;

/**
 * Reverse one complete transition after checking its path, digests and edits.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseMutualCheckedRecordJvmUpdate = (source, update) => {
	assert.ok(mutualCheckedRecordJvmChangedPaths.includes(update.path));
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
 * Remove only this JVM transition at its exact current identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutMutualCheckedRecordJvm = (path, source) => {
	if(typeof source !== "string"
		|| !mutualCheckedRecordJvmChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		mutualCheckedRecordJvmHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseMutualCheckedRecordJvmUpdate(source, update) : source;
};

/**
 * Reverse this transition, then continue through older authenticated layers.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeMutualCheckedRecordJvmSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !mutualCheckedRecordJvmChangedPaths.includes(path))
		return beforeMutualCheckedRecordDotnetSource(path, source, expected);
	if(sha256(source) === expected) return source;
	const previous = withoutMutualCheckedRecordJvm(path, source);
	if(previous !== source) return previous;
	return beforeMutualCheckedRecordDotnetSource(path, source, expected);
};

/**
 * Restore source pins through this transition and every preceding milestone.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeMutualCheckedRecordJvmPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(
		mutualCheckedRecordJvmHistoryPath, "utf8"
	));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256)
			file.sha256 = update.previousSha256;
	}
	return beforeMutualCheckedRecordDotnetPins(previous);
};
