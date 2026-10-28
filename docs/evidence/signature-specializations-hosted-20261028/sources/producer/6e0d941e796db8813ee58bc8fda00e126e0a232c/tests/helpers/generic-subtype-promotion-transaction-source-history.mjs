/**
 * Authenticate the generic Subtype promotion transaction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericSubtypePromotionTransactionHistoryPath
	= "docs/evidence/generic-subtype-promotion-transaction-source-history-20261024.json";
export const genericSubtypePromotionTransactionPredecessor
	= "0214d972d6faed3da5287dcc833d3244200a80c6";
export const genericSubtypePromotionTransactionImplementation
	= "5b89f142c9433295816764c63c9ff3adfcd2588b";
export const genericSubtypePromotionTransactionIntegrationBase
	= "5b89f142c9433295816764c63c9ff3adfcd2588b";
export const genericSubtypePromotionTransactionCommits = Object.freeze([
	"5b89f142c9433295816764c63c9ff3adfcd2588b"
]);
export const genericSubtypePromotionTransactionChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "docs/contributing/testing.md"
	, "scripts/generate-type-docs.mjs"
	, "scripts/promote-generic-subtype-evidence.mjs"
	, "tests/checked-javascript.test.mjs"
	, "tests/helpers/generic-subtype-promotion-tests.mjs"
	, "tests/helpers/generic-subtype-promotion.mjs"
]);
export const genericSubtypePromotionTransactionImplementationAddedPaths = Object.freeze([
	"tests/helpers/promotion-file-transaction-tests.mjs"
	, "tests/helpers/promotion-file-transaction.mjs"
	, "tests/helpers/type-surface-promotion-io-tests.mjs"
	, "tests/helpers/type-surface-promotion-io.mjs"
]);
export const genericSubtypePromotionTransactionImplementationPaths = Object.freeze([
	...genericSubtypePromotionTransactionChangedPaths
	, ...genericSubtypePromotionTransactionImplementationAddedPaths
]);
export const genericSubtypePromotionTransactionIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const genericSubtypePromotionTransactionNormalizationPaths = Object.freeze([
	...genericSubtypePromotionTransactionChangedPaths
	, ...genericSubtypePromotionTransactionIntegrationPaths
]);
export const genericSubtypePromotionTransactionHistoryAddedPaths = Object.freeze([
	"scripts/update-generic-subtype-promotion-transaction-source-history.mjs"
	, "tests/helpers/generic-subtype-promotion-transaction-source-history-tests.mjs"
	, "tests/helpers/generic-subtype-promotion-transaction-source-history.mjs"
]);
export const genericSubtypePromotionTransactionAddedPaths = Object.freeze([
	...genericSubtypePromotionTransactionImplementationAddedPaths
	, ...genericSubtypePromotionTransactionHistoryAddedPaths
]);
export const genericSubtypePromotionTransactionPins = Object.freeze([
	Object.freeze({
		path: "docs/contributing/testing.md"
		, count: 11
		, previousSha256: "5ef920ff619dbd6488d006a1d922264d3c0d405e0969fa4caa2c683c9adbd657"
		, currentSha256: "e2d4d6d1fe835604ded0c4bc1a047cabd3679bcecc0626adcf94dbcdb4f4be99"
	})
	, Object.freeze({
		path: "scripts/generate-type-docs.mjs"
		, count: 110
		, previousSha256: "684469bda6e9088294cef8fdefbedbbe6587d12adc529ee13511410c159e2d95"
		, currentSha256: "be538dbe92fd5698d7b5e1f3fb3238ffae521e93b009e0a4c78f13c94fd8bbbc"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	genericSubtypePromotionTransactionHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseGenericSubtypePromotionTransactionUpdate = (
	source, update
) => {
	assert.ok(genericSubtypePromotionTransactionNormalizationPaths
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
 * Remove only the exact Generic Subtype promotion transaction.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeGenericSubtypePromotionTransactionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !genericSubtypePromotionTransactionNormalizationPaths.includes(path))
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
		current = reverseGenericSubtypePromotionTransactionUpdate(current, update);
	}
	return current;
};
