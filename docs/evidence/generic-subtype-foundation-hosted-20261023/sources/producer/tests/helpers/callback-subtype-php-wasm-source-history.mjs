/**
 * Reverse the authenticated PHP-Wasm callback Subtype implementation and
 * qualification layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypePhpWasmHistoryPath
	= "docs/evidence/callback-subtype-php-wasm-source-history-20261022.json";
export const callbackSubtypePhpWasmEvidencePath
	= "docs/evidence/callback-subtype-php-wasm-local-qualification-20261022.json";
export const callbackSubtypePhpWasmPredecessor
	= "6e1284253d4ab66b3f5c07d01216a7c82ac0011a";
export const callbackSubtypePhpWasmImplementation
	= "6249ba2f4018ecfd4997067806688dff5acfb028";
export const callbackSubtypePhpWasmImplementationPaths = Object.freeze([
	".github/workflows/callback-subtype-php-wasm.yml"
	, "package.json"
	, "scripts/check-callback-subtype-php-wasm-reports.mjs"
	, "src/backends/c/native-callable-graph-calls.mjs"
	, "src/backends/php/callable-graph-zend-calls.mjs"
	, "src/backends/php/callable-graph-zend-model.mjs"
	, "src/backends/php/callable-graph-zend-php.mjs"
	, "src/backends/php/callable-graph-zend-runtime.mjs"
	, "src/backends/php/callable-graph-zend.mjs"
	, "src/build/php-wasm-graph-model.mjs"
	, "tests/callback-subtype-php-wasm.test.mjs"
	, "tests/fixtures/callback-subtype-consumers/php-wasm.php"
	, "tests/helpers/callback-subtype-php-wasm-fixture.mjs"
	, "tests/helpers/callback-subtype-php-wasm-installed-tests.mjs"
	, "tests/helpers/callback-subtype-php-wasm-report.mjs"
	, "tests/helpers/callback-subtype-php-wasm-tests.mjs"
	, "tests/native-recursive-callable-model.test.mjs"
	, "tests/php-wasm-recursive-callable-contract.test.mjs"
]);
export const callbackSubtypePhpWasmChangedPaths = Object.freeze([
	"docs/php.md"
	, "docs/publish/php.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "package.json"
	, "scripts/generate-type-docs.mjs"
	, "src/backends/c/native-callable-graph-calls.mjs"
	, "src/backends/php/callable-graph-zend-calls.mjs"
	, "src/backends/php/callable-graph-zend-model.mjs"
	, "src/backends/php/callable-graph-zend-php.mjs"
	, "src/backends/php/callable-graph-zend-runtime.mjs"
	, "src/backends/php/callable-graph-zend.mjs"
	, "src/build/php-wasm-graph-model.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-recursive-callable-model.test.mjs"
	, "tests/php-wasm-recursive-callable-contract.test.mjs"
]);
export const callbackSubtypePhpWasmAddedPaths = Object.freeze([
	".github/workflows/callback-subtype-php-wasm.yml"
	, callbackSubtypePhpWasmEvidencePath
	, "docs/evidence/callback-subtype-php-wasm-local-qualification-20261022.md"
	, "scripts/check-callback-subtype-php-wasm-reports.mjs"
	, "scripts/update-callback-subtype-php-wasm-inventory.mjs"
	, "scripts/update-callback-subtype-php-wasm-source-history.mjs"
	, "tests/callback-subtype-php-wasm.test.mjs"
	, "tests/fixtures/callback-subtype-consumers/php-wasm.php"
	, "tests/helpers/callback-subtype-php-wasm-fixture.mjs"
	, "tests/helpers/callback-subtype-php-wasm-installed-tests.mjs"
	, "tests/helpers/callback-subtype-php-wasm-report.mjs"
	, "tests/helpers/callback-subtype-php-wasm-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-php-wasm-source-history.mjs"
	, "tests/helpers/callback-subtype-php-wasm-tests.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypePhpWasmHistoryPath, "utf8"));

/**
 * Authenticate and reverse one exact recorded source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackSubtypePhpWasmUpdate = (source, update) => {
	assert.ok(callbackSubtypePhpWasmChangedPaths.includes(update.path));
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
 * Remove only the exact PHP-Wasm callback Subtype layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypePhpWasmSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackSubtypePhpWasmChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return update
		? reverseCallbackSubtypePhpWasmUpdate(source, update)
		: source;
};
