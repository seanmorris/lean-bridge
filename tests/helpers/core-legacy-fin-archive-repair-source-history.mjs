/**
 * Preserve the exact repair that binds the October 7 npm Fin archive to its
 * pre-field IR and TypeScript callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreLegacyFinArchiveRepairHistoryPath
	= "docs/evidence/core-legacy-fin-archive-repair-source-history-20261028.json";
export const coreLegacyFinArchiveRepairPredecessor
	= "fb217d6a39e77ef96c39f3f82d036bf167293bbc";
export const coreLegacyFinArchiveRepairImplementation
	= "e13521d12f1d542f2c6e84abc2f54578f7c279f0";
export const coreLegacyFinArchiveRepairCommits = Object.freeze([
	"5aa0969faffc1a7ac461d14bc5ce2b8f5251875e"
	, coreLegacyFinArchiveRepairImplementation
]);
export const coreLegacyFinArchiveRepairImplementationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/reviewed-fin-wasm-evidence-tests.mjs"
	, "tests/helpers/reviewed-fin-wasm-typescript.mjs"
]);
export const coreLegacyFinArchiveRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreLegacyFinArchiveRepairNormalizationPaths = Object.freeze([
	...coreLegacyFinArchiveRepairImplementationPaths
	, ...coreLegacyFinArchiveRepairIntegrationPaths
]);
export const coreLegacyFinArchiveRepairAddedPaths = Object.freeze([
	"scripts/update-core-legacy-fin-archive-repair-source-history.mjs"
	, "tests/helpers/core-legacy-fin-archive-repair-source-history-tests.mjs"
	, "tests/helpers/core-legacy-fin-archive-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreLegacyFinArchiveRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseCoreLegacyFinArchiveRepairUpdate = (source, update) => {
	assert.ok(coreLegacyFinArchiveRepairNormalizationPaths.includes(update.path));
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
 * Remove only the recognized legacy-archive repair and its registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCoreLegacyFinArchiveRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreLegacyFinArchiveRepairNormalizationPaths.includes(path))
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
		current = reverseCoreLegacyFinArchiveRepairUpdate(current, update);
	}
	return current;
};
