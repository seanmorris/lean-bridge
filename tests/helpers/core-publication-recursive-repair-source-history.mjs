/**
 * Authenticate the Core publication/recursive repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const corePublicationRecursiveRepairHistoryPath
	= "docs/evidence/core-publication-recursive-repair-source-history-20261025.json";
export const corePublicationRecursiveRepairPredecessor
	= "0d7af8b94573484ece7b4dd75f9526550c2b964a";
export const corePublicationRecursiveRepairImplementation
	= "913fed01d4b3e0ff4f2d89ec4f1097f874667686";
export const corePublicationRecursiveRepairIntegrationBase
	= "913fed01d4b3e0ff4f2d89ec4f1097f874667686";
export const corePublicationRecursiveRepairCommits = Object.freeze([
	"913fed01d4b3e0ff4f2d89ec4f1097f874667686"
]);
export const corePublicationRecursiveRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/callback-subtype-promotion.test.mjs"
	, "tests/checked-javascript.test.mjs"
	, "tests/helpers/native-recursive-callable-evidence.mjs"
	, "tests/helpers/python-recursive-callable-evidence.mjs"
	, "tests/helpers/ruby-recursive-callable-evidence.mjs"
	, "tests/helpers/rust-recursive-callable-evidence.mjs"
]);
export const corePublicationRecursiveRepairImplementationAddedPaths = Object.freeze([
	"docs/evidence/core-publication-recursive-repair-20261025/acceptance.json"
	, "docs/evidence/core-publication-recursive-repair-20261025/callback.tap"
	, "docs/evidence/core-publication-recursive-repair-20261025/diagnostics.json"
	, "docs/evidence/core-publication-recursive-repair-20261025/pin-audit.mjs"
	, "docs/evidence/core-publication-recursive-repair-20261025/published-probes.tap"
	, "docs/evidence/core-publication-recursive-repair-20261025/recursive-endpoints.tap"
	, "docs/evidence/core-publication-recursive-repair-20261025/registration.tap"
	, "tests/helpers/core-recursive-endpoint-tests.mjs"
]);
export const corePublicationRecursiveRepairImplementationPaths = Object.freeze([
	...corePublicationRecursiveRepairChangedPaths
	, ...corePublicationRecursiveRepairImplementationAddedPaths
]);
export const corePublicationRecursiveRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const corePublicationRecursiveRepairNormalizationPaths = Object.freeze([
	...corePublicationRecursiveRepairChangedPaths
	, ...corePublicationRecursiveRepairIntegrationPaths
]);
export const corePublicationRecursiveRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-core-publication-recursive-repair-source-history.mjs"
	, "tests/helpers/core-publication-recursive-repair-source-history-tests.mjs"
	, "tests/helpers/core-publication-recursive-repair-source-history.mjs"
]);
export const corePublicationRecursiveRepairAddedPaths = Object.freeze([
	...corePublicationRecursiveRepairImplementationAddedPaths
	, ...corePublicationRecursiveRepairHistoryAddedPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	corePublicationRecursiveRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCorePublicationRecursiveRepairUpdate = (
	source, update
) => {
	assert.ok(corePublicationRecursiveRepairNormalizationPaths
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
 * Remove only the exact Core publication/recursive repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCorePublicationRecursiveRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !corePublicationRecursiveRepairNormalizationPaths.includes(path))
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
		current = reverseCorePublicationRecursiveRepairUpdate(current, update);
	}
	return current;
};
