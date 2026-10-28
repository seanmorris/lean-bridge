/**
 * Preserve the exact npm and browser direct proof-erasure acceptance lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureNpmHistoryPath
	= "docs/evidence/direct-proof-erasure-npm-source-history-20261028.json";
export const directProofErasureNpmPredecessor
	= "597270ffd263f817602a1f5b726a25bfc73c0a3a";
export const directProofErasureNpmImplementation
	= "2513857ab9950bf16e26b07cf707c74b2ead3890";
export const directProofErasureNpmChangedPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "tests/checked-javascript-partition-11.test.mjs"
]);
export const directProofErasureNpmIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const directProofErasureNpmNormalizationPaths = Object.freeze([
	...directProofErasureNpmChangedPaths, ...directProofErasureNpmIntegrationPaths
]);
export const directProofErasureNpmImplementationAddedPaths = Object.freeze([
	"scripts/check-direct-proof-erasure-npm-ci.mjs"
	, "scripts/run-direct-proof-erasure-npm-ci.sh"
	, "tests/direct-proof-erasure-npm-installed.test.mjs"
	, "tests/fixtures/direct-proof-erasure-consumers/browser.mjs"
	, "tests/fixtures/direct-proof-erasure-consumers/index.mts"
	, "tests/fixtures/direct-proof-erasure-consumers/javascript.mjs"
	, "tests/helpers/direct-proof-erasure-browser-tests.mjs"
	, "tests/helpers/direct-proof-erasure-browser.mjs"
	, "tests/helpers/direct-proof-erasure-npm-report.mjs"
]);
export const directProofErasureNpmHistoryAddedPaths = Object.freeze([
	"scripts/update-direct-proof-erasure-npm-source-history.mjs"
	, "tests/helpers/direct-proof-erasure-npm-source-history-tests.mjs"
	, "tests/helpers/direct-proof-erasure-npm-source-history.mjs"
]);
export const directProofErasureNpmAddedPaths = Object.freeze([
	...directProofErasureNpmImplementationAddedPaths
	, ...directProofErasureNpmHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	directProofErasureNpmHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated npm acceptance transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseDirectProofErasureNpmUpdate = (source, update) => {
	assert.ok(directProofErasureNpmNormalizationPaths.includes(update.path));
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
 * Remove recognized npm acceptance transitions newest first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeDirectProofErasureNpmSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !directProofErasureNpmNormalizationPaths.includes(path)) return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseDirectProofErasureNpmUpdate(current, update);
	}
	return current;
};
