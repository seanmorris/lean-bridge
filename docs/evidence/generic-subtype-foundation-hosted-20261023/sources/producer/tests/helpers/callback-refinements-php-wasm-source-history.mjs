/**
 * Reverse the authenticated PHP-Wasm callback Fin and checked-record layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackRefinementsPhpWasmHistoryPath
	= "docs/evidence/callback-refinements-php-wasm-source-history-20261022.json";
export const callbackRefinementsPhpWasmPredecessor
	= "8733612169685df4e1265bbad5bb3a3318013fc2";
export const callbackRefinementsPhpWasmImplementation
	= "4ea703617b1f517cf6e6f713619daea187534cf8";
export const callbackRefinementsPhpWasmIntegrationPaths = Object.freeze([
	"tests/helpers/callback-subtype-php-wasm-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const callbackRefinementsPhpWasmChangedPaths = Object.freeze([
	"package.json"
	, "src/abi/component-structured-callables.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/backends/c/native-callable-graph-borrows.mjs"
	, "src/backends/c/native-callable-graph-calls.mjs"
	, "src/backends/php/callable-graph-zend-model.mjs"
	, "src/backends/php/callable-graph-zend.mjs"
	, "src/build/component-structured-callable-adapters.mjs"
	, "src/build/component-structured-callable-lean.mjs"
	, "src/build/native-callable-graph.mjs"
	, "src/build/native-graph-model.mjs"
	, "src/build/php-wasm-copied-component.mjs"
	, "src/build/php-wasm-graph-component.mjs"
	, "src/build/php-wasm-graph-model.mjs"
	, "src/release/php-wasm-copied-package.mjs"
	, "tests/php-wasm-recursive-callable-contract.test.mjs"
	, "tests/semantic-model.test.mjs"
	, ...callbackRefinementsPhpWasmIntegrationPaths
]);
export const callbackRefinementsPhpWasmImplementationPaths = Object.freeze([
	".github/workflows/callback-refinements-php-wasm.yml"
	, ...callbackRefinementsPhpWasmChangedPaths.filter(path =>
		!callbackRefinementsPhpWasmIntegrationPaths.includes(path))
	, "scripts/check-callback-refinements-php-wasm-reports.mjs"
	, "tests/callback-refinements-php-wasm.test.mjs"
	, "tests/fixtures/reviewed-callback-fin-consumers/php-wasm.php"
	, "tests/helpers/callback-checked-record-php-wasm-fixture.mjs"
	, "tests/helpers/callback-checked-record-php-wasm-tests.mjs"
	, "tests/helpers/callback-fin-php-wasm-fixture.mjs"
	, "tests/helpers/callback-fin-php-wasm-tests.mjs"
	, "tests/helpers/callback-refinements-php-wasm-ci-tests.mjs"
	, "tests/helpers/callback-refinements-php-wasm-installed-tests.mjs"
	, "tests/helpers/callback-refinements-php-wasm-report.mjs"
]);
export const callbackRefinementsPhpWasmAddedPaths = Object.freeze([
	".github/workflows/callback-refinements-php-wasm.yml"
	, "scripts/check-callback-refinements-php-wasm-reports.mjs"
	, "scripts/update-callback-refinements-php-wasm-source-history.mjs"
	, "tests/callback-refinements-php-wasm.test.mjs"
	, "tests/fixtures/reviewed-callback-fin-consumers/php-wasm.php"
	, "tests/helpers/callback-checked-record-php-wasm-fixture.mjs"
	, "tests/helpers/callback-checked-record-php-wasm-tests.mjs"
	, "tests/helpers/callback-fin-php-wasm-fixture.mjs"
	, "tests/helpers/callback-fin-php-wasm-tests.mjs"
	, "tests/helpers/callback-refinements-php-wasm-ci-tests.mjs"
	, "tests/helpers/callback-refinements-php-wasm-installed-tests.mjs"
	, "tests/helpers/callback-refinements-php-wasm-report.mjs"
	, "tests/helpers/callback-refinements-php-wasm-source-history-tests.mjs"
	, "tests/helpers/callback-refinements-php-wasm-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackRefinementsPhpWasmHistoryPath, "utf8"));

/**
 * Restore one exact source transition after authenticating its endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackRefinementsPhpWasmUpdate = (source, update) => {
	assert.ok(callbackRefinementsPhpWasmChangedPaths.includes(update.path));
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
 * Remove only this exact PHP-Wasm callback-refinement milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackRefinementsPhpWasmSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackRefinementsPhpWasmChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.updates, ...(value.historicalUpdates ?? [])].find(item => item.path === path
		&& item.currentSha256 === digest);
	return update
		? reverseCallbackRefinementsPhpWasmUpdate(source, update)
		: source;
};
