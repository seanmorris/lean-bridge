/**
 * Authenticate the deterministic six-shard Core quality contract as one
 * exact, reversible transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreQualityShardingHistoryPath
	= "docs/evidence/core-quality-sharding-source-history-20261018.json";
export const coreQualityShardingPredecessor
	= "fc5d255a48e863bfee9624def578b82c851d0566";
export const coreQualityShardingDraftParent
	= "8dbd5d6e72ae3bc5148cee58a403eb0d0f3f36fe";
export const coreQualityShardingChangedPaths = Object.freeze([
	".github/workflows/quality.yml"
	, "docs/type-surface.v1.json"
	, "scripts/run-test-profile.mjs"
	, "tests/checked-javascript.test.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/helpers/core-quality-budget-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/structural-subtype-core-ci-tests.mjs"
]);
export const coreQualityShardingFoundationAddedPaths = Object.freeze([
	"scripts/check-core-contract-shards.mjs"
	, "scripts/core-contract-shards.mjs"
]);
export const coreQualityShardingHistoryAddedPaths = Object.freeze([
	"scripts/update-core-quality-sharding-source-history.mjs"
	, "tests/helpers/core-quality-sharding-source-history.mjs"
	, "tests/helpers/core-quality-sharding-source-history-tests.mjs"
]);
export const coreQualityShardingAddedPaths = Object.freeze([
	...coreQualityShardingFoundationAddedPaths
	, ...coreQualityShardingHistoryAddedPaths
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	coreQualityShardingHistoryPath, "utf8"
));

/**
 * Reverse one exact Core quality-sharding transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCoreQualityShardingUpdate = (source, update) => {
	assert.ok(coreQualityShardingChangedPaths.includes(update.path));
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
 * Remove only the exact Core quality-sharding layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCoreQualityShardingSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !coreQualityShardingChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCoreQualityShardingUpdate(source, update)
		: source;
};
