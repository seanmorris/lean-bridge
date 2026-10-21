/**
 * Authenticate the aggregate inherited checked-record support and generated
 * documentation transition as one exact, reversible milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedCheckedRecordPromotionHistoryPath
	= "docs/evidence/inherited-checked-record-promotion-source-history-20261018.json";
export const inheritedCheckedRecordPromotionPredecessor
	= "df10ec2348928dadb2855874e3d737d30b511048";
export const inheritedCheckedRecordPromotionDraftParent
	= "df10ec2348928dadb2855874e3d737d30b511048";
export const inheritedCheckedRecordPromotionChangedPaths = Object.freeze([
	"docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/consume/dotnet.md"
	, "docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/consume/perl.md"
	, "docs/consume/python.md"
	, "docs/consume/ruby.md"
	, "docs/consume/rust.md"
	, "docs/consume/wit-wasi.md"
	, "docs/javascript-typescript.md"
	, "docs/php.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/inherited-checked-record-perl-controls-tests.mjs"
	, "tests/helpers/inherited-checked-record-promotion-tests.mjs"
	, "tests/helpers/inherited-checked-record-promotion.mjs"
	, "tests/nested-checked-records.test.mjs"
	, "tests/type-surface.test.mjs"
]);
export const inheritedCheckedRecordPromotionAddedPaths = Object.freeze([
	"docs/evidence/inherited-checked-record-promotion-20261018.md"
	, "scripts/promote-inherited-checked-record-evidence.mjs"
	, "scripts/refresh-inherited-checked-record-promotion-pins.mjs"
	, "scripts/update-inherited-checked-record-promotion-source-history.mjs"
	, "tests/helpers/inherited-checked-record-promotion-source-history.mjs"
	, "tests/helpers/inherited-checked-record-promotion-source-history-tests.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	inheritedCheckedRecordPromotionHistoryPath, "utf8"
));

/**
 * Reverse one complete promotion transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseInheritedCheckedRecordPromotionUpdate = (
	source, update
) => {
	assert.ok(inheritedCheckedRecordPromotionChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
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
 * Remove only the exact aggregate-promotion layer from current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeInheritedCheckedRecordPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !inheritedCheckedRecordPromotionChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseInheritedCheckedRecordPromotionUpdate(source, update)
		: source;
};
