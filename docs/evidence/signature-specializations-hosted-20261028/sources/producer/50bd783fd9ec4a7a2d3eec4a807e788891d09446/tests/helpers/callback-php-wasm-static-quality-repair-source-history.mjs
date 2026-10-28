/**
 * Reverse the callback PHP-Wasm static-quality repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackPhpWasmStaticQualityRepairHistoryPath
	= "docs/evidence/callback-php-wasm-static-quality-repair-source-history-20261022.json";
export const callbackPhpWasmStaticQualityRepairPredecessor
	= "387f1c1897230beb09c05f7eda17faf70a64b415";
export const callbackPhpWasmStaticQualityRepairImplementation
	= "82249d63756ca7c90c373c45c88e11ebfadf4cb5";
export const callbackPhpWasmStaticQualityRepairChangedPaths
	= Object.freeze([
		"scripts/check-callback-subtype-php-wasm-reports.mjs"
		, "src/backends/php/callable-graph-zend-php.mjs"
		, "tests/helpers/callback-subtype-php-wasm-fixture.mjs"
		, "tests/helpers/callback-subtype-php-wasm-installed-tests.mjs"
		, "tests/helpers/callback-subtype-php-wasm-tests.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-summary.mjs"
	]);
export const callbackPhpWasmStaticQualityRepairIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const callbackPhpWasmStaticQualityRepairNormalizationPaths
	= Object.freeze([
		...callbackPhpWasmStaticQualityRepairChangedPaths
		, ...callbackPhpWasmStaticQualityRepairIntegrationPaths
	]);
export const callbackPhpWasmStaticQualityRepairAddedPaths
	= Object.freeze([
		"scripts/update-callback-php-wasm-static-quality-repair-source-history.mjs"
		, "tests/helpers/callback-php-wasm-static-quality-repair-source-history-tests.mjs"
		, "tests/helpers/callback-php-wasm-static-quality-repair-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackPhpWasmStaticQualityRepairHistoryPath, "utf8"));

/**
 * Reverse one exact callback PHP-Wasm static-quality transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackPhpWasmStaticQualityRepairUpdate = (
	source, update
) => {
	assert.ok(callbackPhpWasmStaticQualityRepairNormalizationPaths
		.includes(update.path));
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
 * Remove only the exact callback PHP-Wasm static-quality repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackPhpWasmStaticQualityRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackPhpWasmStaticQualityRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCallbackPhpWasmStaticQualityRepairUpdate(source, update)
		: source;
};
