/**
 * Preserve the inherited checked-record foundation verifier while making it
 * reconstruct the exact historical milestone instead of assuming live bytes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedCheckedRecordFoundationVerifierHistoryPath
	= "docs/evidence/inherited-checked-record-foundation-verifier-source-history-20261018.json";
export const inheritedCheckedRecordFoundationVerifierPredecessor
	= "0aaee40052296392a4940211243363cdb58fd247";
export const inheritedCheckedRecordFoundationVerifierDraftParent
	= "0aaee40052296392a4940211243363cdb58fd247";
export const inheritedCheckedRecordFoundationVerifierChangedPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/helpers/inherited-checked-record-foundation-history-tests.mjs"
	]);
export const inheritedCheckedRecordFoundationVerifierAddedPaths
	= Object.freeze([
		"scripts/update-inherited-checked-record-foundation-verifier-history.mjs"
		, "tests/helpers/inherited-checked-record-foundation-verifier-source-history.mjs"
	]);
export const inheritedCheckedRecordFoundationVerifierHistoricalPaths
	= Object.freeze(["tests/inherited-checked-records.test.mjs"]);
export const inheritedCheckedRecordFoundationVerifierHistoricalCommits
	= Object.freeze([
		"71de763ae897c4e06d583eeddd649b9d5f791808"
		, "5ee0e447a39da3ebd67a7591912b31b5c9f2b9a1"
		, "2870c7136cb659003d8920701c9e6d8afa48de69"
		, "833b9015bc85478eb0ca733b7c560ca14bf21f65"
		, "531cce06292aa090022d6a186abf30b719074a7c"
		, "725d2e48e71d6d9454b9d257b4204b95bdf1e622"
	]);
let history;

const allPaths = Object.freeze([
	...inheritedCheckedRecordFoundationVerifierChangedPaths
	, ...inheritedCheckedRecordFoundationVerifierHistoricalPaths
]);

const record = () => history ??= JSON.parse(readFileSync(
	inheritedCheckedRecordFoundationVerifierHistoryPath, "utf8"
));

/**
 * Reverse one exact verifier repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseInheritedCheckedRecordFoundationVerifierUpdate = (
	source, update
) => {
	assert.ok(allPaths.includes(update.path));
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
 * Remove only this exact verifier repair layer from current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeInheritedCheckedRecordFoundationVerifierSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || !allPaths.includes(path))
		return source;
	if(sha256(source) === expected) return source;
	const evidence = record();
	const update = evidence.updates.find(item => item.path === path);
	if(update?.currentSha256 === sha256(source))
		source = reverseInheritedCheckedRecordFoundationVerifierUpdate(
			source, update
		);
	if(sha256(source) === expected) return source;
	for(const transition of evidence.historicalTransitions)
	{
		const historical = transition.updates.find(item => item.path === path);
		if(historical?.currentSha256 === sha256(source))
			source = reverseInheritedCheckedRecordFoundationVerifierUpdate(
				source, historical
			);
		if(sha256(source) === expected) return source;
	}
	return source;
};
