/**
 * Reverse the owned-Subtype hosted-archive foundation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeHostedArchiveHistoryPath
	= "docs/evidence/owned-subtype-hosted-archive-source-history-20261023.json";
export const ownedSubtypeHostedArchivePredecessor
	= "1353c2c9c509b9dee7ac303c7f0a37f22ee9ea65";
export const ownedSubtypeHostedArchiveImplementation
	= "9c1bd270ddd793f3b3078bbb4d24c906ae769baa";
export const ownedSubtypeHostedArchiveCommits = Object.freeze([
	"e4e170b27d632e61aaa8106d1bb30e28afc3aea7"
	, ownedSubtypeHostedArchiveImplementation
]);
export const ownedSubtypeHostedArchiveModifiedPaths = Object.freeze([
	"tests/owned-subtype-hosted-ci.test.mjs"
]);
export const ownedSubtypeHostedArchiveImplementationAdditions = Object.freeze([
	"scripts/archive-owned-subtype-evidence.mjs"
	, "tests/helpers/owned-subtype-hosted-contracts.mjs"
	, "tests/helpers/owned-subtype-hosted-evidence-sources.mjs"
	, "tests/helpers/owned-subtype-hosted-evidence.mjs"
	, "tests/helpers/owned-subtype-hosted-output.mjs"
]);
export const ownedSubtypeHostedArchiveImplementationPaths = Object.freeze([
	...ownedSubtypeHostedArchiveModifiedPaths
	, ...ownedSubtypeHostedArchiveImplementationAdditions
]);
export const ownedSubtypeHostedArchiveIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/php-wasm-fin.test.mjs"
]);
export const ownedSubtypeHostedArchiveChangedPaths = Object.freeze([
	...ownedSubtypeHostedArchiveModifiedPaths
	, ...ownedSubtypeHostedArchiveIntegrationPaths
]);
export const ownedSubtypeHostedArchiveAddedPaths = Object.freeze([
	"scripts/update-owned-subtype-hosted-archive-source-history.mjs"
	, "tests/helpers/owned-subtype-hosted-archive-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-hosted-archive-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeHostedArchiveHistoryPath, "utf8"));

/**
 * Restore one exact authenticated transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedSubtypeHostedArchiveUpdate = (source, update) => {
	assert.ok(ownedSubtypeHostedArchiveChangedPaths.includes(update.path));
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
 * Remove only the owned-Subtype hosted-archive foundation.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedSubtypeHostedArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedSubtypeHostedArchiveChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update ? reverseOwnedSubtypeHostedArchiveUpdate(source, update)
		: source;
};
