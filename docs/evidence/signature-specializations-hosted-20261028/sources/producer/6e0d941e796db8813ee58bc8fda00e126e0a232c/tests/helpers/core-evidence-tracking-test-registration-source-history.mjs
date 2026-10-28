/**
 * Reverse the Core evidence-tracking test registration repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreEvidenceTrackingTestRegistrationHistoryPath
	= "docs/evidence/core-evidence-tracking-test-registration-source-history-20261024.json";
export const coreEvidenceTrackingTestRegistrationPredecessor
	= "7817e56b1ad9ac7039a075f411fc315e22200a90";
export const coreEvidenceTrackingTestRegistrationImplementation
	= "a48cddd81ac04129b21a35bf54977792982339cf";
export const coreEvidenceTrackingTestRegistrationChangedPaths
	= Object.freeze(["src/adoption/test-profiles.mjs"]);
export const coreEvidenceTrackingTestRegistrationIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const coreEvidenceTrackingTestRegistrationNormalizationPaths
	= Object.freeze([
		...coreEvidenceTrackingTestRegistrationChangedPaths
		, ...coreEvidenceTrackingTestRegistrationIntegrationPaths
	]);
export const coreEvidenceTrackingTestRegistrationAddedPaths
	= Object.freeze([
		"scripts/update-core-evidence-tracking-test-registration-source-history.mjs"
		, "tests/helpers/core-evidence-tracking-test-registration-source-history-tests.mjs"
		, "tests/helpers/core-evidence-tracking-test-registration-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreEvidenceTrackingTestRegistrationHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Exact recorded transition.
 */
export const reverseCoreEvidenceTrackingTestRegistrationUpdate = (
	source, update
) => {
	assert.ok(coreEvidenceTrackingTestRegistrationNormalizationPaths
		.includes(update.path));
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
 * Remove only the exact Core registration transition.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional digest at which normalization stops.
 */
export const beforeCoreEvidenceTrackingTestRegistrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreEvidenceTrackingTestRegistrationNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseCoreEvidenceTrackingTestRegistrationUpdate(source, update);
};
