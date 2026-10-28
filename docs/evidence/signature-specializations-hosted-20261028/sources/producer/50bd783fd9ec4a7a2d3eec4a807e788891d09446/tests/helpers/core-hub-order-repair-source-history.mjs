/**
 * Reverse the Fin hub order repair: newest-first diagnostic-contract and
 * replay-chain stages, two milestone reads and four refreshed helper pins.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreHubOrderRepairHistoryPath
	= "docs/evidence/core-hub-order-repair-source-history-20261028.json";
export const coreHubOrderRepairPredecessor
	= "6e0d941e796db8813ee58bc8fda00e126e0a232c";
export const coreHubOrderRepairImplementation
	= "a77708424aa329a78a3e897c0bd9aeae76ce7c33";
export const coreHubOrderRepairCommits = Object.freeze([
	"a77708424aa329a78a3e897c0bd9aeae76ce7c33"
]);
export const coreHubOrderRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/callback-fin-perl-runtime-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/reviewed-fin-wasm-evidence-tests.mjs"
]);
export const coreHubOrderRepairNormalizationPaths
	= coreHubOrderRepairChangedPaths;
export const coreHubOrderRepairImplementationAddedPaths = Object.freeze([]);
export const coreHubOrderRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-core-hub-order-repair-source-history.mjs"
	, "tests/helpers/core-hub-order-repair-source-history-tests.mjs"
	, "tests/helpers/core-hub-order-repair-source-history.mjs"
]);
export const coreHubOrderRepairAddedPaths = Object.freeze([
	...coreHubOrderRepairImplementationAddedPaths
	, ...coreHubOrderRepairHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreHubOrderRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseCoreHubOrderRepairUpdate = (source, update) => {
	assert.ok(coreHubOrderRepairNormalizationPaths.includes(update.path));
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
 * Remove only this layer's recognized transition. The central hub owns
 * stopping and re-entry.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeCoreHubOrderRepairSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !coreHubOrderRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseCoreHubOrderRepairUpdate(source, update);
};
