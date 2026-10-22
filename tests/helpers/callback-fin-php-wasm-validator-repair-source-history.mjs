/**
 * Reverse the authenticated PHP-Wasm callback Fin validator repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackFinPhpWasmValidatorRepairHistoryPath
	= "docs/evidence/callback-fin-php-wasm-validator-repair-source-history-20261022.json";
export const callbackFinPhpWasmValidatorRepairPredecessor
	= "b869fb3f1cbf320c3cb453058f4a7bdf095a49c1";
export const callbackFinPhpWasmValidatorRepairImplementation
	= "d054ca5a09c880c7161788fdc6859e27096b4961";
export const callbackFinPhpWasmValidatorRepairIntegrationBase
	= "d054ca5a09c880c7161788fdc6859e27096b4961";
export const callbackFinPhpWasmValidatorRepairChangedPaths = Object.freeze([
	"src/build/component-structured-callable-lean.mjs"
	, "tests/native-recursive-callable-model.test.mjs"
]);
export const callbackFinPhpWasmValidatorRepairIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackFinPhpWasmValidatorRepairHistoryPath, "utf8"));

/**
 * Restore one exact source transition after authenticating its endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackFinPhpWasmValidatorRepairUpdate = (source, update) => {
	assert.ok([...callbackFinPhpWasmValidatorRepairChangedPaths
		, ...callbackFinPhpWasmValidatorRepairIntegrationPaths].includes(update.path));
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
 * Remove only this exact PHP-Wasm callback Fin validator repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackFinPhpWasmValidatorRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...callbackFinPhpWasmValidatorRepairChangedPaths
			, ...callbackFinPhpWasmValidatorRepairIntegrationPaths].includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.updates, ...value.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCallbackFinPhpWasmValidatorRepairUpdate(source, update)
		: source;
};
