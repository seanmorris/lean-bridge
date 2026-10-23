/**
 * Reverse the remaining-host callback Subtype runtime repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypeRemainingRuntimeRepairHistoryPath
	= "docs/evidence/callback-subtype-remaining-runtime-repair-source-history-20261021.json";
export const callbackSubtypeRemainingRuntimeRepairPredecessor
	= "0615085b582d83bf6e553000c2c3d8b4ce6e0fee";
export const callbackSubtypeRemainingRuntimeRepairImplementation
	= "12ad892b12962ad4ed868a602600c1a13f993995";
export const callbackSubtypeRemainingRuntimeRepairChangedPaths = Object.freeze([
	"src/backends/c/native-callable-graph-borrows.mjs"
	, "tests/callback-subtype-remaining-installed.test.mjs"
	, "tests/native-recursive-callable-model.test.mjs"
]);
export const callbackSubtypeRemainingRuntimeRepairIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypeRemainingRuntimeRepairHistoryPath, "utf8"));

/**
 * Authenticate and reverse one exact runtime repair transition.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackSubtypeRemainingRuntimeRepairUpdate = (source, update) => {
	assert.ok([...callbackSubtypeRemainingRuntimeRepairChangedPaths
		, ...callbackSubtypeRemainingRuntimeRepairIntegrationPaths].includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
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
 * Remove only this repair from one exact current or historical source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeRemainingRuntimeRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...callbackSubtypeRemainingRuntimeRepairChangedPaths
			, ...callbackSubtypeRemainingRuntimeRepairIntegrationPaths].includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCallbackSubtypeRemainingRuntimeRepairUpdate(source, update)
		: source;
};
