/**
 * Preserve the exact receiver-CI stop-boundary repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreReceiverCiStopBoundaryHistoryPath
	= "docs/evidence/core-receiver-ci-stop-boundary-source-history-20261026.json";
export const coreReceiverCiStopBoundaryPredecessor
	= "67768f748b24df629ef9d0dbde9c84d956c4c57c";
export const coreReceiverCiStopBoundaryImplementation
	= "bd18c1bccde75e824b23ce05ba830a44b1d713a1";
export const coreReceiverCiStopBoundaryImplementationPaths = Object.freeze([
	"tests/owned-perl-receiver-ci.test.mjs"
]);
export const coreReceiverCiStopBoundaryIntegrationPaths = Object.freeze([
	"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreReceiverCiStopBoundaryNormalizationPaths = Object.freeze([
	...coreReceiverCiStopBoundaryImplementationPaths
	, ...coreReceiverCiStopBoundaryIntegrationPaths
]);
export const coreReceiverCiStopBoundaryAddedPaths = Object.freeze([
	"scripts/update-core-receiver-ci-stop-boundary-source-history.mjs"
	, "tests/helpers/core-receiver-ci-stop-boundary-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreReceiverCiStopBoundaryHistoryPath, "utf8"
));

/**
 * Reverse one exact, non-overlapping source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreReceiverCiStopBoundaryUpdate = (source, update) => {
	assert.ok(coreReceiverCiStopBoundaryNormalizationPaths.includes(
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
 * Remove only the authenticated receiver-CI stop-boundary repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreReceiverCiStopBoundarySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreReceiverCiStopBoundaryNormalizationPaths.includes(path))
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
		current = reverseCoreReceiverCiStopBoundaryUpdate(current, update);
	}
	return current;
};
