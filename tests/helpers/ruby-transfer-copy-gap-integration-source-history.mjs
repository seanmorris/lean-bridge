/**
 * Reverse the explicit Ruby gap integration repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const rubyTransferCopyGapIntegrationHistoryPath
	= "docs/evidence/ruby-transfer-copy-gap-integration-source-history-20261024.json";
export const rubyTransferCopyGapIntegrationPredecessor
	= "af8232b140605a598b128fdea9562649a8ba94d5";
export const rubyTransferCopyGapIntegrationImplementation
	= "d6e2adf84fc014a7b1dfe4952d7dfd8be504bdee";
export const rubyTransferCopyGapIntegrationIntegrationBase
	= "d6e2adf84fc014a7b1dfe4952d7dfd8be504bdee";
export const rubyTransferCopyGapIntegrationCommits = Object.freeze([
	"d6e2adf84fc014a7b1dfe4952d7dfd8be504bdee"
]);
export const rubyTransferCopyGapIntegrationChangedPaths = Object.freeze([]);
export const rubyTransferCopyGapIntegrationImplementationAddedPaths = Object.freeze([
	"docs/evidence/ruby-transfer-copy-gap-source-history-20261024.json"
	, "scripts/update-ruby-transfer-copy-gap-source-history.mjs"
	, "tests/helpers/ruby-transfer-copy-gap-source-history-tests.mjs"
	, "tests/helpers/ruby-transfer-copy-gap-source-history.mjs"
]);
export const rubyTransferCopyGapIntegrationImplementationPaths = Object.freeze([
	...rubyTransferCopyGapIntegrationChangedPaths
	, ...rubyTransferCopyGapIntegrationImplementationAddedPaths
]);
export const rubyTransferCopyGapIntegrationIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
	, "scripts/update-ruby-transfer-copy-gap-source-history.mjs"
]);
export const rubyTransferCopyGapIntegrationNormalizationPaths = Object.freeze([
	...rubyTransferCopyGapIntegrationChangedPaths
	, ...rubyTransferCopyGapIntegrationIntegrationPaths
]);
export const rubyTransferCopyGapIntegrationHistoryAddedPaths = Object.freeze([
	"scripts/update-ruby-transfer-copy-gap-integration-source-history.mjs"
	, "tests/helpers/ruby-transfer-copy-gap-integration-source-history-tests.mjs"
	, "tests/helpers/ruby-transfer-copy-gap-integration-source-history.mjs"
]);
export const rubyTransferCopyGapIntegrationAddedPaths = Object.freeze([
	...rubyTransferCopyGapIntegrationImplementationAddedPaths
	, ...rubyTransferCopyGapIntegrationHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	rubyTransferCopyGapIntegrationHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseRubyTransferCopyGapIntegrationUpdate = (
	source, update
) => {
	assert.ok(rubyTransferCopyGapIntegrationNormalizationPaths
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
 * Remove only the exact Ruby gap integration repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeRubyTransferCopyGapIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !rubyTransferCopyGapIntegrationNormalizationPaths.includes(path))
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
		current = reverseRubyTransferCopyGapIntegrationUpdate(current, update);
	}
	return current;
};
