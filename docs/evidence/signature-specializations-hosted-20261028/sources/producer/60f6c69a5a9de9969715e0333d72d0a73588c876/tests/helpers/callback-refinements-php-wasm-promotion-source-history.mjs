/**
 * Reverse the exact PHP-Wasm callback-refinement promotion and its history
 * registration without weakening unrelated source transitions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackRefinementsPhpWasmPromotionHistoryPath
	= "docs/evidence/callback-refinements-php-wasm-promotion-source-history-20261023.json";
export const callbackRefinementsPhpWasmPromotionPredecessor
	= "2eaa45f9c753ec4ae6f1ad5e0c91bda13a1ece48";
export const callbackRefinementsPhpWasmPromotionCommit
	= "0e9daa4da49a80cd4ef8c7b6473231d9124468b2";
export const callbackRefinementsPhpWasmPromotionUpdatedPaths = Object.freeze([
	"docs/php.md"
	, "docs/publish/php.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "src/release/php-wasm-copied-package.mjs"
	, "tests/callback-refinements-php-wasm.test.mjs"
	, "tests/helpers/php-wasm-refinement-readme-tests.mjs"
	, "tests/helpers/recursive-subtype-php-wasm-tests.mjs"
	, "tests/php-wasm-fin.test.mjs"
]);
export const callbackRefinementsPhpWasmPromotionAddedPaths = Object.freeze([
	"docs/evidence/callback-refinements-php-wasm-promotion-20261023.md"
	, "scripts/promote-callback-refinements-php-wasm-evidence.mjs"
	, "tests/helpers/callback-refinements-php-wasm-promotion-tests.mjs"
	, "tests/helpers/callback-refinements-php-wasm-promotion.mjs"
]);
export const callbackRefinementsPhpWasmPromotionIntegrationPaths = Object.freeze([
	"tests/callback-refinements-php-wasm.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const callbackRefinementsPhpWasmPromotionHistoryAddedPaths = Object.freeze([
	"scripts/update-callback-refinements-php-wasm-promotion-source-history.mjs"
	, "tests/helpers/callback-refinements-php-wasm-promotion-source-history-tests.mjs"
	, "tests/helpers/callback-refinements-php-wasm-promotion-source-history.mjs"
]);
export const callbackRefinementsPhpWasmPromotionNormalizationPaths
	= Object.freeze([...new Set([
		...callbackRefinementsPhpWasmPromotionUpdatedPaths
		, ...callbackRefinementsPhpWasmPromotionIntegrationPaths
	])]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackRefinementsPhpWasmPromotionHistoryPath, "utf8"));

const reverse = (source, update, paths) => {
	assert.ok(paths.includes(update.path), update.path);
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
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Reverse one promotion source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackRefinementsPhpWasmPromotionUpdate = (
	source, update
) => reverse(source, update, callbackRefinementsPhpWasmPromotionUpdatedPaths);

/**
 * Reverse one history-registration transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackRefinementsPhpWasmPromotionIntegration = (
	source, update
) => reverse(source, update
	, callbackRefinementsPhpWasmPromotionIntegrationPaths);

/**
 * Walk only the authenticated promotion and integration transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackRefinementsPhpWasmPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackRefinementsPhpWasmPromotionNormalizationPaths.includes(path))
		return source;
	let digest = sha256(source);
	while(digest !== expected)
	{
		const integration = record().integrationUpdates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(integration)
		{
			source = reverseCallbackRefinementsPhpWasmPromotionIntegration(
				source, integration);
			digest = sha256(source);
			continue;
		}
		const promotion = record().promotionUpdates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(!promotion) return source;
		source = reverseCallbackRefinementsPhpWasmPromotionUpdate(
			source, promotion);
		digest = sha256(source);
	}
	return source;
};
