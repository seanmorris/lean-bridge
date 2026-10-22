/**
 * Authenticate the inherited checked-record Perl verifier hardening as one
 * exact, reversible source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedCheckedRecordPerlVerifierHistoryPath
	= "docs/evidence/inherited-checked-record-perl-verifier-source-history-20261018.json";
export const inheritedCheckedRecordPerlVerifierPredecessor
	= "e0712bf0aa862fc2c21c65c9dd1de96d3e90bd4f";
export const inheritedCheckedRecordPerlVerifierDraftParent
	= "e0712bf0aa862fc2c21c65c9dd1de96d3e90bd4f";
export const inheritedCheckedRecordPerlVerifierChangedPaths = Object.freeze([
	"scripts/archive-inherited-checked-record-perl-evidence.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/inherited-checked-record-perl-controls.mjs"
	, "tests/helpers/inherited-checked-record-perl-records.mjs"
	, "tests/inherited-checked-record-perl-source-history.test.mjs"
]);
export const inheritedCheckedRecordPerlVerifierAddedPaths = Object.freeze([
	"scripts/update-inherited-checked-record-perl-verifier-source-history.mjs"
	, "tests/helpers/inherited-checked-record-perl-verifier-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	inheritedCheckedRecordPerlVerifierHistoryPath, "utf8"
));

/**
 * Reverse one exact verifier-hardening transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseInheritedCheckedRecordPerlVerifierUpdate = (
	source, update
) => {
	assert.ok(inheritedCheckedRecordPerlVerifierChangedPaths.includes(
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
 * Remove only the exact verifier-hardening layer from current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeInheritedCheckedRecordPerlVerifierSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !inheritedCheckedRecordPerlVerifierChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseInheritedCheckedRecordPerlVerifierUpdate(source, update)
		: source;
};
