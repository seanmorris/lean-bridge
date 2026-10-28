/**
 * Authenticate direct checked-record C/WIT session acceptance without changing runtime or support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedCSessionBoundariesHistoryPath
	= "docs/evidence/owned-checked-c-session-boundaries-source-history-20261025.json";
export const ownedCheckedCSessionBoundariesPredecessor
	= "9f021dd7ea1ab3d7ff5af8a5c815b677e001bd2c";
export const ownedCheckedCSessionBoundariesImplementation
	= "fb5269796450ad3f500f22c7619f982d64c3cea2";
export const ownedCheckedCSessionBoundariesIntegrationBase
	= "fb5269796450ad3f500f22c7619f982d64c3cea2";
export const ownedCheckedCSessionBoundariesCommits = Object.freeze([
	"fb5269796450ad3f500f22c7619f982d64c3cea2"
]);
export const ownedCheckedCSessionBoundariesChangedPaths = Object.freeze([
	"tests/fixtures/structured-types/owned-checked-record-installed.c"
]);
export const ownedCheckedCSessionBoundariesImplementationAddedPaths = Object.freeze([
	"docs/evidence/owned-checked-c-session-boundaries-20261025.json"
]);
export const ownedCheckedCSessionBoundariesImplementationPaths = Object.freeze([
	...ownedCheckedCSessionBoundariesChangedPaths
	, ...ownedCheckedCSessionBoundariesImplementationAddedPaths
]);
export const ownedCheckedCSessionBoundariesIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedCheckedCSessionBoundariesNormalizationPaths = Object.freeze([
	...ownedCheckedCSessionBoundariesChangedPaths
	, ...ownedCheckedCSessionBoundariesIntegrationPaths
]);
export const ownedCheckedCSessionBoundariesHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-checked-c-session-boundaries-source-history.mjs"
	, "tests/helpers/owned-checked-c-session-boundaries-source-history-tests.mjs"
	, "tests/helpers/owned-checked-c-session-boundaries-source-history.mjs"
]);
export const ownedCheckedCSessionBoundariesAddedPaths = Object.freeze([
	...ownedCheckedCSessionBoundariesImplementationAddedPaths
	, ...ownedCheckedCSessionBoundariesHistoryAddedPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedCSessionBoundariesHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCheckedCSessionBoundariesUpdate = (
	source, update
) => {
	assert.ok(ownedCheckedCSessionBoundariesNormalizationPaths
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
 * Remove only the exact Owned checked C session boundaries.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedCheckedCSessionBoundariesSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedCSessionBoundariesNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseOwnedCheckedCSessionBoundariesUpdate(current, update);
	}
	return current;
};
