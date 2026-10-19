/**
 * Authenticate the exact primitive-base C# support and documentation transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeNominalPrimitiveSubtypeRustPromotionSource
	, beforePrimitiveSubtypeRustPromotionPins
} from "./nominal-primitive-subtype-rust-promotion-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalPrimitiveSubtypeDotnetPromotionHistoryPath = "docs/evidence/nominal-primitive-subtype-dotnet-promotion-source-history-20261015.json";
export const nominalPrimitiveSubtypeDotnetPromotionPredecessor = "18bcdff78d98a15d1b5fbacac7654b305a8d5f9c";
export const nominalPrimitiveSubtypeDotnetPromotionChangedPaths = [
	"docs/consume/dotnet.md"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/author-refinement-docs-source-history-tests.mjs"
	, "tests/helpers/checked-record-perl-author-docs-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/native-observation-split-history-tests.mjs"
	, "tests/helpers/node-consumer-budget-source-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-tests.mjs"
	, "tests/helpers/perl-xs-budget-source-history-tests.mjs"
	, "tests/helpers/ruby-gdb-ci-source-history-tests.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse only a complete transition with exact before and after digests.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated immutable transition.
 */
export const reverseNominalPrimitiveSubtypeDotnetPromotionUpdate = (source, update) => {
	assert.ok(nominalPrimitiveSubtypeDotnetPromotionChangedPaths.includes(update.path));
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
export const withoutNominalPrimitiveSubtypeDotnetPromotion = (path, source) => {
	if(typeof source !== "string"
		|| !nominalPrimitiveSubtypeDotnetPromotionChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		nominalPrimitiveSubtypeDotnetPromotionHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseNominalPrimitiveSubtypeDotnetPromotionUpdate(source, update) : source;
};

/**
 * Preserve unknown edits and stop at the explicitly requested historical epoch.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 * @param expected - Optional requested stopping digest.
 */
export const beforeNominalPrimitiveSubtypeDotnetPromotionSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !nominalPrimitiveSubtypeDotnetPromotionChangedPaths.includes(path))
		return beforeNominalPrimitiveSubtypeRustPromotionSource(path, source, expected);
	const digest = sha256(source); if(digest === expected) return source;
	const previous = withoutNominalPrimitiveSubtypeDotnetPromotion(path, source);
	if(previous !== source) return previous;
	return beforeNominalPrimitiveSubtypeRustPromotionSource(path, source, expected);
};

/**
 * Restore only this milestone's exact current-source pins.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeNominalPrimitiveSubtypeDotnetPromotionPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(
		nominalPrimitiveSubtypeDotnetPromotionHistoryPath, "utf8"
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
 * Reverse source pins above the preceding primitive-base Rust milestone.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforePrimitiveSubtypeDotnetPromotionPins = inventory =>
	beforePrimitiveSubtypeRustPromotionPins(
		beforeNominalPrimitiveSubtypeDotnetPromotionPins(inventory)
	);
