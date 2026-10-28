/**
 * Reverse the explicit Perl callback admission repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const perlCallbackAdmissionRepairHistoryPath
	= "docs/evidence/perl-callback-admission-repair-source-history-20261024.json";
export const perlCallbackAdmissionRepairPredecessor
	= "93e431dd1adb1f1dd39e4cebebc6028a25823ed8";
export const perlCallbackAdmissionRepairImplementation
	= "b0a2af6fbac8d64772670f1845dcf80f3af2f746";
export const perlCallbackAdmissionRepairIntegrationBase
	= "c1dbd5dc7efb79397076acdfe25f6164f57ada57";
export const perlCallbackAdmissionRepairChangedPaths = Object.freeze([
	"tests/perl-recursive-callable-contract.test.mjs"
]);
export const perlCallbackAdmissionRepairIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const perlCallbackAdmissionRepairNormalizationPaths = Object.freeze([
	...perlCallbackAdmissionRepairChangedPaths
	, ...perlCallbackAdmissionRepairIntegrationPaths
]);
export const perlCallbackAdmissionRepairAddedPaths = Object.freeze([
	"scripts/update-perl-callback-admission-repair-source-history.mjs"
	, "tests/helpers/perl-callback-admission-repair-source-history-tests.mjs"
	, "tests/helpers/perl-callback-admission-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	perlCallbackAdmissionRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePerlCallbackAdmissionRepairUpdate = (
	source, update
) => {
	assert.ok(perlCallbackAdmissionRepairNormalizationPaths
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
 * Remove only the exact Perl callback admission repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePerlCallbackAdmissionRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !perlCallbackAdmissionRepairNormalizationPaths.includes(path))
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
		current = reversePerlCallbackAdmissionRepairUpdate(current, update);
	}
	return current;
};
