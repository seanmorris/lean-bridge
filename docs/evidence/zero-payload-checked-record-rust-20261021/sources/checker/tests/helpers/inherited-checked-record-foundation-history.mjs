/**
 * Authenticate the inherited checked-record compiler foundation without
 * rewriting any earlier source-history ledger.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedCheckedRecordFoundationHistoryPath
	= "docs/evidence/inherited-checked-record-foundation-source-history-20261017.json";
export const inheritedCheckedRecordFoundationPredecessor
	= "224550a6662d41a5a3f191ce25756426ed9ecc78";
export const inheritedCheckedRecordFoundationChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "schema/elaborated-export-metadata.schema.json"
	, "schema/native-metadata-type.schema.json"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/native-types.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/build/native-model.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/inherited-records.test.mjs"
]);
export const inheritedCheckedRecordFoundationAddedPaths = Object.freeze([
	"scripts/update-inherited-checked-record-foundation-history.mjs"
	, "tests/fixtures/onboarding/inherited-checked-records/InheritedCheckedRecords.lean"
	, "tests/fixtures/onboarding/inherited-checked-records/LICENSE"
	, "tests/fixtures/onboarding/inherited-checked-records/lakefile.toml"
	, "tests/fixtures/onboarding/inherited-checked-records/lean-toolchain"
	, "tests/fixtures/onboarding/inherited-checked-records/package.json"
	, "tests/helpers/inherited-checked-record-fixture.mjs"
	, "tests/helpers/inherited-checked-record-foundation-history-tests.mjs"
	, "tests/helpers/inherited-checked-record-foundation-history.mjs"
	, "tests/inherited-checked-records.test.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	inheritedCheckedRecordFoundationHistoryPath, "utf8"
));

/**
 * Reverse one exact inherited checked-record foundation transition.
 *
 * @param source - Current complete source text.
 * @param update - Exact immutable transition for the same path.
 */
export const reverseInheritedCheckedRecordFoundationUpdate = (source, update) => {
	assert.ok(inheritedCheckedRecordFoundationChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	if(update.replacements !== undefined)
	{
		assert.ok(Array.isArray(update.replacements)
			&& update.replacements.length > 0);
		for(const replacement of [...update.replacements].reverse())
		{
			assert.equal(typeof replacement.previous, "string");
			assert.equal(typeof replacement.current, "string");
			assert.notEqual(replacement.previous, replacement.current);
			assert.ok(Number.isSafeInteger(replacement.count)
				&& replacement.count > 0);
			assert.equal(source.split(replacement.current).length - 1
				, replacement.count, update.path);
			source = source.replaceAll(
				replacement.current, replacement.previous);
		}
		assert.equal(sha256(source), update.previousSha256, update.path);
		return source;
	}
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this exact foundation layer from authenticated current bytes.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeInheritedCheckedRecordFoundationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !inheritedCheckedRecordFoundationChangedPaths.includes(path))
		return source;
	if(sha256(source) === expected) return source;
	const update = record().updates.find(item => item.path === path);
	if(update?.currentSha256 !== sha256(source)) return source;
	const previous = reverseInheritedCheckedRecordFoundationUpdate(source, update);
	return previous;
};

/**
 * Restore only source pins advanced by this exact foundation layer.
 *
 * @param inventory - Current support inventory.
 */
export const beforeInheritedCheckedRecordFoundationPins = inventory => {
	const previous = structuredClone(inventory);
	const evidence = record();
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = evidence.pinUpdates.find(item => item.path === file.path);
		if(update?.currentSha256 === file.sha256)
			file.sha256 = update.previousSha256;
	}
	return previous;
};
