/**
 * Reverse central registration of the final Fin contract-test history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const finContractTestRegistrationIntegrationHistoryPath
	= "docs/evidence/fin-contract-test-registration-integration-source-history-20261028.json";
export const finContractTestRegistrationIntegrationBase
	= "882ea967f43076f5606f62d09a296f4d47cbbbbb";
export const finContractTestRegistrationIntegrationImplementation
	= "daf5c9af37da6125667df774bcea3ffaae221941";
export const finContractTestRegistrationIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript-partition-10.test.mjs"
]);
export const finContractTestRegistrationIntegrationNormalizationPaths
	= finContractTestRegistrationIntegrationPaths;
export const finContractTestRegistrationIntegrationAddedPaths = Object.freeze([
	"scripts/update-fin-contract-test-registration-integration-source-history.mjs"
	, "tests/helpers/fin-contract-test-registration-integration-source-history-tests.mjs"
	, "tests/helpers/fin-contract-test-registration-integration-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	finContractTestRegistrationIntegrationHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated integration transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseFinContractTestRegistrationIntegrationUpdate = (
	source, update
) => {
	assert.ok(finContractTestRegistrationIntegrationPaths.includes(
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
 * Remove only this exact central integration layer.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional digest at which normalization stops.
 */
export const beforeFinContractTestRegistrationIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !finContractTestRegistrationIntegrationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseFinContractTestRegistrationIntegrationUpdate(source, update);
};
