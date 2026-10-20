/**
 * Authenticate public component Subtype admission while preserving earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeWitHistoryCheckoutSource } from "./wit-history-checkout-history.mjs";

export const componentNominalSubtypeHistoryPath = "docs/evidence/component-nominal-subtype-source-history-20261011.json";
export const componentNominalSubtypePredecessor = "aca7821c8b7b9f52363fbd00ee8b6400baea52dd";
export const componentNominalSubtypeChangedPaths = [
	"docs/lean/diagnostics.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/type-surface.v1.json"
	, "schema/compiler-adapter-plan.schema.json"
	, "schema/elaborated-export-metadata.schema.json"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/backends/javascript/generate.mjs"
	, "src/build/compiler-adapters.mjs"
	, "src/build/component-callable-adapters.mjs"
	, "tests/component-refinement-mirrors.test.mjs"
	, "tests/elaborated-metadata.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/native-history-checkout-history-tests.mjs"
	, "tests/helpers/native-history-checkout-history.mjs"
	, "tests/helpers/nominal-subtype-author-tests.mjs"
	, "tests/helpers/nominal-subtype-native-tests.mjs"
	, "tests/helpers/nominal-subtype-selection-extractor-tests.mjs"
	, "tests/helpers/subtype-result-source-tests.mjs"
];
let history;

/**
 * Restore only a complete recorded transition with matching before/after digests.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reverseComponentNominalSubtypeUpdate = (source, update) => {
	assert.ok(componentNominalSubtypeChangedPaths.includes(update.path));
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
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Preserve unknown edits and exact requested stopping points.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeComponentNominalSubtypeSource = (path, source, expected) => {
	source = beforeWitHistoryCheckoutSource(path, source, expected);
	if(typeof source !== "string" || !componentNominalSubtypeChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(componentNominalSubtypeHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseComponentNominalSubtypeUpdate(source, update) : source;
};
