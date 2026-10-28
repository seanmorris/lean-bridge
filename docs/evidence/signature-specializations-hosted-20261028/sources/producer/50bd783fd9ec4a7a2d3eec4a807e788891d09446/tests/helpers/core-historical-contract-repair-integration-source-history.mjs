/**
 * Reverse central registration of the Core historical-contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreHistoricalContractRepairIntegrationHistoryPath
	= "docs/evidence/core-historical-contract-repair-integration-source-history-20261028.json";
export const coreHistoricalContractRepairIntegrationBase
	= "8be7cedc605cd5eb516cc886b2d48c2fb8aa504c";
export const coreHistoricalContractRepairIntegrationImplementation
	= "f9e931a250c664fe5eef34ca1a503fca6e3117e6";
export const coreHistoricalContractRepairIntegrationCommits = Object.freeze([
	"09a34f86ca40e33102c2161fa68d62f52643cd8b"
	, "f9e931a250c664fe5eef34ca1a503fca6e3117e6"
]);
export const coreHistoricalContractRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript-partition-10.test.mjs"
]);
export const coreHistoricalContractRepairIntegrationNormalizationPaths
	= coreHistoricalContractRepairIntegrationPaths;
export const coreHistoricalContractRepairIntegrationAddedPaths = Object.freeze([
	"scripts/update-core-historical-contract-repair-integration-source-history.mjs"
	, "tests/helpers/core-historical-contract-repair-integration-source-history-tests.mjs"
	, "tests/helpers/core-historical-contract-repair-integration-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreHistoricalContractRepairIntegrationHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated integration transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseCoreHistoricalContractRepairIntegrationUpdate = (
	source, update
) => {
	assert.ok(coreHistoricalContractRepairIntegrationPaths.includes(
		update.path));
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
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source text.
 * @param {string} [expected] - Optional exact stopping digest.
 */
export const beforeCoreHistoricalContractRepairIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreHistoricalContractRepairIntegrationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update === undefined ? source
		: reverseCoreHistoricalContractRepairIntegrationUpdate(source, update);
};
