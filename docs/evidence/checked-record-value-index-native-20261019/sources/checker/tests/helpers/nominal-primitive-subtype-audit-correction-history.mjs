/**
 * Preserve the exact source predecessors of the #1499 primitive-base audit corrections:
 * the native PHP CI archive-path checker fix, the stale remaining-hosts wording and the
 * supplemental strict-constructor and variant-refusal caller registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeNestedCheckedRecordDotnetPromotionPins
	, beforeNestedCheckedRecordDotnetPromotionSource
} from "./nested-checked-record-dotnet-promotion-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalPrimitiveSubtypeAuditCorrectionHistoryPath
	= "docs/evidence/nominal-primitive-subtype-audit-correction-source-history-20261016.json";
export const nominalPrimitiveSubtypeAuditCorrectionPredecessor
	= "412013dff975cd04677363eb092d36b2c850b328";
export const nominalPrimitiveSubtypeAuditCorrectionDraftParent
	= "412013dff975cd04677363eb092d36b2c850b328";
export const nominalPrimitiveSubtypeAuditCorrectionChangedPaths = [
	"docs/javascript-typescript.md"
	, "docs/php.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/check-nominal-primitive-subtype-php-ci.mjs"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nested-checked-record-browser-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-native-correction-source-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-browser-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-ci-policy-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-ci-report.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-tests.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse one complete transition only when its path, digest and every edit match.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseNominalPrimitiveSubtypeAuditCorrectionUpdate = (source, update) => {
	assert.ok(nominalPrimitiveSubtypeAuditCorrectionChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor
			&& edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this correction without traversing older history layers.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutNominalPrimitiveSubtypeAuditCorrection = (path, source) => {
	if(typeof source !== "string"
		|| !nominalPrimitiveSubtypeAuditCorrectionChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		nominalPrimitiveSubtypeAuditCorrectionHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseNominalPrimitiveSubtypeAuditCorrectionUpdate(source, update) : source;
};

/**
 * Reverse this correction, then continue through every older authenticated layer.
 * Unknown edits are preserved unchanged.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNominalPrimitiveSubtypeAuditCorrectionSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !nominalPrimitiveSubtypeAuditCorrectionChangedPaths.includes(path))
		return beforeNestedCheckedRecordDotnetPromotionSource(path, source, expected);
	let digest = sha256(source);
	if(digest === expected) return source;
	const previous = withoutNominalPrimitiveSubtypeAuditCorrection(path, source);
	if(previous !== source)
	{
		source = previous;
		digest = sha256(source);
		if(digest === expected) return source;
	}
	return beforeNestedCheckedRecordDotnetPromotionSource(path, source, expected);
};

/**
 * Restore only this milestone's exact current-source pins.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeNominalPrimitiveSubtypeAuditCorrectionPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(
		nominalPrimitiveSubtypeAuditCorrectionHistoryPath, "utf8"
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
 * Restore this correction's pins, then the nested checked-record .NET promotion's.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeNominalPrimitiveSubtypeAuditCorrectionAndDotnetPins = inventory =>
	beforeNestedCheckedRecordDotnetPromotionPins(beforeNominalPrimitiveSubtypeAuditCorrectionPins(inventory));
