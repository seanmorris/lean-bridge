/**
 * Reverse the inherited checked-record lane memory bound: the ten lane
 * checkers authenticate archived files hash-first and re-read them per use.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedCheckedRecordLaneMemoryHistoryPath
	= "docs/evidence/inherited-checked-record-lane-memory-source-history-20261028.json";
export const inheritedCheckedRecordLaneMemoryPredecessor
	= "d82eadde7bd5a92eb6fd8558e430e6d14fbc6058";
export const inheritedCheckedRecordLaneMemoryImplementation
	= "75360bb35fa133b60a662a78f92656e2010446d4";
export const inheritedCheckedRecordLaneMemoryCommits = Object.freeze([
	"75360bb35fa133b60a662a78f92656e2010446d4"
]);
export const inheritedCheckedRecordLaneMemoryChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/inherited-checked-record-browser-evidence.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-evidence.mjs"
	, "tests/helpers/inherited-checked-record-jvm-evidence.mjs"
	, "tests/helpers/inherited-checked-record-perl-evidence.mjs"
	, "tests/helpers/inherited-checked-record-php-evidence.mjs"
	, "tests/helpers/inherited-checked-record-php-wasm-evidence.mjs"
	, "tests/helpers/inherited-checked-record-python-evidence.mjs"
	, "tests/helpers/inherited-checked-record-ruby-evidence.mjs"
	, "tests/helpers/inherited-checked-record-rust-evidence.mjs"
	, "tests/helpers/inherited-checked-record-wit-evidence.mjs"
]);
export const inheritedCheckedRecordLaneMemoryNormalizationPaths
	= inheritedCheckedRecordLaneMemoryChangedPaths;
export const inheritedCheckedRecordLaneMemoryImplementationAddedPaths = Object.freeze([
	"tests/helpers/inherited-checked-record-lane-files.mjs"
]);
export const inheritedCheckedRecordLaneMemoryHistoryAddedPaths = Object.freeze([
	"scripts/update-inherited-checked-record-lane-memory-source-history.mjs"
	, "tests/helpers/inherited-checked-record-lane-memory-source-history-tests.mjs"
	, "tests/helpers/inherited-checked-record-lane-memory-source-history.mjs"
]);
export const inheritedCheckedRecordLaneMemoryAddedPaths = Object.freeze([
	...inheritedCheckedRecordLaneMemoryImplementationAddedPaths
	, ...inheritedCheckedRecordLaneMemoryHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	inheritedCheckedRecordLaneMemoryHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseInheritedCheckedRecordLaneMemoryUpdate = (source, update) => {
	assert.ok(inheritedCheckedRecordLaneMemoryNormalizationPaths.includes(update.path));
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
 * Remove only this layer's recognized transition. The central hub owns
 * stopping and re-entry.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeInheritedCheckedRecordLaneMemorySource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !inheritedCheckedRecordLaneMemoryNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseInheritedCheckedRecordLaneMemoryUpdate(source, update);
};
