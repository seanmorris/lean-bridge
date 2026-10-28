/**
 * Reverse the central-hub and Core-partition registration of the independently
 * authenticated Core memory bound.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreMemoryBoundIntegrationHistoryPath
	= "docs/evidence/core-memory-bound-integration-source-history-20261028.json";
export const coreMemoryBoundIntegrationBase
	= "7a18bdc40a25ffbc03df26e133f6cf84359c9d5c";
export const coreMemoryBoundIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript-partition-10.test.mjs"
]);
export const coreMemoryBoundIntegrationNormalizationPaths
	= coreMemoryBoundIntegrationPaths;
export const coreMemoryBoundIntegrationAddedPaths = Object.freeze([
	"scripts/update-core-memory-bound-integration-source-history.mjs"
	, "tests/helpers/core-memory-bound-integration-source-history-tests.mjs"
	, "tests/helpers/core-memory-bound-integration-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreMemoryBoundIntegrationHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated integration transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseCoreMemoryBoundIntegrationUpdate = (source, update) => {
	assert.ok(coreMemoryBoundIntegrationPaths.includes(update.path));
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
 * Remove only this integration layer, stopping at an optional exact digest.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source text.
 * @param {string} [expected] - Optional exact stopping digest.
 */
export const beforeCoreMemoryBoundIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreMemoryBoundIntegrationPaths.includes(path)) return source;
	if(sha256(source) === expected) return source;
	const update = record().integrationUpdates.find(item =>
		item.path === path && item.currentSha256 === sha256(source));
	return update === undefined ? source
		: reverseCoreMemoryBoundIntegrationUpdate(source, update);
};
