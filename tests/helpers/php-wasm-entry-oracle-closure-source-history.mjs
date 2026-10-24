/**
 * Reverse the exact PHP-Wasm refinement entry-oracle closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmEntryOracleClosureHistoryPath
	= "docs/evidence/php-wasm-entry-oracle-closure-source-history-20261024.json";
export const phpWasmEntryOracleClosurePredecessor
	= "390ae18d3a2607bc73463767a33fea0cfb9350b0";
export const phpWasmEntryOracleClosureImplementation
	= "1ddd6d1cef103d6826f18720dc8c2fad26a09c74";
export const phpWasmEntryOracleClosureImplementationAddedPaths
	= Object.freeze([
		"tests/helpers/php-wasm-entry-call-targets.mjs"
	]);
export const phpWasmEntryOracleClosureModifiedPaths
	= Object.freeze([
		".github/workflows/php-wasm-callback-entry.yml"
		, ".github/workflows/php-wasm-indexed-refinement-entry.yml"
		, ".github/workflows/php-wasm-owned-refinement-entry.yml"
		, ".github/workflows/php-wasm-refinement-entry.yml"
		, "tests/fixtures/php-wasm-refinement-entry/driver.mjs"
		, "tests/helpers/php-wasm-entry-probe-deployment-tests.mjs"
		, "tests/helpers/php-wasm-owned-refinement-entry-installed-tests.mjs"
		, "tests/helpers/php-wasm-owned-refinement-entry-plan-tests.mjs"
		, "tests/helpers/php-wasm-owned-refinement-entry-plan.mjs"
		, "tests/helpers/php-wasm-refinement-entry-driver-tests.mjs"
		, "tests/helpers/php-wasm-refinement-entry-installed-tests.mjs"
		, "tests/helpers/php-wasm-refinement-entry-plan-tests.mjs"
		, "tests/helpers/php-wasm-refinement-entry-plan.mjs"
		, "tests/helpers/php-wasm-refinement-entry-report-tests.mjs"
		, "tests/helpers/php-wasm-refinement-entry-report.mjs"
		, "tests/helpers/type-corpus-php-wasm-install.mjs"
	]);
export const phpWasmEntryOracleClosureImplementationPaths
	= Object.freeze([
		...phpWasmEntryOracleClosureModifiedPaths
		, ...phpWasmEntryOracleClosureImplementationAddedPaths
	]);
export const phpWasmEntryOracleClosureIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const phpWasmEntryOracleClosureNormalizationPaths
	= Object.freeze([
		...phpWasmEntryOracleClosureModifiedPaths
		, ...phpWasmEntryOracleClosureIntegrationPaths
	]);
export const phpWasmEntryOracleClosureAddedPaths
	= Object.freeze([
		...phpWasmEntryOracleClosureImplementationAddedPaths
		, "scripts/update-php-wasm-entry-oracle-closure-source-history.mjs"
		, "tests/helpers/php-wasm-entry-oracle-closure-source-history-tests.mjs"
		, "tests/helpers/php-wasm-entry-oracle-closure-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmEntryOracleClosureHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmEntryOracleClosureUpdate = (
	source, update
) => {
	assert.ok(phpWasmEntryOracleClosureNormalizationPaths
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
 * Remove only the exact PHP-Wasm entry-oracle closure.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePhpWasmEntryOracleClosureSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmEntryOracleClosureNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reversePhpWasmEntryOracleClosureUpdate(source, update)
		: source;
};
