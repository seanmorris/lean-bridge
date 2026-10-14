/**
 * Authenticate the exact primitive-base Node support and documentation transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNominalPrimitiveSubtypePythonRegistrationSource } from "./nominal-primitive-subtype-python-registration-history.mjs";
import { beforeNominalPrimitiveSubtypePythonPromotionPins } from "./nominal-primitive-subtype-python-promotion-history.mjs";

export const nominalPrimitiveSubtypeNpmPromotionHistoryPath = "docs/evidence/nominal-primitive-subtype-npm-promotion-source-history-20261014.json";
export const nominalPrimitiveSubtypeNpmPromotionPredecessor = "4a908bb209b8692e4f4b58654b2b32fd0c60bbbb";
export const nominalPrimitiveSubtypeNpmPromotionChangedPaths = [
	"docs/javascript-typescript.md"
	, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
	, "docs/reference/types.md", "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-path-history.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-tests.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse only a complete transition with exact before and after digests.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated immutable transition.
 */
export const reverseNominalPrimitiveSubtypeNpmPromotionUpdate = (source, update) => {
	assert.ok(nominalPrimitiveSubtypeNpmPromotionChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string"); assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous); cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor)); const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path); return previous;
};

/**
 * Preserve unknown edits and stop at the explicitly requested historical epoch.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 * @param expected - Optional requested stopping digest.
 */
export const beforeNominalPrimitiveSubtypeNpmPromotionSource = (path, source, expected) => {
	source = beforeNominalPrimitiveSubtypePythonRegistrationSource(path, source, expected);
	if(typeof source !== "string" || !nominalPrimitiveSubtypeNpmPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalPrimitiveSubtypeNpmPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalPrimitiveSubtypeNpmPromotionUpdate(source, update) : source;
};

/**
 * Restore only this milestone's exact current-source pins for earlier support checks.
 *
 * @param inventory - Earlier inventory recomputed with current source hashes.
 */
export const beforeNominalPrimitiveSubtypeNpmPromotionPins = inventory => {
	const previous = beforeNominalPrimitiveSubtypePythonPromotionPins(inventory);
	const record = history ??= JSON.parse(readFileSync(nominalPrimitiveSubtypeNpmPromotionHistoryPath, "utf8"));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256) file.sha256 = update.previousSha256;
	}
	return previous;
};
