/**
 * Preserve the exact C/C++ direct proof-erasure package acceptance lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureNativeHistoryPath
	= "docs/evidence/direct-proof-erasure-native-source-history-20261028.json";
export const directProofErasureNativePredecessor
	= "48ad5784dc7d6ca6fa968223b0a4e46e2352a541";
export const directProofErasureNativeImplementation
	= "d3d7d1a9cf72e0e9bddbe695a71bf68e4ee54a2c";
export const directProofErasureNativeChangedPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "tests/checked-javascript-partition-11.test.mjs"
]);
export const directProofErasureNativeIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/direct-proof-erasure-fixture-source-history-tests.mjs"
	, "tests/helpers/direct-proof-erasure-npm-source-history-tests.mjs"
	, "tests/helpers/direct-proof-erasure-package-source-history-tests.mjs"
	, "tests/helpers/direct-proof-erasure-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/proof-erasure-evidence-audit-source-history-tests.mjs"
]);
export const directProofErasureNativeNormalizationPaths = Object.freeze([
	...directProofErasureNativeChangedPaths
	, ...directProofErasureNativeIntegrationPaths
]);
export const directProofErasureNativeImplementationAddedPaths = Object.freeze([
	"scripts/check-direct-proof-erasure-native-ci.mjs"
	, "scripts/run-direct-proof-erasure-native-ci.sh"
	, "tests/direct-proof-erasure-native-installed.test.mjs"
	, "tests/fixtures/direct-proof-erasure-consumers/c.c"
	, "tests/fixtures/direct-proof-erasure-consumers/cpp.cpp"
	, "tests/helpers/direct-proof-erasure-native-report.mjs"
	, "tests/helpers/direct-proof-erasure-native-tests.mjs"
]);
export const directProofErasureNativeHistoryAddedPaths = Object.freeze([
	"scripts/update-direct-proof-erasure-native-source-history.mjs"
	, "tests/helpers/direct-proof-erasure-native-source-history-tests.mjs"
	, "tests/helpers/direct-proof-erasure-native-source-history.mjs"
]);
export const directProofErasureNativeAddedPaths = Object.freeze([
	...directProofErasureNativeImplementationAddedPaths
	, ...directProofErasureNativeHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	directProofErasureNativeHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated native acceptance transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseDirectProofErasureNativeUpdate = (source, update) => {
	assert.ok(directProofErasureNativeNormalizationPaths.includes(update.path));
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
 * Remove recognized native package transitions newest first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeDirectProofErasureNativeSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !directProofErasureNativeNormalizationPaths.includes(path)) return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseDirectProofErasureNativeUpdate(current, update);
	}
	return current;
};
