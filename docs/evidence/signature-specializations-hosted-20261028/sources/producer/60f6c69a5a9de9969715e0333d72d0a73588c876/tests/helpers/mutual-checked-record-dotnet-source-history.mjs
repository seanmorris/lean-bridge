/**
 * Authenticate the recursive checked-record .NET source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeMutualCheckedRecordNpmArchivePins
	, beforeMutualCheckedRecordNpmArchiveSource
} from "./mutual-checked-record-npm-archive-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const mutualCheckedRecordDotnetHistoryPath
	= "docs/evidence/mutual-checked-record-dotnet-source-history-20261016.json";
export const mutualCheckedRecordDotnetPredecessor
	= "02a1deb96396b2c131224f6f44ee0009167bf3ba";
export const mutualCheckedRecordDotnetDraftParent
	= "5bdf29b031b46b48116c2323cbc69fcbcbe89a92";
export const mutualCheckedRecordDotnetChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/backends/dotnet/copied-graph-assets.mjs"
	, "src/backends/dotnet/copied-graph-conversions.mjs"
	, "src/backends/dotnet/copied-graph-package.mjs"
	, "src/backends/dotnet/copied-graph-runtime.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/type-surface.test.mjs"
]);
let history;

/**
 * Reverse one complete transition after checking its path, digests and edits.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseMutualCheckedRecordDotnetUpdate = (source, update) => {
	assert.ok(mutualCheckedRecordDotnetChangedPaths.includes(update.path));
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
 * Remove only this .NET transition at its exact current identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutMutualCheckedRecordDotnet = (path, source) => {
	if(typeof source !== "string"
		|| !mutualCheckedRecordDotnetChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		mutualCheckedRecordDotnetHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseMutualCheckedRecordDotnetUpdate(source, update) : source;
};

/**
 * Reverse this transition, then continue through older authenticated layers.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeMutualCheckedRecordDotnetSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !mutualCheckedRecordDotnetChangedPaths.includes(path))
		return beforeMutualCheckedRecordNpmArchiveSource(path, source, expected);
	if(sha256(source) === expected) return source;
	const previous = withoutMutualCheckedRecordDotnet(path, source);
	if(previous !== source) return previous;
	return beforeMutualCheckedRecordNpmArchiveSource(path, source, expected);
};

/**
 * Restore source pins through this transition and every preceding milestone.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeMutualCheckedRecordDotnetPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(
		mutualCheckedRecordDotnetHistoryPath, "utf8"
	));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256)
			file.sha256 = update.previousSha256;
	}
	return beforeMutualCheckedRecordNpmArchivePins(previous);
};
