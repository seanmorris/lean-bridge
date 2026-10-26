/**
 * Reverse the PHP-Wasm nullary entry-form classification.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmNullaryEntryFormHistoryPath
	= "docs/evidence/php-wasm-nullary-entry-form-source-history-20261024.json";
export const phpWasmNullaryEntryFormPredecessor
	= "b512997482f98e730e13dea03eb8df3c6436db34";
export const phpWasmNullaryEntryFormImplementation
	= "08a6e7b2df96afaeebe39957523042981a616fca";
export const phpWasmNullaryEntryFormChangedPaths = Object.freeze([
	"tests/helpers/php-wasm-owned-refinement-entry-build.mjs"
	, "tests/helpers/php-wasm-refinement-entry-build-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-build.mjs"
	, "tests/helpers/php-wasm-refinement-entry-source-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-source.mjs"
	, "tests/helpers/php-wasm-subtype-entry-c.mjs"
]);
export const phpWasmNullaryEntryFormIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const phpWasmNullaryEntryFormNormalizationPaths = Object.freeze([
	...phpWasmNullaryEntryFormChangedPaths
	, ...phpWasmNullaryEntryFormIntegrationPaths
]);
export const phpWasmNullaryEntryFormAddedPaths = Object.freeze([
	"scripts/update-php-wasm-nullary-entry-form-source-history.mjs"
	, "tests/helpers/php-wasm-nullary-entry-form-source-history-tests.mjs"
	, "tests/helpers/php-wasm-nullary-entry-form-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmNullaryEntryFormHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Exact recorded transition.
 */
export const reversePhpWasmNullaryEntryFormUpdate = (source, update) => {
	assert.ok(phpWasmNullaryEntryFormNormalizationPaths.includes(update.path));
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
 * Remove only the exact PHP-Wasm nullary entry-form classification.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional digest at which normalization stops.
 */
export const beforePhpWasmNullaryEntryFormSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmNullaryEntryFormNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reversePhpWasmNullaryEntryFormUpdate(source, update);
};
