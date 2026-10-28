/**
 * Reverse central registration of the authenticated Core shard-5 repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreShardFiveRepairIntegrationHistoryPath
	= "docs/evidence/core-shard-five-repair-integration-source-history-20261028.json";
export const coreShardFiveRepairIntegrationBase
	= "84bc83f3558eac96e32675dab9bbf7274e52ca77";
export const coreShardFiveRepairIntegrationImplementation
	= "184e1fd74b1b8c7830c1f21270c2af2f4e1f3bcd";
export const coreShardFiveRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript-partition-10.test.mjs"
]);
export const coreShardFiveRepairIntegrationNormalizationPaths
	= coreShardFiveRepairIntegrationPaths;
export const coreShardFiveRepairIntegrationAddedPaths = Object.freeze([
	"scripts/update-core-shard-five-repair-integration-source-history.mjs"
	, "tests/helpers/core-shard-five-repair-integration-source-history-tests.mjs"
	, "tests/helpers/core-shard-five-repair-integration-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreShardFiveRepairIntegrationHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated integration transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded transition.
 */
export const reverseCoreShardFiveRepairIntegrationUpdate = (
	source, update
) => {
	assert.ok(coreShardFiveRepairIntegrationPaths.includes(update.path));
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
 * Remove only this integration layer, stopping at an optional exact digest.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCoreShardFiveRepairIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreShardFiveRepairIntegrationPaths.includes(path)) return source;
	if(sha256(source) === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === sha256(source));
	return update === undefined ? source
		: reverseCoreShardFiveRepairIntegrationUpdate(source, update);
};
