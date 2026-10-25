/**
 * Authenticate hosted Subtype promotion while preserving original evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeHostedPromotionHistoryPath
	= "docs/evidence/owned-subtype-hosted-promotion-source-history-20261025.json";
export const ownedSubtypeHostedPromotionPredecessor
	= "9d79ed3b9e1e044d96670403723a127ed25e42a1";
export const ownedSubtypeHostedPromotionImplementation
	= "246ab1d2fdd3f736104a3123a6210797839ad200";
export const ownedSubtypeHostedPromotionIntegrationBase
	= "246ab1d2fdd3f736104a3123a6210797839ad200";
export const ownedSubtypeHostedPromotionCommits = Object.freeze([
	"246ab1d2fdd3f736104a3123a6210797839ad200"
]);
export const ownedSubtypeHostedPromotionChangedPaths = Object.freeze([
	"docs/contributing/testing.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/owned-subtype-promotion.mjs"
	, "tests/owned-subtype-promotion.test.mjs"
]);
export const ownedSubtypeHostedPromotionImplementationAddedPaths = Object.freeze([
	"scripts/check-owned-subtype-hosted-evidence.mjs"
	, "tests/helpers/owned-subtype-promotion-catalog.mjs"
	, "tests/owned-subtype-hosted-promotion.test.mjs"
]);
export const ownedSubtypeHostedPromotionImplementationPaths = Object.freeze([
	...ownedSubtypeHostedPromotionChangedPaths
	, ...ownedSubtypeHostedPromotionImplementationAddedPaths
]);
export const ownedSubtypeHostedPromotionIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedSubtypeHostedPromotionNormalizationPaths = Object.freeze([
	...ownedSubtypeHostedPromotionChangedPaths
	, ...ownedSubtypeHostedPromotionIntegrationPaths
]);
export const ownedSubtypeHostedPromotionHistoryAddedPaths = Object.freeze([
	"docs/evidence/owned-subtype-hosted-promotion-20261025.json"
	, "scripts/update-owned-subtype-hosted-promotion-source-history.mjs"
	, "tests/helpers/owned-subtype-hosted-promotion-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-hosted-promotion-source-history.mjs"
]);
export const ownedSubtypeHostedPromotionAddedPaths = Object.freeze([
	...ownedSubtypeHostedPromotionImplementationAddedPaths
	, ...ownedSubtypeHostedPromotionHistoryAddedPaths
]);
export const ownedSubtypeHostedPromotionPins = Object.freeze([
	Object.freeze({
		path: "docs/contributing/testing.md"
		, count: 11
		, previousSha256: "1a85cc6972b45ad40a707d7b9932d934ab1fdd0f2c818d70cb2cb9f53d87b8ac"
		, currentSha256: "dabb64c8b65335a612378da0cb3b8cfbc87c6960e4121fa593a7727f067a6379"
	})
	, Object.freeze({
		path: "scripts/generate-type-docs.mjs"
		, count: 121
		, previousSha256: "5e2b3b19bcc541ced724b1dbf5a0ed371afc1c9ca0d8d5987548c5a06efb01e3"
		, currentSha256: "92311b9d1695fdb6181461ef41edffa9757df8c64e05d3e4ff50af2bc07eeadf"
	})
	, Object.freeze({
		path: "src/adoption/test-profiles.mjs"
		, count: 98
		, previousSha256: "5e0411d2d1cec05cc0171baccde0cf7d01a1a88b6c1cac8ee7b9ca238867fa20"
		, currentSha256: "c9d875ffc7e5983666e24a169b0f01f01a88f1125a9ba668ebb988b8bacf5d81"
	})
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeHostedPromotionHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedSubtypeHostedPromotionUpdate = (
	source, update
) => {
	assert.ok(ownedSubtypeHostedPromotionNormalizationPaths
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
 * Remove only the exact Owned Subtype hosted promotion.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedSubtypeHostedPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedSubtypeHostedPromotionNormalizationPaths.includes(path))
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
		current = reverseOwnedSubtypeHostedPromotionUpdate(current, update);
	}
	return current;
};
