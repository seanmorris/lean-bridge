/**
 * Reverse the hub-order repair as cherry-picked onto the local Core line.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreHubOrderMergedHistoryPath
	= "docs/evidence/core-hub-order-merged-source-history-20261028.json";
export const coreHubOrderMergedPredecessor
	= "f51ee14387676aa4bc04f27f8f32407538e97fd0";
export const coreHubOrderMergedImplementation
	= "5b022abc6030863038df9e8e825673d03ca72dd5";
export const coreHubOrderMergedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/callback-fin-perl-runtime-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/reviewed-fin-wasm-evidence-tests.mjs"
]);
export const coreHubOrderMergedNormalizationPaths = coreHubOrderMergedPaths;
export const coreHubOrderMergedAddedPaths = Object.freeze([
	"scripts/update-core-hub-order-merged-source-history.mjs"
	, "tests/helpers/core-hub-order-merged-source-history-tests.mjs"
	, "tests/helpers/core-hub-order-merged-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreHubOrderMergedHistoryPath, "utf8"));

/**
 * Reverse one exact local hub-order transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition.
 */
export const reverseCoreHubOrderMergedUpdate = (source, update) => {
	assert.ok(coreHubOrderMergedPaths.includes(update.path));
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
 * Remove only the exact local hub-order repair.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCoreHubOrderMergedSource = (path, source, expected) => {
	if(typeof source !== "string" || !coreHubOrderMergedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update === undefined ? source
		: reverseCoreHubOrderMergedUpdate(source, update);
};
