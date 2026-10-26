/**
 * Reverse the exact owned-Subtype JVM consumer filename repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeJvmFilenameRepairHistoryPath
	= "docs/evidence/owned-subtype-jvm-filename-repair-source-history-20261023.json";
export const ownedSubtypeJvmFilenameRepairPredecessor
	= "c366c43c7d11b88e1e281f20c6db60d4a9d83186";
export const ownedSubtypeJvmFilenameRepairImplementation
	= "e87523ce51706bd84557de498da0b5fd14a5230c";
export const ownedSubtypeJvmFilenameRepairImplementationPaths = Object.freeze([
	"tests/fixtures/structured-types/owned-subtype-java.java"
	, "tests/owned-subtype-remaining-packaging.test.mjs"
]);
export const ownedSubtypeJvmFilenameRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/php-wasm-fin.test.mjs"
]);
export const ownedSubtypeJvmFilenameRepairChangedPaths = Object.freeze([
	...ownedSubtypeJvmFilenameRepairImplementationPaths
	, ...ownedSubtypeJvmFilenameRepairIntegrationPaths
]);
export const ownedSubtypeJvmFilenameRepairAddedPaths = Object.freeze([
	"scripts/update-owned-subtype-jvm-filename-repair-source-history.mjs"
	, "tests/helpers/owned-subtype-jvm-filename-repair-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-jvm-filename-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeJvmFilenameRepairHistoryPath, "utf8"));

/**
 * Restore one exact authenticated transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedSubtypeJvmFilenameRepairUpdate = (source, update) => {
	assert.ok(ownedSubtypeJvmFilenameRepairChangedPaths.includes(update.path));
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
 * Remove only the owned-Subtype JVM filename-repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedSubtypeJvmFilenameRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedSubtypeJvmFilenameRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseOwnedSubtypeJvmFilenameRepairUpdate(source, update) : source;
};
