/**
 * Preserve exact source predecessors of the Generic record promotion change (#1439).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericRecordPromotionHistoryPath = "docs/evidence/generic-record-promotion-source-history-20261007.json";
export const genericRecordPromotionChangedPaths = [
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
	, "docs/lean/existing-package.md"
	, "docs/php.md"
	, "docs/type-surface.v1.json"
	, "tests/documentation.test.mjs"
	, "tests/generic-records.test.mjs"
	, "tests/helpers/fin-products-source-history-tests.mjs"
	, "tests/helpers/fin-products-source-history.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-specializations.test.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseGenericRecordPromotionUpdate = (source, update) => {
	assert.ok(genericRecordPromotionChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
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
 * Restore the source before #1439, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeGenericRecordPromotionSource = (path, source, expected) => {
	if(typeof source !== "string" || !genericRecordPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(genericRecordPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseGenericRecordPromotionUpdate(source, update) : source;
};
