/**
 * Authenticate the late integration of the primitive-subtype audit branch as
 * one exact, reversible transition on the current checked-record lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const primitiveAuditIntegrationHistoryPath
	= "docs/evidence/primitive-audit-integration-source-history-20261018.json";
export const primitiveAuditIntegrationPredecessor
	= "f9ae4e507ca1036d73b4696d6c740dfc54bb5a80";
export const primitiveAuditIntegrationDraftParent
	= "f9ae4e507ca1036d73b4696d6c740dfc54bb5a80";
export const primitiveAuditIntegrationChangedPaths = Object.freeze([
	"docs/javascript-typescript.md"
	, "docs/php.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/source-history-test-source.mjs"
	, "tests/helpers/nested-checked-record-archive-gap-history-tests.mjs"
	, "tests/helpers/nested-checked-record-dotnet-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-jvm-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-perl-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-php-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-python-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-ruby-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-rust-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-wit-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-audit-correction-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-dotnet-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-jvm-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-registration-gap-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-rust-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-tests.mjs"
	, "tests/nested-checked-records.test.mjs"
]);
export const primitiveAuditIntegrationAddedPaths = Object.freeze([
	"scripts/update-primitive-audit-integration-source-history.mjs"
	, "tests/helpers/primitive-audit-integration-source-history.mjs"
	, "tests/helpers/primitive-audit-integration-source-history-tests.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	primitiveAuditIntegrationHistoryPath, "utf8"
));

/**
 * Reverse one exact integration transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reversePrimitiveAuditIntegrationUpdate = (source, update) => {
	assert.ok(primitiveAuditIntegrationChangedPaths.includes(update.path));
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
 * Remove only the current-line integration layer from exact source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePrimitiveAuditIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !primitiveAuditIntegrationChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reversePrimitiveAuditIntegrationUpdate(source, update)
		: source;
};
