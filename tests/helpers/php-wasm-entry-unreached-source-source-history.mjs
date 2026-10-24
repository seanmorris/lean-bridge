/**
 * Reverse the PHP-Wasm entry unreached-source classification.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmEntryUnreachedSourceHistoryPath
	= "docs/evidence/php-wasm-entry-unreached-source-source-history-20261024.json";
export const phpWasmEntryUnreachedSourcePredecessor
	= "1ba0883951de08d2ce06644d083f33765ef2b7b8";
export const phpWasmEntryUnreachedSourceImplementation
	= "47a0fd204242fff0cc115c5018330ba3b19457f9";
export const phpWasmEntryUnreachedSourceChangedPaths = Object.freeze([
	"tests/helpers/php-wasm-entry-call-targets.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-plan-tests.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-plan.mjs"
	, "tests/helpers/php-wasm-refinement-entry-plan-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-plan.mjs"
	, "tests/helpers/php-wasm-refinement-entry-report.mjs"
]);
export const phpWasmEntryUnreachedSourceIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const phpWasmEntryUnreachedSourceNormalizationPaths = Object.freeze([
	...phpWasmEntryUnreachedSourceChangedPaths
	, ...phpWasmEntryUnreachedSourceIntegrationPaths
]);
export const phpWasmEntryUnreachedSourceAddedPaths = Object.freeze([
	"scripts/update-php-wasm-entry-unreached-source-source-history.mjs"
	, "tests/helpers/php-wasm-entry-unreached-source-source-history-tests.mjs"
	, "tests/helpers/php-wasm-entry-unreached-source-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmEntryUnreachedSourceHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Exact recorded transition.
 */
export const reversePhpWasmEntryUnreachedSourceUpdate = (
	source, update
) => {
	assert.ok(phpWasmEntryUnreachedSourceNormalizationPaths
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
 * Remove only the exact PHP-Wasm entry unreached-source classification.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional digest at which normalization stops.
 */
export const beforePhpWasmEntryUnreachedSourceSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmEntryUnreachedSourceNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reversePhpWasmEntryUnreachedSourceUpdate(source, update);
};
