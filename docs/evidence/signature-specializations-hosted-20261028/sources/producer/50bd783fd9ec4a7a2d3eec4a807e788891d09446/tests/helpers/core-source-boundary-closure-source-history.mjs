/**
 * Preserve the exact Core source boundary closure transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreSourceBoundaryClosureHistoryPath
	= "docs/evidence/core-source-boundary-closure-source-history-20261023.json";
export const coreSourceBoundaryClosurePredecessor
	= "f3fa0f1895e96d84ebfac3ae589cc2c39d40fc42";
export const coreSourceBoundaryClosureImplementation
	= "c7c9fa036debad642a2a4899f56559e1f2e50c07";
export const coreSourceBoundaryClosureModifiedPaths
	= Object.freeze([
		"nix/core-source-boundary.json"
		, "tests/engine-execution-request.test.mjs"
	]);
export const coreSourceBoundaryClosureImplementationAdditions
	= Object.freeze([
		"tests/helpers/core-source-boundary-closure-tests.mjs"
	]);
export const coreSourceBoundaryClosureImplementationPaths
	= Object.freeze([
		...coreSourceBoundaryClosureModifiedPaths
		, ...coreSourceBoundaryClosureImplementationAdditions
	]);
export const coreSourceBoundaryClosureIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/toolchain-preflight.test.mjs"
	]);
export const coreSourceBoundaryClosureNormalizationPaths
	= Object.freeze([...new Set([
		...coreSourceBoundaryClosureModifiedPaths
		, ...coreSourceBoundaryClosureIntegrationPaths
	])]);
export const coreSourceBoundaryClosureAddedPaths
	= Object.freeze([
		"scripts/update-core-source-boundary-closure-source-history.mjs"
		, "tests/helpers/core-source-boundary-closure-source-history-tests.mjs"
		, "tests/helpers/core-source-boundary-closure-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreSourceBoundaryClosureHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseCoreSourceBoundaryClosureUpdate = (source, update) => {
	assert.ok(coreSourceBoundaryClosureNormalizationPaths.includes(update.path));
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
export const beforeCoreSourceBoundaryClosureSource = (path, source, expected) => {
	void expected;
	if(typeof source !== "string"
		|| !coreSourceBoundaryClosureNormalizationPaths.includes(path)) return source;
	const value = record();
	const digest = sha256(source);
	const update = [...value.integrationUpdates, ...value.updates].find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseCoreSourceBoundaryClosureUpdate(source, update);
};
