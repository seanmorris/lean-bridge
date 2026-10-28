/**
 * Preserve the exact direct proof-erasure matrix closure model and its central
 * history registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureMatrixHistoryPath
	= "docs/evidence/direct-proof-erasure-matrix-source-history-20261028.json";
export const directProofErasureMatrixPredecessor
	= "abcbf4ec22f873985d3e7c7341092b2650e0a011";
export const directProofErasureMatrixImplementation
	= "302358adb130f7ecfda82932f66026773eec1179";
export const directProofErasureMatrixChangedPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
]);
export const directProofErasureMatrixImplementationAdditions = Object.freeze([
	"tests/helpers/direct-proof-erasure-matrix-tests.mjs"
	, "tests/helpers/direct-proof-erasure-matrix.mjs"
]);
export const directProofErasureMatrixIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const directProofErasureMatrixNormalizationPaths = Object.freeze([
	...directProofErasureMatrixChangedPaths
	, ...directProofErasureMatrixIntegrationPaths
]);
export const directProofErasureMatrixAddedPaths = Object.freeze([
	...directProofErasureMatrixImplementationAdditions
	, "scripts/update-direct-proof-erasure-matrix-source-history.mjs"
	, "tests/helpers/direct-proof-erasure-matrix-source-history-tests.mjs"
	, "tests/helpers/direct-proof-erasure-matrix-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	directProofErasureMatrixHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated matrix source transition.
 *
 * @param source - Complete current source.
 * @param update - Path, digests and current-side edits.
 */
export const reverseDirectProofErasureMatrixUpdate = (source, update) => {
	assert.ok(directProofErasureMatrixNormalizationPaths.includes(update.path));
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
 * Remove recognized matrix transitions newest first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeDirectProofErasureMatrixSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasureMatrixNormalizationPaths.includes(path))
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
		current = reverseDirectProofErasureMatrixUpdate(current, update);
	}
	return current;
};
