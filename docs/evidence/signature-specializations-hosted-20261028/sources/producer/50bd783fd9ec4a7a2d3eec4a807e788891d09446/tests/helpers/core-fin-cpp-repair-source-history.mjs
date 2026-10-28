/**
 * Authenticate the Fin coverage and C++ callback replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreFinCppRepairHistoryPath
	= "docs/evidence/core-fin-cpp-repair-source-history-20261024.json";
export const coreFinCppRepairPredecessor
	= "1cef17763ed6b9a9cbade67994a4b420d9d99a59";
export const coreFinCppRepairImplementation
	= "5476ddb998e3f3f6a32bf2c9cfddeac56df9712a";
export const coreFinCppRepairIntegrationBase
	= "5476ddb998e3f3f6a32bf2c9cfddeac56df9712a";
export const coreFinCppRepairCommits = Object.freeze([
	"5476ddb998e3f3f6a32bf2c9cfddeac56df9712a"
]);
export const coreFinCppRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/nominal-fin-contract-tests.mjs"
	, "tests/helpers/owned-cpp-callback-result-evidence.mjs"
	, "tests/owned-cpp-callback-result-evidence.test.mjs"
]);
export const coreFinCppRepairImplementationAddedPaths = Object.freeze([
	"tests/helpers/callback-fin-coverage-tests.mjs"
	, "tests/helpers/callback-fin-coverage.mjs"
	, "tests/helpers/owned-cpp-callback-result-replay-tests.mjs"
	, "tests/helpers/owned-cpp-callback-result-replay.mjs"
]);
export const coreFinCppRepairImplementationPaths = Object.freeze([
	...coreFinCppRepairChangedPaths
	, ...coreFinCppRepairImplementationAddedPaths
]);
export const coreFinCppRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const coreFinCppRepairNormalizationPaths = Object.freeze([
	...coreFinCppRepairChangedPaths
	, ...coreFinCppRepairIntegrationPaths
]);
export const coreFinCppRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-core-fin-cpp-repair-source-history.mjs"
	, "tests/helpers/core-fin-cpp-repair-source-history-tests.mjs"
	, "tests/helpers/core-fin-cpp-repair-source-history.mjs"
]);
export const coreFinCppRepairAddedPaths = Object.freeze([
	...coreFinCppRepairImplementationAddedPaths
	, ...coreFinCppRepairHistoryAddedPaths
]);
export const coreFinCppRepairPins = Object.freeze([
	Object.freeze({
		path: "tests/helpers/nominal-fin-contract-tests.mjs"
		, count: 1
		, previousSha256: "576b46eb47372090aef0b285179fdf958f718dec6f9d38cee5a774251f9f9f39"
		, currentSha256: "0dd08d92d81f80c32bb77dc2b47364c0cd2f4061151042dc8c60d3d55ec6d387"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreFinCppRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCoreFinCppRepairUpdate = (
	source, update
) => {
	assert.ok(coreFinCppRepairNormalizationPaths
		.includes(update.path));
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
 * Remove only the exact Core Fin/C++ repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreFinCppRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreFinCppRepairNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreFinCppRepairUpdate(current, update);
	}
	return current;
};
