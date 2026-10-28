/**
 * Reverse central registration of the authenticated deterministic Core
 * evidence-boundary repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreDeterministicBoundaryRepairIntegrationHistoryPath
	= "docs/evidence/core-deterministic-boundary-repair-integration-source-history-20261028.json";
export const coreDeterministicBoundaryRepairIntegrationBase
	= "41d02c0b55bdb6f64628375633841db19a97e6e6";
export const coreDeterministicBoundaryRepairIntegrationImplementation
	= "fecd6b8e924432d987ca902df8bec01c12d16ee9";
export const coreDeterministicBoundaryRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript-partition-10.test.mjs"
]);
export const coreDeterministicBoundaryRepairIntegrationNormalizationPaths
	= coreDeterministicBoundaryRepairIntegrationPaths;
export const coreDeterministicBoundaryRepairIntegrationAddedPaths
	= Object.freeze([
		"scripts/update-core-deterministic-boundary-repair-integration-source-history.mjs"
		, "tests/helpers/core-deterministic-boundary-repair-integration-source-history-tests.mjs"
		, "tests/helpers/core-deterministic-boundary-repair-integration-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreDeterministicBoundaryRepairIntegrationHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated integration transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseCoreDeterministicBoundaryRepairIntegrationUpdate = (
	source, update
) => {
	assert.ok(coreDeterministicBoundaryRepairIntegrationPaths
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
 * Remove only this integration layer, stopping at an optional exact digest.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source text.
 * @param {string} [expected] - Optional exact stopping digest.
 */
export const beforeCoreDeterministicBoundaryRepairIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreDeterministicBoundaryRepairIntegrationPaths.includes(path))
		return source;
	if(sha256(source) === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === sha256(source));
	return update === undefined ? source
		: reverseCoreDeterministicBoundaryRepairIntegrationUpdate(
			source, update);
};
