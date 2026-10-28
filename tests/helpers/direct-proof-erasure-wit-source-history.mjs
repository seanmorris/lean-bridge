/**
 * Preserve the exact WIT/WASI direct proof-erasure package lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureWitHistoryPath
	= "docs/evidence/direct-proof-erasure-wit-source-history-20261028.json";
export const directProofErasureWitPredecessor
	= "b066c9f95e84808a384c51d5e53099154a70eea4";
export const directProofErasureWitImplementation
	= "eb134f3ea9d291af7c8d940083b994eb1a59196b";
export const directProofErasureWitChangedPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "tests/checked-javascript-partition-11.test.mjs"
]);
export const directProofErasureWitIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const directProofErasureWitNormalizationPaths = Object.freeze([
	...directProofErasureWitChangedPaths
	, ...directProofErasureWitIntegrationPaths
]);
export const directProofErasureWitImplementationAddedPaths = Object.freeze([
	"scripts/check-direct-proof-erasure-wit-ci.mjs"
	, "scripts/run-direct-proof-erasure-wit-ci.sh"
	, "tests/direct-proof-erasure-wit-installed.test.mjs"
	, "tests/fixtures/direct-proof-erasure-consumers/wit-wasi.c"
	, "tests/helpers/direct-proof-erasure-wit-report.mjs"
	, "tests/helpers/direct-proof-erasure-wit-tests.mjs"
]);
export const directProofErasureWitHistoryAddedPaths = Object.freeze([
	"scripts/update-direct-proof-erasure-wit-source-history.mjs"
	, "tests/helpers/direct-proof-erasure-wit-source-history-tests.mjs"
	, "tests/helpers/direct-proof-erasure-wit-source-history.mjs"
]);
export const directProofErasureWitAddedPaths = Object.freeze([
	...directProofErasureWitImplementationAddedPaths
	, ...directProofErasureWitHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	directProofErasureWitHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated WIT-package transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseDirectProofErasureWitUpdate = (source, update) => {
	assert.ok(directProofErasureWitNormalizationPaths.includes(update.path));
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
 * Remove recognized WIT-package transitions newest first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeDirectProofErasureWitSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasureWitNormalizationPaths.includes(path))
		return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseDirectProofErasureWitUpdate(current, update);
	}
	return current;
};
