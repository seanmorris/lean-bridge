/**
 * Preserve the bounded legacy owned-evidence replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreLegacyOwnedEvidenceReplayBoundHistoryPath
	= "docs/evidence/core-legacy-owned-evidence-replay-bound-source-history-20261027.json";
export const coreLegacyOwnedEvidenceReplayBoundPredecessor
	= "b827918f050b2db6d7d4cc0cedd76c4f35a08176";
export const coreLegacyOwnedEvidenceReplayBoundImplementation
	= "8ee9d9b52f0bbf959f02be96257dfc0939490338";
export const coreLegacyOwnedEvidenceReplayBoundImplementationPaths
	= Object.freeze([
		"tests/helpers/core-quality-budget-tests.mjs"
		, "tests/helpers/owned-cpp-evidence.mjs"
		, "tests/helpers/owned-host-evidence.mjs"
		, "tests/helpers/owned-python-evidence.mjs"
		, "tests/helpers/owned-rust-evidence.mjs"
		, "tests/owned-python-evidence.test.mjs"
	]);
export const coreLegacyOwnedEvidenceReplayBoundIntegrationPaths
	= Object.freeze([
		"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const coreLegacyOwnedEvidenceReplayBoundHistoryAdditions
	= Object.freeze([
		"scripts/update-core-legacy-owned-evidence-replay-bound-source-history.mjs"
		, "tests/helpers/core-legacy-owned-evidence-replay-bound-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	new URL(`../../${coreLegacyOwnedEvidenceReplayBoundHistoryPath}`
		, import.meta.url), "utf8"
));

/** List every source whose current bytes participate in this transition. */
export const coreLegacyOwnedEvidenceReplayBoundNormalizationPaths = () =>
	Object.freeze([...new Set([
		...record().updates.map(update => update.path)
		, ...record().integrationUpdates.map(update => update.path)
	])]);

const allowedTransitionPath = path =>
	coreLegacyOwnedEvidenceReplayBoundImplementationPaths.includes(path)
	|| coreLegacyOwnedEvidenceReplayBoundIntegrationPaths.includes(path);

/**
 * Restore one exact source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreLegacyOwnedEvidenceReplayBoundUpdate = (
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
 * Remove only the authenticated legacy owned-evidence replay transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreLegacyOwnedEvidenceReplayBoundSource = (
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
		current = reverseCoreLegacyOwnedEvidenceReplayBoundUpdate(
			current, update);
	}
	return current;
};
