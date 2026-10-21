/**
 * Authenticate nominal PHP-Wasm support without rewriting previous evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNominalPrimitiveSubtypeRegistrationSource } from "./nominal-primitive-subtype-registration-history.mjs";
import { beforePhpWasmCorpusPartitionPins } from "./php-wasm-corpus-partition-history.mjs";

export const nominalSubtypePhpWasmPromotionHistoryPath = "docs/evidence/nominal-subtype-php-wasm-promotion-source-history-20261014.json";
export const nominalSubtypePhpWasmPromotionPredecessor = "08a9034d239cb9e753dde04dd53d712207811f3a";
export const nominalSubtypePhpWasmPromotionChangedPaths = [
	"docs/php.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-author-tests.mjs"
	, "tests/helpers/nominal-subtype-browser-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-browser-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-npm-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-npm-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-php-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-php-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-registration-history.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-tests.mjs"
	, "tests/helpers/nominal-subtype-wit-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-wit-promotion-tests.mjs"
	, "tests/helpers/structural-subtype-promotion-tests.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse only complete transitions with exact source digests and spans.
 *
 * @param source - Complete current file text.
 * @param update - Authenticated immutable transition.
 */
export const reverseNominalSubtypePhpWasmPromotionUpdate = (source, update) => {
	assert.ok(nominalSubtypePhpWasmPromotionChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join(""); assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Preserve unknown edits and stop at explicitly requested source epochs.
 *
 * @param path - Repository-relative file path.
 * @param source - Complete current source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNominalSubtypePhpWasmPromotionSource = (path, source, expected) => {
	source = beforeNominalPrimitiveSubtypeRegistrationSource(path, source, expected);
	if(typeof source !== "string" || !nominalSubtypePhpWasmPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalSubtypePhpWasmPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalSubtypePhpWasmPromotionUpdate(source, update) : source;
};

/**
 * Reconstruct validator pins before this milestone for earlier acceptance tests.
 *
 * @param inventory - Historical inventory recomputed with current validator hashes.
 */
export const beforeNominalSubtypePhpWasmPromotionPins = inventory => {
	const previous = beforePhpWasmCorpusPartitionPins(inventory);
	const record = history ??= JSON.parse(readFileSync(nominalSubtypePhpWasmPromotionHistoryPath, "utf8"));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256) file.sha256 = update.previousSha256;
	}
	return previous;
};
