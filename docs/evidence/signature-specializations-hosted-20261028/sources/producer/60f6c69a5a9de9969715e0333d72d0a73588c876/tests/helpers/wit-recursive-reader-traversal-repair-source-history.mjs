/**
 * Preserve the exact WIT recursive reader traversal repair transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const witRecursiveReaderTraversalRepairHistoryPath
	= "docs/evidence/wit-recursive-reader-traversal-repair-source-history-20261023.json";
export const witRecursiveReaderTraversalRepairPredecessor
	= "23ae28e37befcdf245e94f5f841ed50254fc869c";
export const witRecursiveReaderTraversalRepairImplementation
	= "e71a7efd73d867170c2f6c794e46bed69e0353aa";
export const witRecursiveReaderTraversalRepairIntegrationBase
	= "cfebafb26c34c4a73ce1c4d8694519d20bade130";
export const witRecursiveReaderTraversalRepairApplied
	= "aadb26f054a2f76f71e0e04b9555c966e478d6fc";
export const witRecursiveReaderTraversalRepairModifiedPaths
	= Object.freeze([
		"tests/c-structured-callable-evidence.test.mjs"
		, "tests/helpers/wit-recursive-callable-source-history.mjs"
	]);
export const witRecursiveReaderTraversalRepairIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/wit-recursive-callable-faults.test.mjs"
	]);
export const witRecursiveReaderTraversalRepairNormalizationPaths
	= Object.freeze([...new Set([
		...witRecursiveReaderTraversalRepairModifiedPaths
		, ...witRecursiveReaderTraversalRepairIntegrationPaths
	])]);
export const witRecursiveReaderTraversalRepairAddedPaths
	= Object.freeze([
		"scripts/update-wit-recursive-reader-traversal-repair-source-history.mjs"
		, "tests/helpers/wit-recursive-reader-traversal-repair-source-history-tests.mjs"
		, "tests/helpers/wit-recursive-reader-traversal-repair-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	witRecursiveReaderTraversalRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseWitRecursiveReaderTraversalRepairUpdate = (source, update) => {
	assert.ok(witRecursiveReaderTraversalRepairNormalizationPaths.includes(update.path));
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
 * Remove one authenticated transition of this layer. A recognized update is
 * always reversed; the central hub decides where an expected historical
 * digest stops and re-enters for any further transition.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeWitRecursiveReaderTraversalRepairSource = (path, source, expected) => {
	void expected;
	if(typeof source !== "string"
		|| !witRecursiveReaderTraversalRepairNormalizationPaths.includes(path)) return source;
	const value = record();
	const digest = sha256(source);
	const update = [...value.integrationUpdates, ...value.updates].find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseWitRecursiveReaderTraversalRepairUpdate(source, update);
};
