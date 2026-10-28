/**
 * Reverse the authenticated PHP-Wasm owned checked-record layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedRecordPhpWasmHistoryPath
	= "docs/evidence/owned-checked-record-php-wasm-source-history-20261022.json";
export const ownedCheckedRecordPhpWasmEvidencePath
	= "docs/evidence/owned-checked-record-php-wasm-local-qualification-20261022.json";
export const ownedCheckedRecordPhpWasmPredecessor
	= "b199dc152e553e8ade5291e54b5f96379dae4a29";
export const ownedCheckedRecordPhpWasmImplementation
	= "d19542e89ab9b26db57ea3fdcd88ce135fecb30b";
export const ownedCheckedRecordPhpWasmImplementationPaths = Object.freeze([
	".github/workflows/owned-checked-record-php-wasm.yml"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/c/owned-callbacks.mjs"
	, "src/backends/javascript/owned-wasm-callbacks.mjs"
	, "src/backends/php/owned-zend-callbacks.mjs"
	, "src/build/owned-callback-carriers.mjs"
	, "tests/fixtures/structured-types/owned-checked-record-php-wasm.php"
	, "tests/fixtures/structured-types/owned-checked-record-result-only-php-wasm.php"
	, "tests/helpers/owned-php-wasm-packages.mjs"
	, "tests/owned-checked-record-foundation.test.mjs"
	, "tests/owned-checked-record-php-wasm-packaging.test.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const ownedCheckedRecordPhpWasmChangedPaths = Object.freeze([
	"docs/php.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "package.json"
	, "scripts/generate-reference-docs.mjs"
	, "scripts/generate-type-docs.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/c/owned-callbacks.mjs"
	, "src/backends/javascript/owned-wasm-callbacks.mjs"
	, "src/backends/php/owned-zend-callbacks.mjs"
	, "src/build/owned-callback-carriers.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/owned-php-wasm-packages.mjs"
	, "tests/owned-checked-record-foundation.test.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const ownedCheckedRecordPhpWasmAddedPaths = Object.freeze([
	".github/workflows/owned-checked-record-php-wasm.yml"
	, ownedCheckedRecordPhpWasmEvidencePath
	, "docs/evidence/owned-checked-record-php-wasm-local-qualification-20261022.md"
	, "scripts/update-owned-checked-record-php-wasm-inventory.mjs"
	, "scripts/update-owned-checked-record-php-wasm-source-history.mjs"
	, "tests/fixtures/structured-types/owned-checked-record-php-wasm.php"
	, "tests/fixtures/structured-types/owned-checked-record-result-only-php-wasm.php"
	, "tests/helpers/owned-checked-record-php-wasm-source-history-tests.mjs"
	, "tests/helpers/owned-checked-record-php-wasm-source-history.mjs"
	, "tests/helpers/owned-subtype-php-wasm-qualification-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-php-wasm-qualification-source-history.mjs"
	, "tests/owned-checked-record-php-wasm-packaging.test.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedRecordPhpWasmHistoryPath, "utf8"
));

/**
 * Restore one complete source after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact ordered transition.
 */
export const reverseOwnedCheckedRecordPhpWasmUpdate = (source, update) => {
	assert.ok(ownedCheckedRecordPhpWasmChangedPaths.includes(update.path));
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
 * Remove only the exact PHP-Wasm owned checked-record layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedCheckedRecordPhpWasmSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !ownedCheckedRecordPhpWasmChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest
	);
	return update
		? reverseOwnedCheckedRecordPhpWasmUpdate(source, update)
		: source;
};
