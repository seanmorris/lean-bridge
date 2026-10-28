/**
 * Authenticate transactional Subtype promotion while preserving original evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypePromotionTransactionHistoryPath
	= "docs/evidence/owned-subtype-promotion-transaction-source-history-20261025.json";
export const ownedSubtypePromotionTransactionPredecessor
	= "9e571b4214df98e1b8d0319f24fe7b6729ab34ba";
export const ownedSubtypePromotionTransactionImplementation
	= "5d284895f6dc32b5ad855cee8a621f4779db91e0";
export const ownedSubtypePromotionTransactionIntegrationBase
	= "5d284895f6dc32b5ad855cee8a621f4779db91e0";
export const ownedSubtypePromotionTransactionCommits = Object.freeze([
	"5d284895f6dc32b5ad855cee8a621f4779db91e0"
]);
export const ownedSubtypePromotionTransactionChangedPaths = Object.freeze([
	"docs/contributing/testing.md"
	, "docs/type-surface.v1.json"
	, "scripts/promote-owned-subtype-evidence.mjs"
	, "tests/helpers/owned-subtype-documentation.mjs"
	, "tests/helpers/owned-subtype-promotion.mjs"
	, "tests/owned-subtype-hosted-promotion.test.mjs"
	, "tests/owned-subtype-promotion.test.mjs"
]);
export const ownedSubtypePromotionTransactionImplementationAddedPaths = Object.freeze([
	"tests/helpers/owned-subtype-promotion-archive-references.mjs"
	, "tests/helpers/owned-subtype-promotion-transaction-tests.mjs"
]);
export const ownedSubtypePromotionTransactionImplementationPaths = Object.freeze([
	...ownedSubtypePromotionTransactionChangedPaths
	, ...ownedSubtypePromotionTransactionImplementationAddedPaths
]);
export const ownedSubtypePromotionTransactionIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedSubtypePromotionTransactionNormalizationPaths = Object.freeze([
	...ownedSubtypePromotionTransactionChangedPaths
	, ...ownedSubtypePromotionTransactionIntegrationPaths
]);
export const ownedSubtypePromotionTransactionHistoryAddedPaths = Object.freeze([
	"docs/evidence/owned-subtype-promotion-transaction-20261025.json"
	, "scripts/update-owned-subtype-promotion-transaction-source-history.mjs"
	, "tests/helpers/owned-subtype-promotion-transaction-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-promotion-transaction-source-history.mjs"
]);
export const ownedSubtypePromotionTransactionAddedPaths = Object.freeze([
	...ownedSubtypePromotionTransactionImplementationAddedPaths
	, ...ownedSubtypePromotionTransactionHistoryAddedPaths
]);
export const ownedSubtypePromotionTransactionPins = Object.freeze([
	Object.freeze({
		path: "docs/contributing/testing.md"
		, count: 11
		, previousSha256: "dabb64c8b65335a612378da0cb3b8cfbc87c6960e4121fa593a7727f067a6379"
		, currentSha256: "cab259e552316b78b66f1bfcd53dd58537d04f7216edcce2a1fe40fad74cfc40"
	})
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypePromotionTransactionHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedSubtypePromotionTransactionUpdate = (
	source, update
) => {
	assert.ok(ownedSubtypePromotionTransactionNormalizationPaths
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
 * Remove only the exact Owned Subtype transactional promotion.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedSubtypePromotionTransactionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedSubtypePromotionTransactionNormalizationPaths.includes(path))
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
		current = reverseOwnedSubtypePromotionTransactionUpdate(current, update);
	}
	return current;
};

