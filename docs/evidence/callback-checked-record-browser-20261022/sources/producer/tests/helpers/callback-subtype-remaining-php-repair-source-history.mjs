/**
 * Reverse the remaining-host callback Subtype native PHP repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypeRemainingPhpRepairHistoryPath
	= "docs/evidence/callback-subtype-remaining-php-repair-source-history-20261021.json";
export const callbackSubtypeRemainingPhpRepairPredecessor
	= "d62793d1a2ca0f1adaf1b2b788b3b9841d6e41ec";
export const callbackSubtypeRemainingPhpRepairImplementation
	= "0e8b0f36182a5ae90bf47da2439faae3e3a60b49";
export const callbackSubtypeRemainingPhpRepairIntegrationBase
	= "84cc7e4926d581d5e8054748b9decc3d22d58ca1";
export const callbackSubtypeRemainingPhpRepairChangedPaths = Object.freeze([
	"src/backends/php/callable-graph-calls.mjs"
	, "src/backends/php/callable-graph-model.mjs"
	, "tests/callback-subtype-remaining-installed.test.mjs"
	, "tests/native-recursive-callable-model.test.mjs"
]);
export const callbackSubtypeRemainingPhpRepairIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypeRemainingPhpRepairHistoryPath, "utf8"));

/**
 * Authenticate and reverse one exact PHP repair transition.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackSubtypeRemainingPhpRepairUpdate = (
	source, update
) => {
	assert.ok([...callbackSubtypeRemainingPhpRepairChangedPaths
		, ...callbackSubtypeRemainingPhpRepairIntegrationPaths]
		.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
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
 * Remove only this PHP repair from one exact source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeRemainingPhpRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...callbackSubtypeRemainingPhpRepairChangedPaths
			, ...callbackSubtypeRemainingPhpRepairIntegrationPaths]
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCallbackSubtypeRemainingPhpRepairUpdate(source, update)
		: source;
};
