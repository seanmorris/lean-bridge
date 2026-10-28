/**
 * Reverse the deterministic Core evidence-boundary repairs and their exact
 * live structural-promotion source pins.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreDeterministicBoundaryRepairHistoryPath
	= "docs/evidence/core-deterministic-boundary-repair-source-history-20261028.json";
export const coreDeterministicBoundaryRepairPredecessor
	= "ba34fa69f7d65a6b131b0f3e0207efed05de8dbe";
export const coreDeterministicBoundaryRepairImplementation
	= "096706d8c7366bafd0c5b3935cb876f93932799d";
export const coreDeterministicBoundaryRepairCommits = Object.freeze([
	coreDeterministicBoundaryRepairImplementation
]);
export const coreDeterministicBoundaryRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/checked-record-perl-source-tests.mjs"
	, "tests/helpers/owned-checked-record-published-matrix-tests.mjs"
	, "tests/helpers/owned-php-callback-result-acceptance-tests.mjs"
	, "tests/helpers/owned-php-callback-result-acceptance.mjs"
	, "tests/helpers/owned-wit-callback-result-installed-acceptance-tests.mjs"
	, "tests/helpers/owned-wit-callback-result-installed-acceptance.mjs"
	, "tests/helpers/structural-subtype-ci-report-tests.mjs"
	, "tests/helpers/structural-subtype-promotion.mjs"
	, "tests/owned-transfer-c-evidence.test.mjs"
]);
export const coreDeterministicBoundaryRepairNormalizationPaths
	= coreDeterministicBoundaryRepairChangedPaths;
export const coreDeterministicBoundaryRepairImplementationAddedPaths
	= Object.freeze([]);
export const coreDeterministicBoundaryRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-core-deterministic-boundary-repair-source-history.mjs"
	, "tests/helpers/core-deterministic-boundary-repair-source-history-tests.mjs"
	, "tests/helpers/core-deterministic-boundary-repair-source-history.mjs"
]);
export const coreDeterministicBoundaryRepairAddedPaths = Object.freeze([
	...coreDeterministicBoundaryRepairImplementationAddedPaths
	, ...coreDeterministicBoundaryRepairHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreDeterministicBoundaryRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseCoreDeterministicBoundaryRepairUpdate = (
	source, update
) => {
	assert.ok(coreDeterministicBoundaryRepairNormalizationPaths
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
 * Remove only this layer's recognized transition. The central hub owns
 * stopping and re-entry.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeCoreDeterministicBoundaryRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreDeterministicBoundaryRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseCoreDeterministicBoundaryRepairUpdate(source, update);
};
