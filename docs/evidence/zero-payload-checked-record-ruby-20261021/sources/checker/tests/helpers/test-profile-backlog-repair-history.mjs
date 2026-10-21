/**
 * Authenticate the closed registration of checked-record test entrypoints that
 * accumulated after the last test-profile update.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const testProfileBacklogRepairHistoryPath
	= "docs/evidence/test-profile-backlog-repair-source-history-20261017.json";
export const testProfileBacklogRepairPredecessor
	= "cfb5534b43e62a6459f65638edd55af415b27263";
export const testProfileBacklogRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
]);
let history;

/**
 * Reverse the exact registration transition after checking its complete source.
 *
 * @param source - Complete registered manifest source.
 * @param update - Authenticated source transition.
 */
export const reverseTestProfileBacklogRepairUpdate = (source, update) => {
	assert.ok(testProfileBacklogRepairChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	if(update.path === "src/adoption/test-profiles.mjs")
	{
		assert.ok(Array.isArray(update.addedTests) && update.addedTests.length > 0);
		assert.equal(new Set(update.addedTests).size, update.addedTests.length);
	}
	else assert.equal(update.addedTests, undefined);
	if(update.replacements !== undefined)
	{
		assert.ok(Array.isArray(update.replacements)
			&& update.replacements.length > 0);
		for(const replacement of [...update.replacements].reverse())
		{
			assert.equal(typeof replacement.previous, "string");
			assert.equal(typeof replacement.current, "string");
			assert.notEqual(replacement.previous, replacement.current);
			assert.ok(Number.isSafeInteger(replacement.count)
				&& replacement.count > 0);
			assert.equal(source.split(replacement.current).length - 1
				, replacement.count, update.path);
			source = source.replaceAll(replacement.current
				, replacement.previous);
		}
		assert.equal(sha256(source), update.previousSha256, update.path);
		return source;
	}
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
 * Remove only the exact backlog registration and preserve unknown source edits.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeTestProfileBacklogRepairSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !testProfileBacklogRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(
		testProfileBacklogRepairHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseTestProfileBacklogRepairUpdate(source, update) : source;
};
