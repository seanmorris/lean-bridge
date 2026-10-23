/**
 * Reverse the exact dependent browser handoff retention repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentBrowserHandoffRetentionRepairHistoryPath
	= "docs/evidence/dependent-browser-handoff-retention-repair-source-history-20261023.json";
export const dependentBrowserHandoffRetentionRepairPredecessor
	= "b05406dcd855b8dfa61459861e74eacba433c8a7";
export const dependentBrowserHandoffRetentionRepairImplementation
	= "d4c50232d76dd886cfaf2412d3245ebe3a76f71b";
export const dependentBrowserHandoffRetentionRepairModifiedPaths = Object.freeze([
	"scripts/run-dependent-checked-record-browser-ci.sh"
	, "tests/helpers/dependent-checked-record-browser-installed-tests.mjs"
	, "tests/helpers/dependent-checked-record-browser-tests.mjs"
]);
export const dependentBrowserHandoffRetentionRepairImplementationPaths
	= dependentBrowserHandoffRetentionRepairModifiedPaths;
export const dependentBrowserHandoffRetentionRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/dependent-checked-record-browser-foundation.test.mjs"
	]);
export const dependentBrowserHandoffRetentionRepairNormalizationPaths
	= Object.freeze([
		...dependentBrowserHandoffRetentionRepairModifiedPaths
		, ...dependentBrowserHandoffRetentionRepairIntegrationPaths
	]);
export const dependentBrowserHandoffRetentionRepairAddedPaths = Object.freeze([
	"scripts/update-dependent-browser-handoff-retention-repair-source-history.mjs"
	, "tests/helpers/dependent-browser-handoff-retention-repair-source-history-tests.mjs"
	, "tests/helpers/dependent-browser-handoff-retention-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentBrowserHandoffRetentionRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseDependentBrowserHandoffRetentionRepairUpdate = (
	source, update
) => {
	assert.ok(dependentBrowserHandoffRetentionRepairNormalizationPaths
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
 * Remove only the exact dependent browser handoff retention repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentBrowserHandoffRetentionRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !dependentBrowserHandoffRetentionRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseDependentBrowserHandoffRetentionRepairUpdate(source, update)
		: source;
};
