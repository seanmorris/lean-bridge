/**
 * Reverse the Core shard-5 repair: promotion prefix checks against predecessor
 * pins, receipt-mode retained-evidence pins and the two refreshed helper pins.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreShardFiveRepairHistoryPath
	= "docs/evidence/core-shard-five-repair-source-history-20261028.json";
export const coreShardFiveRepairPredecessor
	= "b3db2f702e368e9ff30947c5038b260d3531073d";
export const coreShardFiveRepairImplementation
	= "8193e794da98d5c6b8d86a94ddbb5d1f5ae99687";
export const coreShardFiveRepairCommits = Object.freeze([
	"8193e794da98d5c6b8d86a94ddbb5d1f5ae99687"
]);
export const coreShardFiveRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/fin-container-edge-integration-history.test.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-wasm-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-wit-promotion-tests.mjs"
]);
export const coreShardFiveRepairNormalizationPaths
	= coreShardFiveRepairChangedPaths;
export const coreShardFiveRepairImplementationAddedPaths = Object.freeze([]);
export const coreShardFiveRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-core-shard-five-repair-source-history.mjs"
	, "tests/helpers/core-shard-five-repair-source-history-tests.mjs"
	, "tests/helpers/core-shard-five-repair-source-history.mjs"
]);
export const coreShardFiveRepairAddedPaths = Object.freeze([
	...coreShardFiveRepairImplementationAddedPaths
	, ...coreShardFiveRepairHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreShardFiveRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseCoreShardFiveRepairUpdate = (source, update) => {
	assert.ok(coreShardFiveRepairNormalizationPaths.includes(update.path));
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
export const beforeCoreShardFiveRepairSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !coreShardFiveRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseCoreShardFiveRepairUpdate(source, update);
};
