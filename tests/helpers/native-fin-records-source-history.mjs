/**
 * Preserve exact source predecessors of the Native Fin records change (#1442).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforePhpWasmFinSource } from "./php-wasm-fin-source-history.mjs";

export const nativeFinRecordsHistoryPath = "docs/evidence/native-fin-records-source-history-20261007.json";
export const nativeFinRecordsChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/perl-consumer.yml"
	, "docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/native-types.mjs"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/dotnet/copied-values.mjs"
	, "src/backends/jvm/copied-values.mjs"
	, "src/backends/native/fin-refinements.mjs"
	, "src/backends/perl/generate.mjs"
	, "src/backends/php/copied-values.mjs"
	, "src/backends/python/copied-values.mjs"
	, "src/backends/python/refinements.mjs"
	, "src/backends/ruby/copied-values.mjs"
	, "src/backends/rust/copied-values.mjs"
	, "src/backends/wit/fin-refinements.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/native-model.mjs"
	, "tests/documentation.test.mjs"
	, "tests/generic-records.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/reviewed-fin-acceptance-source-history-tests.mjs"
	, "tests/helpers/reviewed-fin-acceptance-source-history.mjs"
	, "tests/native-fin-containers.test.mjs"
	, "tests/native-fin-product-arrays.test.mjs"
	, "tests/native-fin.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseNativeFinRecordsUpdate = (source, update) => {
	assert.ok(nativeFinRecordsChangedPaths.includes(update.path));
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
 * Restore the source before #1442, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNativeFinRecordsSource = (path, source, expected) => {
	source = beforePhpWasmFinSource(path, source, expected);
	if(typeof source !== "string" || !nativeFinRecordsChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nativeFinRecordsHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNativeFinRecordsUpdate(source, update) : source;
};
