/**
 * Reverse the authenticated owned-Subtype Core profile registration repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeCoreRegistrationHistoryPath
	= "docs/evidence/owned-subtype-core-registration-source-history-20261021.json";
export const ownedSubtypeCoreRegistrationPredecessor
	= "b63c176128abed85f895dd9056e72ac4d7e78ec5";
export const ownedSubtypeCoreRegistrationImplementation
	= "7eeaa3f6072981b5db29e86605bbb0612ede45fc";
export const ownedSubtypeCoreRegistrationTests = Object.freeze([
	"owned-subtype-host-registration-history"
	, "owned-subtype-javascript-packaging"
	, "owned-subtype-language-packaging"
	, "owned-subtype-native-packaging"
	, "owned-subtype-perl-packaging"
	, "owned-subtype-remaining-packaging"
]);
export const ownedSubtypeCoreRegistrationChangedPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
	, "tests/test-profiles.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeCoreRegistrationHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition for the same path.
 */
export const reverseOwnedSubtypeCoreRegistrationUpdate = (source, update) => {
	assert.ok(ownedSubtypeCoreRegistrationChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
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
 * Remove only this exact Core registration repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedSubtypeCoreRegistrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedSubtypeCoreRegistrationChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseOwnedSubtypeCoreRegistrationUpdate(source, update) : source;
};
