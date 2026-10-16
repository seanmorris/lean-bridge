/**
 * Authenticate the exact recursive checked-Subtype PHP-Wasm transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeNominalPrimitiveSubtypePhpWasmPromotionSource } from "./nominal-primitive-subtype-php-wasm-promotion-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const recursiveSubtypePhpWasmHistoryPath = "docs/evidence/recursive-subtype-php-wasm-source-history-20261015.json";
export const recursiveSubtypePhpWasmPredecessor = "88cf60117f2ea3bcef0213755c69a2e5d025f425";
export const recursiveSubtypePhpWasmDraftParent = "88cf60117f2ea3bcef0213755c69a2e5d025f425";
export const recursiveSubtypePhpWasmChangedPaths = Object.freeze([
	"docs/lean/diagnostics.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/php.md"
	, "scripts/generate-type-docs.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/analyze/copied-metadata-graph.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/native-types.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/backends/c/native-graph-adapters.mjs"
	, "src/backends/php/copied-graph-zend.mjs"
	, "src/build/component-fin-guards.mjs"
	, "src/build/component-recursive-lean.mjs"
	, "src/build/component-refinement-mirrors.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/native-graph-model.mjs"
	, "src/build/php-wasm-graph-component.mjs"
	, "src/build/php-wasm-graph-model.mjs"
	, "src/build/refinement-mirrors.mjs"
	, "src/release/php-wasm-copied-package.mjs"
	, "tests/component-refinement-mirrors.test.mjs"
	, "tests/fixtures/component-refinement-mirrors/ComponentMirrors.lean"
	, "tests/helpers/component-nominal-subtype-source.mjs"
	, "tests/helpers/component-refinement-mirrors-fixture.mjs"
	, "tests/helpers/component-refinement-mirrors-source-tests.mjs"
	, "tests/helpers/fin-nominal-refusals-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-selection-extractor-tests.mjs"
	, "tests/helpers/php-wasm-fin-fixtures.mjs"
	, "tests/helpers/pre-owned-php-wasm-generators.mjs"
	, "tests/helpers/subtype-result-source-tests.mjs"
	, "tests/php-wasm-fin.test.mjs"
]);
let history;

/**
 * Reverse one authenticated complete-source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseRecursiveSubtypePhpWasmUpdate = (source, update) => {
	assert.ok(recursiveSubtypePhpWasmChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor)); const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this transition when its complete current identity matches.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutRecursiveSubtypePhpWasm = (path, source) => {
	if(typeof source !== "string" || !recursiveSubtypePhpWasmChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(recursiveSubtypePhpWasmHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseRecursiveSubtypePhpWasmUpdate(source, update) : source;
};

/**
 * Preserve unknown edits and stop at an explicitly requested digest.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeRecursiveSubtypePhpWasmSource = (path, source, expected) => {
	source = beforeNominalPrimitiveSubtypePhpWasmPromotionSource(path, source, expected);
	if(typeof source !== "string" || !recursiveSubtypePhpWasmChangedPaths.includes(path)
		|| sha256(source) === expected) return source;
	return withoutRecursiveSubtypePhpWasm(path, source);
};
