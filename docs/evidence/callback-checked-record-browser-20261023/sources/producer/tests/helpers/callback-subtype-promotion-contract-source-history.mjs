/**
 * Reverse the callback Subtype promotion-contract transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypePromotionContractHistoryPath
	= "docs/evidence/callback-subtype-promotion-contract-source-history-20261022.json";
export const callbackSubtypePromotionContractPredecessor
	= "9f5f9825ff48afa0e052a204f3dcd8bcdb0c47eb";
export const callbackSubtypePromotionContractImplementation
	= "83d7e48880117fea3b2bd9c92bba212e374c2235";
export const callbackSubtypePromotionContractImplementationPaths
	= Object.freeze([
		"scripts/promote-callback-subtype-evidence.mjs"
		, "tests/callback-subtype-promotion.test.mjs"
		, "tests/helpers/callback-subtype-promotion.mjs"
	]);
export const callbackSubtypePromotionContractModifiedPaths
	= Object.freeze([]);
export const callbackSubtypePromotionContractIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const callbackSubtypePromotionContractChangedPaths
	= Object.freeze([
		...callbackSubtypePromotionContractModifiedPaths
		, ...callbackSubtypePromotionContractIntegrationPaths
	]);
export const callbackSubtypePromotionContractAddedPaths
	= Object.freeze([
		"scripts/promote-callback-subtype-evidence.mjs"
		, "scripts/update-callback-subtype-promotion-contract-source-history.mjs"
		, "tests/callback-subtype-promotion.test.mjs"
		, "tests/helpers/callback-subtype-promotion-contract-source-history-tests.mjs"
		, "tests/helpers/callback-subtype-promotion-contract-source-history.mjs"
		, "tests/helpers/callback-subtype-promotion.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypePromotionContractHistoryPath, "utf8"));

/**
 * Restore one exact source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackSubtypePromotionContractUpdate
	= (source, update) => {
		assert.ok(callbackSubtypePromotionContractChangedPaths
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
 * Remove only the exact promotion-contract transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypePromotionContractSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackSubtypePromotionContractChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCallbackSubtypePromotionContractUpdate(source, update)
		: source;
};
