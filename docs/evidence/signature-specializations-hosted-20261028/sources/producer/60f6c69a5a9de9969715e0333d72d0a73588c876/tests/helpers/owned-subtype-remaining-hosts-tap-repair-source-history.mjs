/**
 * Reverse the remaining owned Subtype hosted-lane TAP repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeRemainingHostsTapRepairHistoryPath
	= "docs/evidence/owned-subtype-remaining-hosts-tap-repair-source-history-20261024.json";
export const ownedSubtypeRemainingHostsTapRepairPredecessor
	= "7346de20456d0639bc605016a8e000c0af4c5049";
export const ownedSubtypeRemainingHostsTapRepairImplementation
	= "0fa543fe8af38bf534cfa0db2b837e35763d59af";
export const ownedSubtypeRemainingHostsTapRepairChangedPaths = Object.freeze([
	"tests/helpers/owned-subtype-hosted-ci.mjs"
	, "tests/owned-subtype-hosted-ci.test.mjs"
	, "tests/owned-subtype-remaining-packaging.test.mjs"
]);
export const ownedSubtypeRemainingHostsTapRepairIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const ownedSubtypeRemainingHostsTapRepairNormalizationPaths
	= Object.freeze([
		...ownedSubtypeRemainingHostsTapRepairChangedPaths
		, ...ownedSubtypeRemainingHostsTapRepairIntegrationPaths
	]);
export const ownedSubtypeRemainingHostsTapRepairAddedPaths = Object.freeze([
	"scripts/update-owned-subtype-remaining-hosts-tap-repair-source-history.mjs"
	, "tests/helpers/owned-subtype-remaining-hosts-tap-repair-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-remaining-hosts-tap-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeRemainingHostsTapRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Exact recorded transition.
 */
export const reverseOwnedSubtypeRemainingHostsTapRepairUpdate = (
	source, update
) => {
	assert.ok(ownedSubtypeRemainingHostsTapRepairNormalizationPaths
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
 * Remove only the exact hosted-lane TAP repair.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional digest at which normalization stops.
 */
export const beforeOwnedSubtypeRemainingHostsTapRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedSubtypeRemainingHostsTapRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseOwnedSubtypeRemainingHostsTapRepairUpdate(source, update);
};
