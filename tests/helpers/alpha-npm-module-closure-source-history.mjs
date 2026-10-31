/**
 * Preserve the Alpha npm package module-closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const alphaNpmModuleClosureHistoryPath
	= "docs/evidence/alpha-npm-module-closure-source-history-20261031.json";
export const alphaNpmModuleClosurePredecessor
	= "3cc03005e0e07ba1ddf1806329f336862a997ea2";
export const alphaNpmModuleClosureImplementation
	= "0e16b51ed3ea32f6b037afa568fefd1bc7525115";
export const alphaNpmModuleClosureSourceCommit
	= "76682edd86186efcd8c57b265c4516ba32282105";
export const alphaNpmModuleClosureImplementationPaths = Object.freeze([
	"src/release/npm-package.mjs"
	, "src/release/universal-release-bundle.mjs"
	, "tests/npm-package.test.mjs"
	, "tests/universal-release-bundle.test.mjs"
]);
export const alphaNpmModuleClosurePinPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const alphaNpmModuleClosureIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const alphaNpmModuleClosureHistoryAdditions = Object.freeze([
	"scripts/update-alpha-npm-module-closure-source-history.mjs"
	, "tests/helpers/alpha-npm-module-closure-source-history-tests.mjs"
	, "tests/helpers/alpha-npm-module-closure-source-history.mjs"
]);

const historyUrl = new URL(
	"../../" + alphaNpmModuleClosureHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const alphaNpmModuleClosureNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: [...alphaNpmModuleClosureImplementationPaths
				, ...alphaNpmModuleClosurePinPaths])
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	alphaNpmModuleClosureImplementationPaths.includes(path)
	|| alphaNpmModuleClosurePinPaths.includes(path)
	|| alphaNpmModuleClosureIntegrationPaths.includes(path);

/**
 * Reverse one exact Alpha npm module-closure transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 * @returns {string} Exact predecessor source.
 */
export const reverseAlphaNpmModuleClosureUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
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
 * Remove only the authenticated Alpha npm module-closure transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 * @returns {string} Normalized source.
 */
export const beforeAlphaNpmModuleClosureSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !alphaNpmModuleClosureNormalizationPaths.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, [...record().updates].reverse()])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseAlphaNpmModuleClosureUpdate(current, update);
	}
	return current;
};
