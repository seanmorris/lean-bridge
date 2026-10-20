/**
 * Record two historical primitive-base aggregator registrations that were committed
 * without a source-history ledger: the .NET evidence gate and archive (b79328f, 18bcdff)
 * and the native PHP harness, archive and CI (f6c632d, 0da829c, b24dcd2). Each added only
 * test imports. Without these transitions the fin hub stops at the later promotion
 * predecessors and cannot reach older aggregator epochs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeNominalPrimitiveSubtypeAuditCorrectionPins
	, beforeNominalPrimitiveSubtypeAuditCorrectionSource
} from "./nominal-primitive-subtype-audit-correction-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalPrimitiveSubtypeRegistrationGapHistoryPath
	= "docs/evidence/nominal-primitive-subtype-registration-gap-source-history-20261016.json";
export const nominalPrimitiveSubtypeRegistrationGapPath = "tests/helpers/nominal-primitive-subtype-tests.mjs";
export const nominalPrimitiveSubtypeRegistrationGapPredecessor = "94a68ffd201c8565d41139cf99c54d0c71004068";
export const nominalPrimitiveSubtypeRegistrationGapDraftParent = "94a68ffd201c8565d41139cf99c54d0c71004068";
// This repair's own source transitions, recorded like any other layer.
// No receipt pins these files, so the inventory itself is unchanged.
export const nominalPrimitiveSubtypeRegistrationGapChangedPaths = [
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-primitive-subtype-browser-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-tests.mjs"
];
// Each gap spans the exact recorded epochs on both sides: [from commit, to commit].
export const nominalPrimitiveSubtypeRegistrationGaps = Object.freeze({
	dotnet: Object.freeze(["4e0aabf", "18bcdff"])
	, php: Object.freeze(["ecb7e22", "b24dcd2"])
});
let history;

/**
 * Reverse one complete gap transition only when its digest and every edit match.
 *
 * @param source - Complete source text at the gap's later epoch.
 * @param update - Exact immutable transition.
 */
export const reverseNominalPrimitiveSubtypeRegistrationGapUpdate = (source, update) => {
	assert.ok(update.path === nominalPrimitiveSubtypeRegistrationGapPath
		|| nominalPrimitiveSubtypeRegistrationGapChangedPaths.includes(update.path));
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
 * @param gap - Gap name from nominalPrimitiveSubtypeRegistrationGaps.
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNominalPrimitiveSubtypeRegistrationGapSource = (gap, path, source, expected) => {
	assert.ok(Object.hasOwn(nominalPrimitiveSubtypeRegistrationGaps, gap));
	if(typeof source !== "string" || path !== nominalPrimitiveSubtypeRegistrationGapPath) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalPrimitiveSubtypeRegistrationGapHistoryPath, "utf8"));
	const update = record.gaps[gap];
	return update?.currentSha256 === digest ? reverseNominalPrimitiveSubtypeRegistrationGapUpdate(source, update) : source;
};

/**
 * Reverse this repair's own source transitions, then continue through older layers.
 * The historical gaps are reversed separately at their exact positions in the fin hub.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNominalPrimitiveSubtypeRegistrationRepairSource = (path, source, expected) => {
	if(typeof source === "string" && nominalPrimitiveSubtypeRegistrationGapChangedPaths.includes(path))
	{
		if(sha256(source) === expected) return source;
		const record = history ??= JSON.parse(readFileSync(nominalPrimitiveSubtypeRegistrationGapHistoryPath, "utf8"));
		const update = record.updates.find(item => item.path === path);
		if(update?.currentSha256 === sha256(source))
		{
			source = reverseNominalPrimitiveSubtypeRegistrationGapUpdate(source, update);
			if(sha256(source) === expected) return source;
		}
	}
	return beforeNominalPrimitiveSubtypeAuditCorrectionSource(path, source, expected);
};

/**
 * Restore only this repair's refreshed source pins.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeNominalPrimitiveSubtypeRegistrationRepairPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(nominalPrimitiveSubtypeRegistrationGapHistoryPath, "utf8"));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256) file.sha256 = update.previousSha256;
	}
	return previous;
};

/**
 * Restore this repair's pins, then the audit correction's.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeNominalPrimitiveSubtypeRepairAndAuditPins = inventory =>
	beforeNominalPrimitiveSubtypeAuditCorrectionPins(beforeNominalPrimitiveSubtypeRegistrationRepairPins(inventory));
