/**
 * Reverse the complete hosted PHP-Wasm entry artifact verifier milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmRefinementEntryHostedHistoryPath
	= "docs/evidence/php-wasm-refinement-entry-hosted-source-history-20261022.json";
export const phpWasmRefinementEntryHostedPredecessor
	= "84482ac0034142e6905a17655e2a5e376c83e497";
export const phpWasmRefinementEntryHostedImplementation
	= "0e564bf4c378ab106e490d51685ebfdf7f765d7c";
export const phpWasmRefinementEntryHostedUpdatedPaths = Object.freeze([
	"tests/php-wasm-fin.test.mjs"
]);
export const phpWasmRefinementEntryHostedImplementationAdditions = Object.freeze([
	"scripts/summarize-php-wasm-refinement-entry-hosted.mjs"
	, "tests/helpers/php-wasm-refinement-entry-hosted-summary-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-hosted-summary.mjs"
]);
export const phpWasmRefinementEntryHostedImplementationPaths = Object.freeze([
	...phpWasmRefinementEntryHostedUpdatedPaths
	, ...phpWasmRefinementEntryHostedImplementationAdditions
]);
export const phpWasmRefinementEntryHostedIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
export const phpWasmRefinementEntryHostedChangedPaths = Object.freeze([
	...phpWasmRefinementEntryHostedUpdatedPaths
	, ...phpWasmRefinementEntryHostedIntegrationPaths
]);
export const phpWasmRefinementEntryHostedAddedPaths = Object.freeze([
	...phpWasmRefinementEntryHostedImplementationAdditions
	, "scripts/update-php-wasm-refinement-entry-hosted-source-history.mjs"
	, "tests/helpers/php-wasm-refinement-entry-hosted-source-history-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-hosted-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmRefinementEntryHostedHistoryPath, "utf8"));

/**
 * Restore one exact hosted entry-verifier source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmRefinementEntryHostedUpdate = (source, update) => {
	assert.ok(phpWasmRefinementEntryHostedChangedPaths.includes(update.path));
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
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the exact hosted PHP-Wasm entry artifact verifier milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePhpWasmRefinementEntryHostedSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmRefinementEntryHostedChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update
		? reversePhpWasmRefinementEntryHostedUpdate(source, update) : source;
};
