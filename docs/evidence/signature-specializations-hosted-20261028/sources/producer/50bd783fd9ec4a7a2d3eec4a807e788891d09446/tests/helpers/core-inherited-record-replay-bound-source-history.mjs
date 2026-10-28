/**
 * Preserve the bounded inherited checked-record history replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreInheritedRecordReplayBoundHistoryPath
	= "docs/evidence/core-inherited-record-replay-bound-source-history-20261027.json";
export const coreInheritedRecordReplayBoundPredecessor
	= "8c007be3048765ff0e646b50c7a3a2d95cb872f3";
export const coreInheritedRecordReplayBoundImplementation
	= "a2e7a0ea741290554ac8424e82f5c9a9a06f63f7";
export const coreInheritedRecordReplayBoundImplementationPaths
	= Object.freeze([
		"tests/helpers/core-quality-budget-tests.mjs"
		, "tests/helpers/inherited-checked-record-promotion-source-history-tests.mjs"
	]);
export const coreInheritedRecordReplayBoundIntegrationPaths
	= Object.freeze([
		"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const coreInheritedRecordReplayBoundHistoryAdditions
	= Object.freeze([
		"scripts/update-core-inherited-record-replay-bound-source-history.mjs"
		, "tests/helpers/core-inherited-record-replay-bound-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	new URL(`../../${coreInheritedRecordReplayBoundHistoryPath}`
		, import.meta.url), "utf8"
));

/** List every source whose current bytes participate in this transition. */
export const coreInheritedRecordReplayBoundNormalizationPaths = () =>
	Object.freeze([...new Set([
		...record().updates.map(update => update.path)
		, ...record().integrationUpdates.map(update => update.path)
	])]);

const allowedTransitionPath = path =>
	coreInheritedRecordReplayBoundImplementationPaths.includes(path)
	|| coreInheritedRecordReplayBoundIntegrationPaths.includes(path);

/**
 * Restore one exact source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreInheritedRecordReplayBoundUpdate = (
	source, update
) => {
	assert.ok(allowedTransitionPath(update.path), update.path);
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
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the authenticated inherited-record replay-bound transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreInheritedRecordReplayBoundSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	if(!updates.some(update => update.path === path)) return source;
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreInheritedRecordReplayBoundUpdate(current, update);
	}
	return current;
};
