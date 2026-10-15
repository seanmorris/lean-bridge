/**
 * Authenticate the exact primitive-base Browser support and documentation transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNominalPrimitiveSubtypeNativePromotionPins } from "./nominal-primitive-subtype-native-promotion-history.mjs";
import { beforeNominalPrimitiveSubtypeNativeRegistrationSource } from "./nominal-primitive-subtype-native-registration-history.mjs";

export const nominalPrimitiveSubtypeBrowserPromotionHistoryPath = "docs/evidence/nominal-primitive-subtype-browser-promotion-source-history-20261014.json";
export const nominalPrimitiveSubtypeBrowserPromotionPredecessor = "310f653c2bbc14178809eae23c4ae0bfea70cba1";
export const nominalPrimitiveSubtypeBrowserPromotionChangedPaths = [
	"docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-primitive-subtype-browser-registration-history.mjs"
	, "tests/helpers/nominal-subtype-browser-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-npm-promotion-history.mjs"
	, "tests/helpers/nominal-primitive-subtype-python-promotion-history.mjs"
	, "tests/helpers/nominal-primitive-subtype-python-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-python-promotion-history-tests.mjs"
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
export const reverseNominalPrimitiveSubtypeBrowserPromotionUpdate = (source, update) => {
	assert.ok(nominalPrimitiveSubtypeBrowserPromotionChangedPaths.includes(update.path));
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
export const beforeNominalPrimitiveSubtypeBrowserPromotionSource = (path, source, expected) => {
	source = beforeNominalPrimitiveSubtypeNativeRegistrationSource(path, source, expected);
	if(typeof source !== "string" || !nominalPrimitiveSubtypeBrowserPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalPrimitiveSubtypeBrowserPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalPrimitiveSubtypeBrowserPromotionUpdate(source, update) : source;
};

/**
 * Restore only this milestone's exact current-source pins for earlier support checks.
 *
 * @param inventory - Earlier inventory recomputed with current source hashes.
 */
export const beforeNominalPrimitiveSubtypeBrowserPromotionPins = inventory => {
	const previous = beforeNominalPrimitiveSubtypeNativePromotionPins(inventory);
	const record = history ??= JSON.parse(readFileSync(nominalPrimitiveSubtypeBrowserPromotionHistoryPath, "utf8"));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256) file.sha256 = update.previousSha256;
	}
	return previous;
};
