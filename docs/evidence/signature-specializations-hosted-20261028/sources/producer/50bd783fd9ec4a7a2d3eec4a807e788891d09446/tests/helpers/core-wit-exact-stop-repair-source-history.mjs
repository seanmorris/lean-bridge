/**
 * Preserve the exact WIT evidence-reader stopping-boundary repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreWitExactStopRepairHistoryPath
	= "docs/evidence/core-wit-exact-stop-repair-source-history-20261026.json";
export const coreWitExactStopRepairPredecessor
	= "1f643208e02c50f3ae97a2e7872771507b8eb1f1";
export const coreWitExactStopRepairImplementation
	= "9e4f128de937ee7767dd537d2d71081134035f34";
export const coreWitExactStopRepairImplementationPaths = Object.freeze([
	"tests/wit-owned-native-evidence.test.mjs"
	, "tests/wit-owned-package-evidence.test.mjs"
	, "tests/wit-owned-session-evidence.test.mjs"
]);
export const coreWitExactStopRepairIntegrationPaths = Object.freeze([
	"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/wit-owned-build-repair-history.mjs"
	, "tests/wit-owned-native-evidence.test.mjs"
	, "tests/wit-owned-package-evidence.test.mjs"
	, "tests/wit-owned-session-evidence.test.mjs"
]);
export const coreWitExactStopRepairNormalizationPaths = Object.freeze([
	...coreWitExactStopRepairImplementationPaths
	, ...coreWitExactStopRepairIntegrationPaths
]);
export const coreWitExactStopRepairAddedPaths = Object.freeze([
	"scripts/update-core-wit-exact-stop-repair-source-history.mjs"
	, "tests/helpers/core-wit-exact-stop-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreWitExactStopRepairHistoryPath, "utf8"
));

/**
 * Restore one exact, non-overlapping source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreWitExactStopRepairUpdate = (source, update) => {
	assert.ok(coreWitExactStopRepairNormalizationPaths.includes(update.path));
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
 * Remove only the authenticated WIT exact-stop repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreWitExactStopRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreWitExactStopRepairNormalizationPaths.includes(path))
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
		current = reverseCoreWitExactStopRepairUpdate(current, update);
	}
	return current;
};
