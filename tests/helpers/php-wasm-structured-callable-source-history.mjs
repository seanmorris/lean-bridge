/**
 * Exact PHP-Wasm structured callback transitions preserve earlier receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeWitStructuredCallables } from "./wit-structured-callable-source-history.mjs";

export const phpWasmStructuredCallableHistoryPath = "docs/evidence/php-wasm-structured-callable-integration-20260925.json";
export const phpWasmStructuredCallableChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/lean/export-decisions.md"
	, "docs/php.md"
	, "docs/publish/php.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/php/copied-zend-conversions.mjs"
	, "src/backends/php/copied-zend-support.mjs"
	, "src/backends/php/copied-zend.mjs"
	, "src/backends/php/zend-callables.mjs"
	, "src/build/native-model.mjs"
	, "src/build/php-wasm-copied-component.mjs"
	, "src/release/php-wasm-copied-package.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/copied-fixture-php-wasm.mjs"
	, "tests/helpers/php-structured-callable-evidence.mjs"
	, "tests/helpers/php-structured-callable-source-history.mjs"
	, "tests/helpers/php-wasm-legacy-comparison.mjs"
	, "tests/helpers/php-wasm-shared-regression-receipt.mjs"
	, "tests/php-list-contract.test.mjs"
	, "tests/php-structured-callable-contract.test.mjs"
	, "tests/php-structured-callable-evidence.test.mjs"
	, "tests/php-variant-contract.test.mjs"
	, "tests/php-wasm-callable-contract.test.mjs"
	, "tests/php-wasm-callable-evidence.test.mjs"
	, "tests/php-wasm-compound-contract.test.mjs"
	, "tests/php-wasm-compound-evidence.test.mjs"
	, "tests/php-wasm-list-contract.test.mjs"
	, "tests/php-wasm-ordinary.test.mjs"
	, "tests/type-surface-docs.test.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Restore only authenticated, nonoverlapping literal edits in their original order.
 *
 * @param source - Complete source at this milestone.
 * @param update - Original and current hashes and ordered source spans.
 */
export const reversePhpWasmStructuredCallableUpdate = (source, update) => {
	assert.ok(phpWasmStructuredCallableChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let end = 0;
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		end = edit.start + edit.current.length;
	}
	let previous = source;
	for(const edit of update.edits.toReversed())
		previous = previous.slice(0, edit.start) + edit.previous + previous.slice(edit.start + edit.current.length);
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Normalize only this measured transition; leave all unrelated drift visible.
 *
 * @param path - Repository-relative file.
 * @param source - Current or historical contents.
 * @param expected - Optional intermediate digest at which to stop.
 */
export const beforePhpWasmStructuredCallables = (path, source, expected) => {
	source = beforeWitStructuredCallables(path, source, expected);
	const digest = sha256(source);
	if(digest === expected || !phpWasmStructuredCallableChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(phpWasmStructuredCallableHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reversePhpWasmStructuredCallableUpdate(source, update) : source;
};
