/**
 * Authenticate nominal browser support without rewriting previous evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNominalSubtypePhpWasmRegistrationSource } from "./nominal-subtype-php-wasm-registration-history.mjs";

export const nominalSubtypeBrowserPromotionHistoryPath = "docs/evidence/nominal-subtype-browser-promotion-source-history-20261014.json";
export const nominalSubtypeBrowserPromotionPredecessor = "fc95d2c5ff661164d8bc966846cbc2b2adbafa0a";
export const nominalSubtypeBrowserPromotionChangedPaths = [
	"docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-author-tests.mjs"
	, "tests/helpers/nominal-subtype-browser-registration-history.mjs"
	, "tests/helpers/nominal-subtype-browser-tests.mjs"
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
export const reverseNominalSubtypeBrowserPromotionUpdate = (source, update) => {
	assert.ok(nominalSubtypeBrowserPromotionChangedPaths.includes(update.path));
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
export const beforeNominalSubtypeBrowserPromotionSource = (path, source, expected) => {
	source = beforeNominalSubtypePhpWasmRegistrationSource(path, source, expected);
	if(typeof source !== "string" || !nominalSubtypeBrowserPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalSubtypeBrowserPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalSubtypeBrowserPromotionUpdate(source, update) : source;
};

/**
 * Reconstruct validator pins before this milestone for earlier acceptance tests.
 *
 * @param inventory - Historical inventory recomputed with current validator hashes.
 */
export const beforeNominalSubtypeBrowserPromotionPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(nominalSubtypeBrowserPromotionHistoryPath, "utf8"));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256) file.sha256 = update.previousSha256;
	}
	return previous;
};
