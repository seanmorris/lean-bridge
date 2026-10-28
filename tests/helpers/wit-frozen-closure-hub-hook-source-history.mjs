/**
 * Preserve the exact hub hook of the WIT frozen-closure integration history and its central registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const witFrozenClosureHubHookHistoryPath
	= "docs/evidence/wit-frozen-closure-hub-hook-source-history-20261028.json";
export const witFrozenClosureHubHookPredecessor
	= "79b57c627ae660ff3319f5c66b68b9fe57185bf7";
export const witFrozenClosureHubHookImplementation
	= "1ffade673e7667acbfa618269c41823770be0765";
export const witFrozenClosureHubHookCommits = Object.freeze([
	witFrozenClosureHubHookImplementation
]);
export const witFrozenClosureHubHookImplementationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const witFrozenClosureHubHookIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const witFrozenClosureHubHookNormalizationPaths = Object.freeze([
	...new Set([
		...witFrozenClosureHubHookImplementationPaths
		, ...witFrozenClosureHubHookIntegrationPaths
	])
]);
export const witFrozenClosureHubHookAddedPaths = Object.freeze([
	"scripts/update-wit-frozen-closure-hub-hook-source-history.mjs"
	, "tests/helpers/wit-frozen-closure-hub-hook-source-history-tests.mjs"
	, "tests/helpers/wit-frozen-closure-hub-hook-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	witFrozenClosureHubHookHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Path, both digests and the current-side edits of one change.
 */
export const reverseWitFrozenClosureHubHookUpdate = (source, update) => {
	assert.ok(witFrozenClosureHubHookNormalizationPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the recognized hub hook and its registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeWitFrozenClosureHubHookSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !witFrozenClosureHubHookNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseWitFrozenClosureHubHookUpdate(current, update);
	}
	return current;
};
