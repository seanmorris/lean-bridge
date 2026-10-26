/**
 * Preserve the exact Core historical-evidence replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreHistoricalEvidenceReplayHistoryPath
	= "docs/evidence/core-historical-evidence-replay-source-history-20261026.json";
export const coreHistoricalEvidenceReplayPredecessor
	= "de0395f0834471099be186463dc2b262a3a8fa88";
export const coreHistoricalEvidenceReplayImplementation
	= "678bd2e6de0277abd7801d8edd69f83e5689c277";
export const coreHistoricalEvidenceReplayImplementationPaths = Object.freeze([
	"tests/helpers/owned-cpp-evidence.mjs"
	, "tests/helpers/owned-rust-callback-result-acceptance.mjs"
	, "tests/owned-python-transfer-evidence.test.mjs"
	, "tests/owned-rust-callback-result-evidence.test.mjs"
]);
export const coreHistoricalEvidenceReplayIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreHistoricalEvidenceReplayNormalizationPaths = Object.freeze([
	...coreHistoricalEvidenceReplayImplementationPaths
	, ...coreHistoricalEvidenceReplayIntegrationPaths
]);
export const coreHistoricalEvidenceReplayAddedPaths = Object.freeze([
	"scripts/update-core-historical-evidence-replay-source-history.mjs"
	, "tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
	, "tests/helpers/core-historical-evidence-replay-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreHistoricalEvidenceReplayHistoryPath, "utf8"
));

/**
 * Reverse one exact, non-overlapping source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreHistoricalEvidenceReplayUpdate = (source, update) => {
	assert.ok(coreHistoricalEvidenceReplayNormalizationPaths.includes(
		update.path
	));
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
 * Remove only the authenticated historical-evidence replay transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreHistoricalEvidenceReplaySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreHistoricalEvidenceReplayNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreHistoricalEvidenceReplayUpdate(current, update);
	}
	return current;
};
