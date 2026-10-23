/**
 * Reverse the exact owned-Subtype Python dependency-resolution repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypePythonDependencyRepairHistoryPath
	= "docs/evidence/owned-subtype-python-dependency-repair-source-history-20261023.json";
export const ownedSubtypePythonDependencyRepairPredecessor
	= "38fbc3ed4588d3bb0de7b416c6047489ebbb8874";
export const ownedSubtypePythonDependencyRepairImplementation
	= "3eea5ff29e9389e694f77f63cc6822293666d131";
export const ownedSubtypePythonDependencyRepairImplementationPaths
	= Object.freeze([
		".github/workflows/owned-subtype-languages.yml"
		, "tests/owned-subtype-language-packaging.test.mjs"
	]);
export const ownedSubtypePythonDependencyRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const ownedSubtypePythonDependencyRepairChangedPaths = Object.freeze([
	...ownedSubtypePythonDependencyRepairImplementationPaths
	, ...ownedSubtypePythonDependencyRepairIntegrationPaths
]);
export const ownedSubtypePythonDependencyRepairAddedPaths = Object.freeze([
	"scripts/update-owned-subtype-python-dependency-repair-source-history.mjs"
	, "tests/helpers/owned-subtype-python-dependency-repair-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-python-dependency-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypePythonDependencyRepairHistoryPath, "utf8"));

/**
 * Restore one exact authenticated transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedSubtypePythonDependencyRepairUpdate = (
	source, update
) => {
	assert.ok(ownedSubtypePythonDependencyRepairChangedPaths
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
 * Remove only the owned-Subtype Python dependency-resolution repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedSubtypePythonDependencyRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedSubtypePythonDependencyRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseOwnedSubtypePythonDependencyRepairUpdate(source, update)
		: source;
};
