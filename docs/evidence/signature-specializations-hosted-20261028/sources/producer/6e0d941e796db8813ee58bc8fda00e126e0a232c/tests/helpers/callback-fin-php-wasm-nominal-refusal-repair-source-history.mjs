/**
 * Reverse the PHP-Wasm nominal callback-refusal repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackFinPhpWasmNominalRefusalRepairHistoryPath
	= "docs/evidence/callback-fin-php-wasm-nominal-refusal-repair-source-history-20261022.json";
export const callbackFinPhpWasmNominalRefusalRepairPredecessor
	= "c3b62a586f24a2ad97efd304b6b4380be3da8e45";
export const callbackFinPhpWasmNominalRefusalRepairImplementation
	= "10f0fe2989e63ff3043e199a468122e572cef18c";
export const callbackFinPhpWasmNominalRefusalRepairIntegrationBase
	= "10f0fe2989e63ff3043e199a468122e572cef18c";
export const callbackFinPhpWasmNominalRefusalRepairChangedPaths = Object.freeze([
	"src/abi/component-structured-callables.mjs"
	, "src/backends/c/native-callable-graph-calls.mjs"
	, "tests/fixtures/reviewed-callback-fin-consumers/php-wasm.php"
	, "tests/helpers/callback-fin-php-wasm-fixture.mjs"
	, "tests/helpers/callback-fin-php-wasm-tests.mjs"
	, "tests/native-recursive-callable-model.test.mjs"
]);
export const callbackFinPhpWasmNominalRefusalRepairIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackFinPhpWasmNominalRefusalRepairHistoryPath, "utf8"));

/**
 * Restore one exact source transition after authenticating its endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackFinPhpWasmNominalRefusalRepairUpdate = (source, update) => {
	assert.ok([...callbackFinPhpWasmNominalRefusalRepairChangedPaths
		, ...callbackFinPhpWasmNominalRefusalRepairIntegrationPaths]
		.includes(update.path));
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
 * Remove only this exact nominal callback-refusal repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackFinPhpWasmNominalRefusalRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...callbackFinPhpWasmNominalRefusalRepairChangedPaths
			, ...callbackFinPhpWasmNominalRefusalRepairIntegrationPaths]
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.updates, ...value.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCallbackFinPhpWasmNominalRefusalRepairUpdate(source, update)
		: source;
};
