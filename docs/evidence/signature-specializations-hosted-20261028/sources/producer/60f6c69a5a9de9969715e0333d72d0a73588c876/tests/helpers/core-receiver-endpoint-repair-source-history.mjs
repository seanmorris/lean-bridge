/**
 * Authenticate exact receiver history endpoint repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreReceiverEndpointRepairHistoryPath
	= "docs/evidence/core-receiver-endpoint-repair-source-history-20261024.json";
export const coreReceiverEndpointRepairPredecessor
	= "85aaf3013592421b8abe27d53b4b4510fce58f3e";
export const coreReceiverEndpointRepairImplementation
	= "80c0242f64f458f4bda4e4531e1ade36fe2262a4";
export const coreReceiverEndpointRepairIntegrationBase
	= "80c0242f64f458f4bda4e4531e1ade36fe2262a4";
export const coreReceiverEndpointRepairCommits = Object.freeze([
	"80c0242f64f458f4bda4e4531e1ade36fe2262a4"
]);
export const coreReceiverEndpointRepairChangedPaths = Object.freeze([
	"tests/owned-javascript-receiver-evidence.test.mjs"
	, "tests/owned-ruby-receiver-evidence.test.mjs"
	, "tests/owned-rust-receiver-evidence.test.mjs"
]);
export const coreReceiverEndpointRepairImplementationAddedPaths = Object.freeze([
	"tests/helpers/core-receiver-endpoint-tests.mjs"
]);
export const coreReceiverEndpointRepairImplementationPaths = Object.freeze([
	...coreReceiverEndpointRepairChangedPaths
	, ...coreReceiverEndpointRepairImplementationAddedPaths
]);
export const coreReceiverEndpointRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const coreReceiverEndpointRepairNormalizationPaths = Object.freeze([
	...coreReceiverEndpointRepairChangedPaths
	, ...coreReceiverEndpointRepairIntegrationPaths
]);
export const coreReceiverEndpointRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-core-receiver-endpoint-repair-source-history.mjs"
	, "tests/helpers/core-receiver-endpoint-repair-source-history-tests.mjs"
	, "tests/helpers/core-receiver-endpoint-repair-source-history.mjs"
]);
export const coreReceiverEndpointRepairAddedPaths = Object.freeze([
	...coreReceiverEndpointRepairImplementationAddedPaths
	, ...coreReceiverEndpointRepairHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreReceiverEndpointRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCoreReceiverEndpointRepairUpdate = (
	source, update
) => {
	assert.ok(coreReceiverEndpointRepairNormalizationPaths
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
 * Remove only the exact Core receiver endpoint repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreReceiverEndpointRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreReceiverEndpointRepairNormalizationPaths.includes(path))
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
		current = reverseCoreReceiverEndpointRepairUpdate(current, update);
	}
	return current;
};
