/**
 * Authenticate the focused Core repairs found by the primitive-subtype audit,
 * including the previously unrecorded supplement test-profile transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const primitiveAuditCoreRepairHistoryPath
	= "docs/evidence/primitive-audit-core-repair-source-history-20261018.json";
export const primitiveAuditCoreRepairPredecessor
	= "3546146128dd507f65b058504a25a7031f2a490a";
export const primitiveAuditCoreRepairDraftParent
	= "3546146128dd507f65b058504a25a7031f2a490a";
export const primitiveAuditCoreRepairProfilePredecessor
	= "6321287658f2d06d08638bc3c52713fd3ad8c795";
export const primitiveAuditCoreRepairExpectedPinCount = 118;
export const primitiveAuditCoreRepairChangedPaths = Object.freeze([
	".gitattributes"
	, "docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nested-checked-record-browser-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-jvm-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-native-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-php-tests.mjs"
	, "tests/helpers/nominal-subtype-python-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-rust-promotion-tests.mjs"
	, "tests/helpers/source-history-test-source.mjs"
	, "tests/nested-checked-records.test.mjs"
]);
export const primitiveAuditCoreRepairHistoricalPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
]);
export const primitiveAuditCoreRepairAddedPaths = Object.freeze([
	"docs/evidence/nominal-primitive-subtype-supplement-20261018/.gitattributes"
	, "scripts/update-primitive-audit-core-repair-source-history.mjs"
	, "tests/helpers/primitive-audit-core-repair-source-history.mjs"
	, "tests/helpers/primitive-audit-core-repair-source-history-tests.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	primitiveAuditCoreRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact Core-repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reversePrimitiveAuditCoreRepairUpdate = (source, update) => {
	assert.ok(primitiveAuditCoreRepairChangedPaths.includes(update.path));
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
				replacement.current, replacement.previous
			);
		}
		assert.equal(sha256(source), update.previousSha256, update.path);
		return source;
	}
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
 * Remove only the focused Core-repair layer from exact source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePrimitiveAuditCoreRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !primitiveAuditCoreRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reversePrimitiveAuditCoreRepairUpdate(source, update)
		: source;
};
