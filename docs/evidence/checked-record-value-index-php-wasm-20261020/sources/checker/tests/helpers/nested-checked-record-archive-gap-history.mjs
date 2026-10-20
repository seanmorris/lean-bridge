/**
 * Record the nested native archive edit to tests/nested-checked-records.test.mjs that was
 * committed without a source-history ledger (d6fe6df), and read the older nested checked-record
 * and primitive JVM promotion tests through the newer nested native layers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeNominalPrimitiveSubtypeRegistrationRepairPins
	, beforeNominalPrimitiveSubtypeRegistrationRepairSource
} from "./nominal-primitive-subtype-registration-gap-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const nestedCheckedRecordArchiveGapHistoryPath
	= "docs/evidence/nested-checked-record-archive-gap-source-history-20261016.json";
export const nestedCheckedRecordArchiveGapPath = "tests/nested-checked-records.test.mjs";
export const nestedCheckedRecordArchiveGapPredecessor = "599d26a53004ef64b7a830e2bed3f25c317c2fe2";
export const nestedCheckedRecordArchiveGapDraftParent = "599d26a53004ef64b7a830e2bed3f25c317c2fe2";
// This repair's own source transitions, recorded like any other layer.
export const nestedCheckedRecordArchiveGapChangedPaths = [
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nested-checked-record-browser-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-native-correction-source-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-jvm-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-jvm-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-registration-gap-history-tests.mjs"
	, "tests/nested-checked-records.test.mjs"
	, "tests/type-surface.test.mjs"
];
// Each gap spans the exact recorded epochs on both sides: [from commit, to commit].
export const nestedCheckedRecordArchiveGaps = Object.freeze({
	archive: Object.freeze(["d6fe6df^", "d6fe6df"])
});
let history;

/**
 * Reverse one complete gap transition only when its digest and every edit match.
 *
 * @param source - Complete source text at the gap's later epoch.
 * @param update - Exact immutable transition.
 */
export const reverseNestedCheckedRecordArchiveGapUpdate = (source, update) => {
	assert.ok(update.path === nestedCheckedRecordArchiveGapPath
		|| nestedCheckedRecordArchiveGapChangedPaths.includes(update.path));
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
 * Reverse one named gap when the aggregator is exactly at its later epoch.
 * Other paths, other digests and unknown edits are returned unchanged.
 *
 * @param gap - Gap name from nestedCheckedRecordArchiveGaps.
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNestedCheckedRecordArchiveGapSource = (gap, path, source, expected) => {
	assert.ok(Object.hasOwn(nestedCheckedRecordArchiveGaps, gap));
	if(typeof source !== "string" || path !== nestedCheckedRecordArchiveGapPath) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nestedCheckedRecordArchiveGapHistoryPath, "utf8"));
	const update = record.gaps[gap];
	return update?.currentSha256 === digest ? reverseNestedCheckedRecordArchiveGapUpdate(source, update) : source;
};

/**
 * Remove only this repair's own source transitions without traversing older layers.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutNestedCheckedRecordArchiveRepair = (path, source) => {
	if(typeof source !== "string" || !nestedCheckedRecordArchiveGapChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(nestedCheckedRecordArchiveGapHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source) ? reverseNestedCheckedRecordArchiveGapUpdate(source, update) : source;
};

/**
 * Reverse this repair's own source transitions, then continue through older layers.
 * The historical gap is reversed separately at its exact position in the fin hub.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNestedCheckedRecordArchiveRepairSource = (path, source, expected) => {
	if(typeof source === "string" && nestedCheckedRecordArchiveGapChangedPaths.includes(path))
	{
		if(sha256(source) === expected) return source;
		const record = history ??= JSON.parse(readFileSync(nestedCheckedRecordArchiveGapHistoryPath, "utf8"));
		const update = record.updates.find(item => item.path === path);
		if(update?.currentSha256 === sha256(source))
		{
			source = reverseNestedCheckedRecordArchiveGapUpdate(source, update);
			if(sha256(source) === expected) return source;
		}
	}
	return beforeNominalPrimitiveSubtypeRegistrationRepairSource(path, source, expected);
};

/**
 * Restore only this repair's refreshed source pins.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeNestedCheckedRecordArchiveRepairPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(nestedCheckedRecordArchiveGapHistoryPath, "utf8"));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256) file.sha256 = update.previousSha256;
	}
	return previous;
};

/**
 * Restore this repair's pins, then the registration repair's.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeNestedCheckedRecordArchiveAndRegistrationPins = inventory =>
	beforeNominalPrimitiveSubtypeRegistrationRepairPins(beforeNestedCheckedRecordArchiveRepairPins(inventory));
