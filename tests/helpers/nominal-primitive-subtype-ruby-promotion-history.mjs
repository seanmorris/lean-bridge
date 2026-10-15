/**
 * Authenticate the exact primitive-base Ruby support and documentation transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforePrimitiveSubtypeIntegrationPins } from "./nominal-primitive-subtype-perl-promotion-history.mjs";
import { beforePrimitiveSubtypeHistoryRepairSource } from "./primitive-subtype-history-repair.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalPrimitiveSubtypeRubyPromotionHistoryPath = "docs/evidence/nominal-primitive-subtype-ruby-promotion-source-history-20261015.json";
export const nominalPrimitiveSubtypeRubyPromotionPredecessor = "5e49b267ba9ddcc7af965a2644767b07b2f1a187";
export const nominalPrimitiveSubtypeRubyPromotionChangedPaths = [
	"docs/consume/ruby.md"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/core-quality-budget-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-primitive-subtype-browser-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-browser-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-native-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-native-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-integration-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-ruby-integration-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-tests.mjs"
	, "tests/helpers/nominal-subtype-perl-promotion-tests.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse only a complete transition with exact before and after digests.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated immutable transition.
 */
export const reverseNominalPrimitiveSubtypeRubyPromotionUpdate = (source, update) => {
	assert.ok(nominalPrimitiveSubtypeRubyPromotionChangedPaths.includes(update.path));
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
export const beforeNominalPrimitiveSubtypeRubyPromotionSource = (path, source, expected) => {
	source = beforePrimitiveSubtypeHistoryRepairSource(path, source, expected);
	if(typeof source !== "string" || !nominalPrimitiveSubtypeRubyPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalPrimitiveSubtypeRubyPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalPrimitiveSubtypeRubyPromotionUpdate(source, update) : source;
};

/**
 * Restore only this milestone's exact current-source pins for earlier support checks.
 *
 * @param inventory - Earlier inventory recomputed with current source hashes.
 */
export const beforeNominalPrimitiveSubtypeRubyPromotionPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(nominalPrimitiveSubtypeRubyPromotionHistoryPath, "utf8"));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256) file.sha256 = update.previousSha256;
	}
	return previous;
};

/**
 * Reverse every source pin above the nineteen-base Native promotion, newest first.
 *
 * @param inventory - Earlier inventory recomputed with current source hashes.
 */
export const beforePrimitiveSubtypeRubyPromotionPins = inventory =>
	beforeNominalPrimitiveSubtypeRubyPromotionPins(beforePrimitiveSubtypeIntegrationPins(inventory));
