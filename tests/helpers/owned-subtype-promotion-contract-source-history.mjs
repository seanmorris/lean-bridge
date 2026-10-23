/**
 * Reverse the exact owned-Subtype promotion-contract foundation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypePromotionContractHistoryPath
	= "docs/evidence/owned-subtype-promotion-contract-source-history-20261023.json";
export const ownedSubtypePromotionContractPredecessor
	= "da5bae8a9e48c3afb2f905c052cc3410f56faf86";
export const ownedSubtypePromotionContractImplementation
	= "a0e7f8e10ff53e8329ae08512f41551c71a5cc92";
export const ownedSubtypePromotionContractModifiedPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const ownedSubtypePromotionContractImplementationAdditions
	= Object.freeze([
		"scripts/promote-owned-subtype-evidence.mjs"
		, "tests/helpers/owned-subtype-promotion.mjs"
		, "tests/owned-subtype-promotion.test.mjs"
	]);
export const ownedSubtypePromotionContractImplementationPaths = Object.freeze([
	...ownedSubtypePromotionContractModifiedPaths
	, ...ownedSubtypePromotionContractImplementationAdditions
]);
export const ownedSubtypePromotionContractIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/php-wasm-fin.test.mjs"
]);
export const ownedSubtypePromotionContractChangedPaths = Object.freeze([
	...ownedSubtypePromotionContractModifiedPaths
	, ...ownedSubtypePromotionContractIntegrationPaths
]);
export const ownedSubtypePromotionContractAddedPaths = Object.freeze([
	"scripts/update-owned-subtype-promotion-contract-source-history.mjs"
	, "tests/helpers/owned-subtype-promotion-contract-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-promotion-contract-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypePromotionContractHistoryPath, "utf8"));

/**
 * Restore one exact authenticated transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedSubtypePromotionContractUpdate = (source, update) => {
	assert.ok(ownedSubtypePromotionContractChangedPaths.includes(update.path));
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
 * Remove only the owned-Subtype promotion-contract layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedSubtypePromotionContractSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedSubtypePromotionContractChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseOwnedSubtypePromotionContractUpdate(source, update) : source;
};
