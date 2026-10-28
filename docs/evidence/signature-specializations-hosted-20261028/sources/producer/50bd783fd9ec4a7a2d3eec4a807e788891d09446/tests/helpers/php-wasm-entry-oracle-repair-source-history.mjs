/**
 * Reverse the exact post-closure PHP-Wasm entry-oracle repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmEntryOracleRepairHistoryPath
	= "docs/evidence/php-wasm-entry-oracle-repair-source-history-20261024.json";
export const phpWasmEntryOracleRepairPredecessor
	= "b9f15c4a4244c792988a27cd9894757c17044f49";
export const phpWasmEntryOracleRepairImplementation
	= "b368527a0d2175d1acf3fc5d0d8eaac12912000d";
export const phpWasmEntryOracleRepairImplementationCommits
	= Object.freeze([
		"031012f47c777c3d1d5c1490119a958d1a2f1329"
		, "fcfe6efc859e5d02bda1a5841bad376cf8ce9d1e"
		, "19464eba8846e19d4d672a96d5e87c59190daf7e"
		, "167faa0b358b950590e7fcb1b15dea5b0d30160f"
		, "b368527a0d2175d1acf3fc5d0d8eaac12912000d"
	]);
export const phpWasmEntryOracleRepairModifiedPaths
	= Object.freeze([
		"tests/fixtures/php-wasm-refinement-entry/nominal-full.php"
		, "tests/fixtures/php-wasm-refinement-entry/nominal-result-only.php"
		, "tests/helpers/php-wasm-refinement-entry-callers-tests.mjs"
		, "tests/helpers/php-wasm-refinement-entry-plan-tests.mjs"
		, "tests/helpers/php-wasm-refinement-entry-plan.mjs"
	]);
export const phpWasmEntryOracleRepairIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const phpWasmEntryOracleRepairNormalizationPaths
	= Object.freeze([
		...phpWasmEntryOracleRepairModifiedPaths
		, ...phpWasmEntryOracleRepairIntegrationPaths
	]);
export const phpWasmEntryOracleRepairAddedPaths
	= Object.freeze([
		"scripts/update-php-wasm-entry-oracle-repair-source-history.mjs"
		, "tests/helpers/php-wasm-entry-oracle-repair-source-history-tests.mjs"
		, "tests/helpers/php-wasm-entry-oracle-repair-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmEntryOracleRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmEntryOracleRepairUpdate = (
	source, update
) => {
	assert.ok(phpWasmEntryOracleRepairNormalizationPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
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
 * Remove only the exact PHP-Wasm entry-oracle repair range.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePhpWasmEntryOracleRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmEntryOracleRepairNormalizationPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update ? reversePhpWasmEntryOracleRepairUpdate(source, update) : source;
};
