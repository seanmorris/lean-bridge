/**
 * Preserve the exact source predecessors of the nested checked-record native corrections.
 *
 * The implementation corrections were committed before the WIT and JVM promotion stack was
 * integrated. The support inventory transition is therefore based on the later integration
 * parent while the corrected native files retain their earlier source predecessor.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeNominalPrimitiveSubtypeJvmPromotionSource
} from "./nominal-primitive-subtype-jvm-promotion-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const nestedCheckedRecordNativeCorrectionHistoryPath
	= "docs/evidence/nested-checked-record-native-correction-source-history-20261016.json";
export const nestedCheckedRecordNativeCorrectionSourcePredecessor
	= "cc6ad552ce149d398132b775dabad9d541c9c9d8";
export const nestedCheckedRecordNativeCorrectionDraftParent
	= "69608986a65660b0a0df4c5587ab573fd078801a";
export const nestedCheckedRecordNativeCorrectionNativePaths = [
	"src/backends/c/native-copied-values.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/native-model.mjs"
	, "tests/fixtures/nested-checked-record-consumers/cpp.cpp"
	, "tests/helpers/nested-checked-record-native-fixture-tests.mjs"
	, "tests/helpers/nested-checked-record-native-fixture.mjs"
	, "tests/nested-checked-record-foundation.test.mjs"
];
export const nestedCheckedRecordNativeCorrectionChangedPaths = [
	"docs/type-surface.v1.json"
	, ...nestedCheckedRecordNativeCorrectionNativePaths
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nested-checked-record-browser-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-jvm-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-wasm-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-wasm-promotion-tests.mjs"
	, "tests/nested-checked-records.test.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse one complete transition only when its path, digest and every edit match.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseNestedCheckedRecordNativeCorrectionUpdate = (source, update) => {
	assert.ok(nestedCheckedRecordNativeCorrectionChangedPaths.includes(update.path));
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
export const withoutNestedCheckedRecordNativeCorrection = (path, source) => {
	if(typeof source !== "string"
		|| !nestedCheckedRecordNativeCorrectionChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		nestedCheckedRecordNativeCorrectionHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseNestedCheckedRecordNativeCorrectionUpdate(source, update) : source;
};

/**
 * Reverse this correction, then continue through every older authenticated layer.
 * Unknown edits are preserved unchanged.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNestedCheckedRecordNativeCorrectionSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !nestedCheckedRecordNativeCorrectionChangedPaths.includes(path))
		return beforeNominalPrimitiveSubtypeJvmPromotionSource(path, source, expected);
	let digest = sha256(source);
	if(digest === expected) return source;
	const previous = withoutNestedCheckedRecordNativeCorrection(path, source);
	if(previous !== source)
	{
		source = previous;
		digest = sha256(source);
		if(digest === expected) return source;
	}
	return beforeNominalPrimitiveSubtypeJvmPromotionSource(path, source, expected);
};

/**
 * Restore only this milestone's exact current-source pins.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeNestedCheckedRecordNativeCorrectionPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(
		nestedCheckedRecordNativeCorrectionHistoryPath, "utf8"
	));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256)
			file.sha256 = update.previousSha256;
	}
	return previous;
};
