/**
 * Authenticate the generic Subtype promotion baseline.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericSubtypePromotionBaselineHistoryPath
	= "docs/evidence/generic-subtype-promotion-baseline-source-history-20261024.json";
export const genericSubtypePromotionBaselinePredecessor
	= "ecdc51a2ca463ad812080d11e8230fc66111d105";
export const genericSubtypePromotionBaselineImplementation
	= "9042222ccb2dc3726b2869c5ca067d605e0ef854";
export const genericSubtypePromotionBaselineIntegrationBase
	= "9042222ccb2dc3726b2869c5ca067d605e0ef854";
export const genericSubtypePromotionBaselineCommits = Object.freeze([
	"9042222ccb2dc3726b2869c5ca067d605e0ef854"
]);
export const genericSubtypePromotionBaselineChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "docs/contributing/testing.md"
	, "tests/checked-javascript.test.mjs"
	, "tests/helpers/generic-subtype-promotion-tests.mjs"
	, "tests/helpers/generic-subtype-promotion.mjs"
]);
export const genericSubtypePromotionBaselineImplementationAddedPaths = Object.freeze([
	"docs/evidence/generic-subtype-promotion-baseline-20261024.json"
	, "tests/helpers/generic-subtype-promotion-baseline-tests.mjs"
	, "tests/helpers/generic-subtype-promotion-baseline.mjs"
	, "tests/helpers/source-history-stream-tests.mjs"
	, "tests/helpers/source-history-stream.mjs"
]);
export const genericSubtypePromotionBaselineImplementationPaths = Object.freeze([
	...genericSubtypePromotionBaselineChangedPaths
	, ...genericSubtypePromotionBaselineImplementationAddedPaths
]);
export const genericSubtypePromotionBaselineIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const genericSubtypePromotionBaselineNormalizationPaths = Object.freeze([
	...genericSubtypePromotionBaselineChangedPaths
	, ...genericSubtypePromotionBaselineIntegrationPaths
]);
export const genericSubtypePromotionBaselineHistoryAddedPaths = Object.freeze([
	"scripts/update-generic-subtype-promotion-baseline-source-history.mjs"
	, "tests/helpers/generic-subtype-promotion-baseline-source-history-tests.mjs"
	, "tests/helpers/generic-subtype-promotion-baseline-source-history.mjs"
]);
export const genericSubtypePromotionBaselineAddedPaths = Object.freeze([
	...genericSubtypePromotionBaselineImplementationAddedPaths
	, ...genericSubtypePromotionBaselineHistoryAddedPaths
]);
export const genericSubtypePromotionBaselinePins = Object.freeze([
	Object.freeze({
		path: "docs/contributing/testing.md"
		, count: 11
		, previousSha256: "e2d4d6d1fe835604ded0c4bc1a047cabd3679bcecc0626adcf94dbcdb4f4be99"
		, currentSha256: "846994037538135be94a0a81e5fca69f0a7ff30b5e7dc6a0a3e514a8e7afd525"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	genericSubtypePromotionBaselineHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseGenericSubtypePromotionBaselineUpdate = (
	source, update
) => {
	assert.ok(genericSubtypePromotionBaselineNormalizationPaths
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
 * Remove only the exact Generic Subtype promotion baseline.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeGenericSubtypePromotionBaselineSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !genericSubtypePromotionBaselineNormalizationPaths.includes(path))
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
		current = reverseGenericSubtypePromotionBaselineUpdate(current, update);
	}
	return current;
};
