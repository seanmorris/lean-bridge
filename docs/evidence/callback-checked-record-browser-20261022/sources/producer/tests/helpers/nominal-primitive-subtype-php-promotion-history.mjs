/**
 * Authenticate the exact primitive-base native PHP support transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeNominalPrimitiveSubtypeDotnetPromotionSource
	, beforePrimitiveSubtypeDotnetPromotionPins
} from "./nominal-primitive-subtype-dotnet-promotion-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalPrimitiveSubtypePhpPromotionHistoryPath = "docs/evidence/nominal-primitive-subtype-php-promotion-source-history-20261015.json";
export const nominalPrimitiveSubtypePhpPromotionPredecessor = "b24dcd2606e959caebd7d152c2554b6d7a46e157";
export const nominalPrimitiveSubtypePhpPromotionChangedPaths = [
	"docs/php.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
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
export const reverseNominalPrimitiveSubtypePhpPromotionUpdate = (source, update) => {
	assert.ok(nominalPrimitiveSubtypePhpPromotionChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor
			&& edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor)); const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path); return previous;
};

/**
 * Remove this promotion only, without traversing older history layers.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutNominalPrimitiveSubtypePhpPromotion = (path, source) => {
	if(typeof source !== "string"
		|| !nominalPrimitiveSubtypePhpPromotionChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		nominalPrimitiveSubtypePhpPromotionHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseNominalPrimitiveSubtypePhpPromotionUpdate(source, update) : source;
};

/**
 * Preserve unknown edits and stop at the explicitly requested historical epoch.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 * @param expected - Optional requested stopping digest.
 */
export const beforeNominalPrimitiveSubtypePhpPromotionSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !nominalPrimitiveSubtypePhpPromotionChangedPaths.includes(path))
		return beforeNominalPrimitiveSubtypeDotnetPromotionSource(path, source, expected);
	const digest = sha256(source); if(digest === expected) return source;
	const previous = withoutNominalPrimitiveSubtypePhpPromotion(path, source);
	if(previous !== source) return previous;
	return beforeNominalPrimitiveSubtypeDotnetPromotionSource(path, source, expected);
};

/**
 * Restore only this milestone's exact current-source pins.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeNominalPrimitiveSubtypePhpPromotionPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(
		nominalPrimitiveSubtypePhpPromotionHistoryPath, "utf8"
	));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256)
			file.sha256 = update.previousSha256;
	}
	return previous;
};

/**
 * Reverse source pins above the preceding primitive-base C# milestone.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforePrimitiveSubtypePhpPromotionPins = inventory =>
	beforePrimitiveSubtypeDotnetPromotionPins(
		beforeNominalPrimitiveSubtypePhpPromotionPins(inventory)
	);
