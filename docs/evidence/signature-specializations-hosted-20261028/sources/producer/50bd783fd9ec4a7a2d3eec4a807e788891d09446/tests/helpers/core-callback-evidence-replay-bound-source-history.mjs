/**
 * Preserve the bounded callback-evidence source replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreCallbackEvidenceReplayBoundHistoryPath
	= "docs/evidence/core-callback-evidence-replay-bound-source-history-20261027.json";
export const coreCallbackEvidenceReplayBoundPredecessor
	= "c407dbf3ffd6887e9a0adb09edfa82dbc9435451";
export const coreCallbackEvidenceReplayBoundImplementation
	= "bcf1c282c401446b954af28c577c7fd24ab54c13";
export const coreCallbackEvidenceReplayBoundImplementationPaths
	= Object.freeze([
		"tests/helpers/core-quality-budget-tests.mjs"
		, "tests/helpers/owned-callback-result-evidence.mjs"
		, "tests/helpers/owned-callback-result-producer.mjs"
	]);
export const coreCallbackEvidenceReplayBoundIntegrationPaths
	= Object.freeze([
		"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const coreCallbackEvidenceReplayBoundHistoryAdditions
	= Object.freeze([
		"scripts/update-core-callback-evidence-replay-bound-source-history.mjs"
		, "tests/helpers/core-callback-evidence-replay-bound-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	new URL(`../../${coreCallbackEvidenceReplayBoundHistoryPath}`
		, import.meta.url), "utf8"
));

/** List every source whose current bytes participate in this transition. */
export const coreCallbackEvidenceReplayBoundNormalizationPaths = () =>
	Object.freeze([...new Set([
		...record().updates.map(update => update.path)
		, ...record().integrationUpdates.map(update => update.path)
	])]);

const allowedTransitionPath = path =>
	coreCallbackEvidenceReplayBoundImplementationPaths.includes(path)
	|| coreCallbackEvidenceReplayBoundIntegrationPaths.includes(path);

/**
 * Restore one exact source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreCallbackEvidenceReplayBoundUpdate = (
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
 * Remove only the authenticated callback-evidence replay-bound transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreCallbackEvidenceReplayBoundSource = (
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
		current = reverseCoreCallbackEvidenceReplayBoundUpdate(current, update);
	}
	return current;
};
