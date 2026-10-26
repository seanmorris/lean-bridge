/**
 * Preserve the exact owned-Subtype test-profile live-pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeTestProfilePinRepairHistoryPath
	= "docs/evidence/owned-subtype-test-profile-pin-repair-source-history-20261023.json";
export const ownedSubtypeTestProfilePinRepairPredecessor
	= "6dd064096b16a249e168831100a60a48b0853219";
export const ownedSubtypeTestProfilePinRepairImplementation
	= "45a76a928085ca6b9de9f9f01760ab9d5e74d05f";
export const ownedSubtypeTestProfilePinRepairPreviousSha256
	= "1755656b9eb9339ea58f6fbc1d9cb2364d5b1a6e869ea49b23998e4abd138b12";
export const ownedSubtypeTestProfilePinRepairCurrentSha256
	= "a61f10d548f706386965331b76f5e7a9ca695ac867e7aaf419124aedaa397651";
export const ownedSubtypeTestProfilePinRepairPin = Object.freeze({
	path: "src/adoption/test-profiles.mjs"
	, previousSha256: ownedSubtypeTestProfilePinRepairPreviousSha256
	, currentSha256: ownedSubtypeTestProfilePinRepairCurrentSha256
	, count: 98
});
export const ownedSubtypeTestProfilePinRepairImplementationPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const ownedSubtypeTestProfilePinRepairIntegrationPaths = Object.freeze([
	"tests/checked-record-perl-acceptance.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const ownedSubtypeTestProfilePinRepairNormalizationPaths
	= Object.freeze([
		...ownedSubtypeTestProfilePinRepairImplementationPaths
		, ...ownedSubtypeTestProfilePinRepairIntegrationPaths
	]);
export const ownedSubtypeTestProfilePinRepairAddedPaths = Object.freeze([
	"scripts/update-owned-subtype-test-profile-pin-repair-source-history.mjs"
	, "tests/helpers/owned-subtype-test-profile-pin-repair-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-test-profile-pin-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeTestProfilePinRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseOwnedSubtypeTestProfilePinRepairUpdate = (source, update) => {
	assert.ok(ownedSubtypeTestProfilePinRepairNormalizationPaths.includes(
		update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	if(update.replacements !== undefined)
	{
		assert.deepEqual(update.replacements, [{
			previous: ownedSubtypeTestProfilePinRepairPreviousSha256
			, current: ownedSubtypeTestProfilePinRepairCurrentSha256
			, count: ownedSubtypeTestProfilePinRepairPin.count
		}]);
		assert.equal(source.split(
			ownedSubtypeTestProfilePinRepairCurrentSha256).length - 1
		, ownedSubtypeTestProfilePinRepairPin.count, update.path);
		const previous = source.replaceAll(
			ownedSubtypeTestProfilePinRepairCurrentSha256
			, ownedSubtypeTestProfilePinRepairPreviousSha256);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		return previous;
	}
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
 * Remove one recognized transition. The central history hub owns stop logic.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, handled by the central hub.
 */
export const beforeOwnedSubtypeTestProfilePinRepairSource = (
	path, source, expected
) => {
	void expected;
	if(typeof source !== "string"
		|| !ownedSubtypeTestProfilePinRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates].find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseOwnedSubtypeTestProfilePinRepairUpdate(source, update);
};
