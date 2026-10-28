/**
 * Preserve the exact forward reconstruction of re-applied integration states and its central history registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreRecordedTransitionRepairHistoryPath
	= "docs/evidence/core-recorded-transition-repair-source-history-20261028.json";
export const coreRecordedTransitionRepairPredecessor
	= "bce6b208a2b0bae380279aa5abdf57f1621e9d8f";
export const coreRecordedTransitionRepairImplementation
	= "3dbfb1accc908ae1003ef50fe3b139a15edf3560";
export const coreRecordedTransitionRepairCommits = Object.freeze([
	coreRecordedTransitionRepairImplementation
]);
export const coreRecordedTransitionRepairImplementationPaths = Object.freeze([
	"tests/helpers/callback-fin-perl-milestone-read-integration-source-history-tests.mjs"
	, "tests/helpers/inherited-checked-record-lane-memory-integration-source-history-tests.mjs"
	, "tests/helpers/perl-codegen-producer-replay-integration-source-history-tests.mjs"
]);
export const coreRecordedTransitionRepairImplementationAddedPaths = Object.freeze([
	"tests/helpers/recorded-transition-source.mjs"
]);
export const coreRecordedTransitionRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreRecordedTransitionRepairNormalizationPaths = Object.freeze([
	...coreRecordedTransitionRepairImplementationPaths
	, ...coreRecordedTransitionRepairIntegrationPaths
]);
export const coreRecordedTransitionRepairAddedPaths = Object.freeze([
	"scripts/update-core-recorded-transition-repair-source-history.mjs"
	, "tests/helpers/core-recorded-transition-repair-source-history-tests.mjs"
	, "tests/helpers/core-recorded-transition-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreRecordedTransitionRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Path, both digests and the current-side edits of one change.
 */
export const reverseCoreRecordedTransitionRepairUpdate = (source, update) => {
	assert.ok(coreRecordedTransitionRepairNormalizationPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the recognized reconstruction repair and its registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCoreRecordedTransitionRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreRecordedTransitionRepairNormalizationPaths.includes(path))
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
		current = reverseCoreRecordedTransitionRepairUpdate(current, update);
	}
	return current;
};
