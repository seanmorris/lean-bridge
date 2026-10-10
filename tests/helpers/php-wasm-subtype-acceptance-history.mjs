/**
 * Authenticate PHP-Wasm Subtype acceptance integration without changing earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmSubtypeAcceptanceHistoryPath = "docs/evidence/php-wasm-subtype-acceptance-source-history-20261010.json";
export const phpWasmSubtypeAcceptancePredecessor = "b7706ed7be1b24c0592fa4e3f7eccbd21ba7eb5d";
export const phpWasmSubtypeAcceptanceChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/php-wasm-direct-fin-promotion-tests.mjs"
	, "tests/helpers/php-wasm-fin-direct-ci-tests.mjs"
	, "tests/helpers/php-wasm-fin-direct-report.mjs"
	, "tests/helpers/php-wasm-fin-observation.mjs"
	, "tests/helpers/php-wasm-subtype-history-tests.mjs"
	, "tests/helpers/php-wasm-subtype-history.mjs"
	, "tests/php-wasm-fin.test.mjs"
];
let history;

/**
 * Reverse registered spans only after authenticating both complete sources.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmSubtypeAcceptanceUpdate = (source, update) => {
	assert.ok(phpWasmSubtypeAcceptanceChangedPaths.includes(update.path));
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
 * Restore only authenticated predecessors, preserving requested stopping digests.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforePhpWasmSubtypeAcceptanceSource = (path, source, expected) => {
	if(typeof source !== "string" || !phpWasmSubtypeAcceptanceChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(phpWasmSubtypeAcceptanceHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reversePhpWasmSubtypeAcceptanceUpdate(source, update) : source;
};
