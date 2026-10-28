/**
 * Preserve the authenticated two-parent join between the proof-erasure and
 * Core signature-completion histories.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const proofCoreLocalJoinHistoryPath
	= "docs/evidence/proof-core-local-join-source-history-20261028.json";
export const proofCoreLocalJoinCommonAncestor
	= "f311acff4ab598b6332155a209a10ba8620719ee";
export const proofCoreLocalJoinLeftParent
	= "7ef40c614f740c12027c488ec50072d9b0196750";
export const proofCoreLocalJoinRightParent
	= "e9c679aff081e6cca24ec17d2bf57cc3af27df71";
export const proofCoreLocalJoinMerge
	= "8ebf54fa078a232722af92864136f734ca94cbc5";
export const proofCoreLocalJoinChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const proofCoreLocalJoinNormalizationPaths
	= proofCoreLocalJoinChangedPaths;
export const proofCoreLocalJoinAddedPaths = Object.freeze([
	"scripts/update-proof-core-local-join-source-history.mjs"
	, "tests/helpers/proof-core-local-join-source-history-tests.mjs"
	, "tests/helpers/proof-core-local-join-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	proofCoreLocalJoinHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseProofCoreLocalJoinUpdate = (source, update) => {
	assert.ok(proofCoreLocalJoinNormalizationPaths.includes(update.path));
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
 * Reverse the live history registration and select the exact merge parent
 * whose authenticated states contain the requested digest. Common and
 * unspecified states use the proof parent; both parents converge before the
 * common ancestor.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeProofCoreLocalJoinSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !proofCoreLocalJoinNormalizationPaths.includes(path))
		return source;
	const value = record();
	let current = source;
	for(const update of value.integrationUpdates)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		if(update.path === path && update.currentSha256 === digest)
			current = reverseProofCoreLocalJoinUpdate(current, update);
	}
	const digest = sha256(current);
	if(digest === expected) return current;
	const updates = expected !== undefined
		&& value.rightPreferredExpectedSha256[path]?.includes(expected)
		? value.rightUpdates : value.leftUpdates;
	const update = updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update === undefined
		? current : reverseProofCoreLocalJoinUpdate(current, update);
};
