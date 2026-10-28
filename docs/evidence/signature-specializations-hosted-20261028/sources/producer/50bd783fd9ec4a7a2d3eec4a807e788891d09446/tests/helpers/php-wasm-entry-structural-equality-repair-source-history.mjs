/**
 * Reverse the exact PHP-Wasm entry-trace structural equality repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmEntryStructuralEqualityRepairHistoryPath
	= "docs/evidence/php-wasm-entry-structural-equality-repair-source-history-20261023.json";
export const phpWasmEntryStructuralEqualityRepairPredecessor
	= "82d0a10ea7116a57827b995eb92216480f226d83";
export const phpWasmEntryStructuralEqualityRepairImplementation
	= "cd6a4f39ea6444117894d31d55fa53d71e2dafad";
export const phpWasmEntryStructuralEqualityRepairImplementationPaths
	= Object.freeze([
		"tests/fixtures/php-wasm-refinement-entry/driver.mjs"
		, "tests/helpers/php-wasm-refinement-entry-driver-tests.mjs"
	]);
export const phpWasmEntryStructuralEqualityRepairIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const phpWasmEntryStructuralEqualityRepairChangedPaths = Object.freeze([
	...phpWasmEntryStructuralEqualityRepairImplementationPaths
	, ...phpWasmEntryStructuralEqualityRepairIntegrationPaths
]);
export const phpWasmEntryStructuralEqualityRepairAddedPaths = Object.freeze([
	"scripts/update-php-wasm-entry-structural-equality-repair-source-history.mjs"
	, "tests/helpers/php-wasm-entry-structural-equality-repair-source-history-tests.mjs"
	, "tests/helpers/php-wasm-entry-structural-equality-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmEntryStructuralEqualityRepairHistoryPath, "utf8"));

/**
 * Restore one exact authenticated source transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded source transition.
 */
export const reversePhpWasmEntryStructuralEqualityRepairUpdate = (
	source, update
) => {
	assert.ok(phpWasmEntryStructuralEqualityRepairChangedPaths
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
 * Remove only the PHP-Wasm entry structural equality repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforePhpWasmEntryStructuralEqualityRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmEntryStructuralEqualityRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reversePhpWasmEntryStructuralEqualityRepairUpdate(source, update);
};
