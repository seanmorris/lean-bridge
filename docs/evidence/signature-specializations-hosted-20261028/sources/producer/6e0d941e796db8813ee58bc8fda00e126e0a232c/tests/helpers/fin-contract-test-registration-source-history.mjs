/**
 * Reverse the final Fin contract-test registration and exact live-pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const finContractTestRegistrationHistoryPath
	= "docs/evidence/fin-contract-test-registration-source-history-20261028.json";
export const finContractTestRegistrationPredecessor
	= "404149b8ae99be49f1db232ca68ca0da0703c817";
export const finContractTestRegistrationImplementation
	= "decafa1b57a99dfc0d6f1d4778031978baa5ba04";
export const finContractTestRegistrationCommits = Object.freeze([
	"857e431fc584e91693e58255c0f4c4ae08eb6e09"
	, "decafa1b57a99dfc0d6f1d4778031978baa5ba04"
]);
export const finContractTestRegistrationChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const finContractTestRegistrationNormalizationPaths
	= finContractTestRegistrationChangedPaths;
export const finContractTestRegistrationAddedPaths = Object.freeze([
	"scripts/update-fin-contract-test-registration-source-history.mjs"
	, "tests/helpers/fin-contract-test-registration-source-history-tests.mjs"
	, "tests/helpers/fin-contract-test-registration-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	finContractTestRegistrationHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseFinContractTestRegistrationUpdate = (source, update) => {
	assert.ok(finContractTestRegistrationNormalizationPaths.includes(
		update.path));
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
 * Remove only the recognized final Fin test-registration layer.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional digest at which normalization stops.
 */
export const beforeFinContractTestRegistrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !finContractTestRegistrationNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = value.updates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseFinContractTestRegistrationUpdate(source, update);
};
