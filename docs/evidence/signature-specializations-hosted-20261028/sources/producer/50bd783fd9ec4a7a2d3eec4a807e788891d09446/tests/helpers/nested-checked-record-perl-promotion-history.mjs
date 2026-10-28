/**
 * Authenticate the exact nested checked-record Perl promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeNestedCheckedRecordJvmPromotionPins
	, beforeNestedCheckedRecordJvmPromotionSource
} from "./nested-checked-record-jvm-promotion-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const nestedCheckedRecordPerlPromotionHistoryPath
	= "docs/evidence/nested-checked-record-perl-promotion-source-history-20261016.json";
export const nestedCheckedRecordPerlPromotionPredecessor
	= "3bb253425cd6bced5dd8fec93a3cf9d25e7f6327";
export const nestedCheckedRecordPerlPromotionDraftParent
	= nestedCheckedRecordPerlPromotionPredecessor;
/** The promotion commit: its generator and all 17 validators equal the bytes its inventory pins. */
export const nestedCheckedRecordPerlPromotionCommit
	= "36e2782eca1f2f24aa67d10abbb78173f5f63c66";
export const nestedCheckedRecordPerlGeneratorPredecessor
	= "9a169c38cb02b2a5395893eef5c6afc3b2493d47";
export const nestedCheckedRecordPerlPromotionChangedPaths = [
	"docs/consume/perl.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "src/backends/perl/generate.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/nested-checked-record-perl.test.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse one complete transition after checking its path, digests and edits.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseNestedCheckedRecordPerlPromotionUpdate = (source, update) => {
	assert.ok(nestedCheckedRecordPerlPromotionChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
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
 * Remove only this promotion when its complete current identity matches.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutNestedCheckedRecordPerlPromotion = (path, source) => {
	if(typeof source !== "string"
		|| !nestedCheckedRecordPerlPromotionChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		nestedCheckedRecordPerlPromotionHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseNestedCheckedRecordPerlPromotionUpdate(source, update) : source;
};

/**
 * Reverse this promotion, then continue through every older authenticated layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNestedCheckedRecordPerlPromotionSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !nestedCheckedRecordPerlPromotionChangedPaths.includes(path))
		return beforeNestedCheckedRecordJvmPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	const previous = withoutNestedCheckedRecordPerlPromotion(path, source);
	if(previous !== source) return previous;
	return beforeNestedCheckedRecordJvmPromotionSource(path, source, expected);
};

/**
 * Restore source pins through this promotion and every preceding milestone.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeNestedCheckedRecordPerlPromotionPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(
		nestedCheckedRecordPerlPromotionHistoryPath, "utf8"
	));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256)
			file.sha256 = update.previousSha256;
	}
	return beforeNestedCheckedRecordJvmPromotionPins(previous);
};
