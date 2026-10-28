/**
 * Preserve the exact generic Subtype WIT helper warning scope transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericSubtypeWitHelperWarningScopeHistoryPath
	= "docs/evidence/generic-subtype-wit-helper-warning-scope-source-history-20261023.json";
export const genericSubtypeWitHelperWarningScopePredecessor
	= "23ae28e37befcdf245e94f5f841ed50254fc869c";
export const genericSubtypeWitHelperWarningScopeImplementation
	= "6b80b80c207b77dc665b08a27eaa8130f76e4bed";
export const genericSubtypeWitHelperWarningScopeIntegrationBase
	= "3b4773cac07396a611d5b817631cf72467ea5562";
export const genericSubtypeWitHelperWarningScopeApplied
	= "cf0384dfb9b1b7fc003966fae45ed75ebe5545a4";
export const genericSubtypeWitHelperWarningScopeModifiedPaths
	= Object.freeze([
		"tests/fixtures/generic-subtype-consumers/wit-wasi.c"
		, "tests/helpers/generic-subtype-managed-wit-tests.mjs"
	]);
export const genericSubtypeWitHelperWarningScopeIntegrationPaths
	= Object.freeze([
		"tests/generic-subtype-managed-wit.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const genericSubtypeWitHelperWarningScopeNormalizationPaths
	= Object.freeze([...new Set([
		...genericSubtypeWitHelperWarningScopeModifiedPaths
		, ...genericSubtypeWitHelperWarningScopeIntegrationPaths
	])]);
export const genericSubtypeWitHelperWarningScopeAddedPaths
	= Object.freeze([
		"scripts/update-generic-subtype-wit-helper-warning-scope-source-history.mjs"
		, "tests/helpers/generic-subtype-wit-helper-warning-scope-source-history-tests.mjs"
		, "tests/helpers/generic-subtype-wit-helper-warning-scope-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	genericSubtypeWitHelperWarningScopeHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseGenericSubtypeWitHelperWarningScopeUpdate = (source, update) => {
	assert.ok(genericSubtypeWitHelperWarningScopeNormalizationPaths.includes(update.path));
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
export const beforeGenericSubtypeWitHelperWarningScopeSource = (path, source, expected) => {
	void expected;
	if(typeof source !== "string"
		|| !genericSubtypeWitHelperWarningScopeNormalizationPaths.includes(path)) return source;
	const value = record();
	const digest = sha256(source);
	const update = [...value.integrationUpdates, ...value.updates].find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseGenericSubtypeWitHelperWarningScopeUpdate(source, update);
};
