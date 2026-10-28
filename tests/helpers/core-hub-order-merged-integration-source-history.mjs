/**
 * Reverse integration of the local Core hub-order repair history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreHubOrderMergedIntegrationHistoryPath
	= "docs/evidence/core-hub-order-merged-integration-source-history-20261028.json";
export const coreHubOrderMergedIntegrationBase
	= "14e5f79f08d62f523a7b1abd25567e038d899af2";
export const coreHubOrderMergedIntegrationImplementation
	= "54bd4126e98e30a5e76adf5398153f55d7345812";
export const coreHubOrderMergedIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreHubOrderMergedIntegrationNormalizationPaths
	= coreHubOrderMergedIntegrationPaths;
export const coreHubOrderMergedIntegrationAddedPaths = Object.freeze([
	"scripts/update-core-hub-order-merged-integration-source-history.mjs"
	, "tests/helpers/core-hub-order-merged-integration-source-history-tests.mjs"
	, "tests/helpers/core-hub-order-merged-integration-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreHubOrderMergedIntegrationHistoryPath, "utf8"));

/**
 * Reverse one exact integration transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition.
 */
export const reverseCoreHubOrderMergedIntegrationUpdate = (source, update) => {
	assert.ok(coreHubOrderMergedIntegrationPaths.includes(update.path));
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
 * Remove only this exact integration transition.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCoreHubOrderMergedIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreHubOrderMergedIntegrationPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update === undefined ? source
		: reverseCoreHubOrderMergedIntegrationUpdate(source, update);
};
