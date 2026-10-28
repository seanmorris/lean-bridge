/**
 * Reverse the explicit Owned Subtype delegation repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeDelegationRepairHistoryPath
	= "docs/evidence/owned-subtype-delegation-repair-source-history-20261024.json";
export const ownedSubtypeDelegationRepairPredecessor
	= "3bc6015abe6ee91be8e4d226e0d61f91954388bc";
export const ownedSubtypeDelegationRepairImplementation
	= "f3a551a5e17ff633b0ff692d1d836ab2e43fce66";
export const ownedSubtypeDelegationRepairFollowupPredecessor
	= "27a6923732ee6c93744129bcb940f9f8c0837090";
export const ownedSubtypeDelegationRepairFollowup
	= "8b219d3e94312acac6956f24a0dc4a306bd6b0d9";
export const ownedSubtypeDelegationRepairIntegrationBase
	= "d6c311bf145ab3c03713b3dbfeeadc7d30c89ee7";
export const ownedSubtypeDelegationRepairChangedPaths = Object.freeze([
	"tests/fixtures/php-wasm-refinement-entry/driver.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-plan-tests.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-plan.mjs"
	, "tests/helpers/php-wasm-refinement-entry-driver-tests.mjs"
]);
export const ownedSubtypeDelegationRepairFollowupPaths = Object.freeze([
	"tests/fixtures/php-wasm-refinement-entry/driver.mjs"
	, "tests/helpers/php-wasm-refinement-entry-driver-tests.mjs"
]);
export const ownedSubtypeDelegationRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
	, ...ownedSubtypeDelegationRepairFollowupPaths
]);
export const ownedSubtypeDelegationRepairNormalizationPaths = Object.freeze([
	...ownedSubtypeDelegationRepairChangedPaths
	, ...ownedSubtypeDelegationRepairIntegrationPaths
]);
export const ownedSubtypeDelegationRepairAddedPaths = Object.freeze([
	"scripts/update-owned-subtype-delegation-repair-source-history.mjs"
	, "tests/helpers/owned-subtype-delegation-repair-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-delegation-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeDelegationRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedSubtypeDelegationRepairUpdate = (
	source, update
) => {
	assert.ok(ownedSubtypeDelegationRepairNormalizationPaths
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
 * Remove only the exact Owned Subtype delegation repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedSubtypeDelegationRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedSubtypeDelegationRepairNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseOwnedSubtypeDelegationRepairUpdate(current, update);
	}
	return current;
};
