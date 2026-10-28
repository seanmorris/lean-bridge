/**
 * Preserve the authenticated two-parent join between the WIT proof-erasure
 * lane and the fixture-lint/type-surface repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const proofErasureWitLintJoinHistoryPath
	= "docs/evidence/proof-erasure-wit-lint-join-source-history-20261028.json";
export const proofErasureWitLintJoinCommonAncestor
	= "b066c9f95e84808a384c51d5e53099154a70eea4";
export const proofErasureWitLintJoinLeftParent
	= "677f3799190208d540e73a315d8270d8f3bae48d";
export const proofErasureWitLintJoinRightParent
	= "aa3a8a9327c89f7b82a284ca37dce4df06adbc3c";
export const proofErasureWitLintJoinMerge
	= "4eaff06c0af535045be7a54bc9017b0dc7315be2";
export const proofErasureWitLintJoinImplementation
	= "7a422835219c4145e19ec2ccab8729b9266310a2";
export const proofErasureWitLintJoinPinPath = "docs/type-surface.v1.json";
export const proofErasureWitLintJoinPinCount = 92;
export const proofErasureWitLintJoinChangedPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const proofErasureWitLintJoinIntegrationPaths
	= proofErasureWitLintJoinChangedPaths;
export const proofErasureWitLintJoinNormalizationPaths = Object.freeze([
	proofErasureWitLintJoinPinPath
	, ...proofErasureWitLintJoinChangedPaths
]);
export const proofErasureWitLintJoinAddedPaths = Object.freeze([
	"scripts/update-proof-erasure-wit-lint-join-source-history.mjs"
	, "tests/helpers/proof-erasure-wit-lint-join-source-history-tests.mjs"
	, "tests/helpers/proof-erasure-wit-lint-join-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	proofErasureWitLintJoinHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated join transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseProofErasureWitLintJoinUpdate = (source, update) => {
	assert.ok(proofErasureWitLintJoinNormalizationPaths.includes(update.path));
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
 * Reverse live registration, the workflow-pin refresh and then select the
 * merge parent containing an explicitly requested digest.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeProofErasureWitLintJoinSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !proofErasureWitLintJoinNormalizationPaths.includes(path))
		return source;
	const value = record();
	let current = source;
	for(const update of value.integrationUpdates)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		if(update.path === path && update.currentSha256 === digest)
			current = reverseProofErasureWitLintJoinUpdate(current, update);
	}
	let digest = sha256(current);
	if(digest === expected) return current;
	if(value.pinUpdate.path === path
		&& value.pinUpdate.currentSha256 === digest){
		current = reverseProofErasureWitLintJoinUpdate(
			current, value.pinUpdate
		);
		digest = sha256(current);
		if(digest === expected) return current;
		}
	if(!proofErasureWitLintJoinChangedPaths.includes(path)) return current;
	const updates = expected !== undefined
		&& value.rightPreferredExpectedSha256[path]?.includes(expected)
		? value.rightUpdates : value.leftUpdates;
	const update = updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update === undefined ? current
		: reverseProofErasureWitLintJoinUpdate(current, update);
};
