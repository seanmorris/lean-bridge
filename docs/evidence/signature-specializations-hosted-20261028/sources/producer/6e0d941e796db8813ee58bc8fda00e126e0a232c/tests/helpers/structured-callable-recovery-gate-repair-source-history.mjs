/**
 * Reverse the structured callable recovery gate repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const structuredCallableRecoveryGateRepairHistoryPath
	= "docs/evidence/structured-callable-recovery-gate-repair-source-history-20261024.json";
export const structuredCallableRecoveryGateRepairPredecessor
	= "886d98fedb8ed157dc2cf8a0f5420b2efa3a3719";
export const structuredCallableRecoveryGateRepairImplementation
	= "11a83d9fb72fa6310fbf41baf01e5ef62fd366b7";
export const structuredCallableRecoveryGateRepairChangedPaths = Object.freeze([
	"src/build/component-structured-callable-adapters.mjs"
	, "tests/component-structured-callable-contract.test.mjs"
]);
export const structuredCallableRecoveryGateRepairIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const structuredCallableRecoveryGateRepairNormalizationPaths
	= Object.freeze([
		...structuredCallableRecoveryGateRepairChangedPaths
		, ...structuredCallableRecoveryGateRepairIntegrationPaths
	]);
export const structuredCallableRecoveryGateRepairAddedPaths = Object.freeze([
	"scripts/update-structured-callable-recovery-gate-repair-source-history.mjs"
	, "tests/helpers/structured-callable-recovery-gate-repair-source-history-tests.mjs"
	, "tests/helpers/structured-callable-recovery-gate-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	structuredCallableRecoveryGateRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Exact recorded transition.
 */
export const reverseStructuredCallableRecoveryGateRepairUpdate = (
	source, update
) => {
	assert.ok(structuredCallableRecoveryGateRepairNormalizationPaths
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
 * Remove only the exact structured callable recovery gate repair.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional digest at which normalization stops.
 */
export const beforeStructuredCallableRecoveryGateRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !structuredCallableRecoveryGateRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseStructuredCallableRecoveryGateRepairUpdate(source, update);
};
