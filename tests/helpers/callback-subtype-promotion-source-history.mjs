/**
 * Reverse the final synchronous callback Subtype evidence promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypePromotionHistoryPath
	= "docs/evidence/callback-subtype-promotion-source-history-20261023.json";
export const callbackSubtypePromotionPredecessor
	= "5b9ca827d621b2bcf8e67c73f85b8d9c8a84b5f0";
export const callbackSubtypePromotionIntegrationPaths = Object.freeze([
	"docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/consume/dotnet.md"
	, "docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/consume/perl.md"
	, "docs/consume/python.md"
	, "docs/consume/ruby.md"
	, "docs/consume/rust.md"
	, "docs/consume/wit-wasi.md"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/php.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "tests/callback-subtype-promotion.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/php-wasm-fin.test.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypePromotionHistoryPath, "utf8"
));
const paths = new Set(callbackSubtypePromotionIntegrationPaths);

/**
 * Restore one authenticated promotion transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated reversible transition.
 */
export const reverseCallbackSubtypePromotionUpdate = (source, update) => {
	assert.ok(paths.has(update.path));
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
 * Restore the exact source at the callback Subtype promotion predecessor.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 * @param expected - Optional predecessor digest.
 */
export const beforeCallbackSubtypePromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || !paths.has(path)) return source;
	const update = record().integrationUpdates.find(item =>
		item.path === path && item.currentSha256 === sha256(source));
	if(update === undefined) return source;
	const previous = reverseCallbackSubtypePromotionUpdate(source, update);
	return expected === undefined || sha256(previous) === expected
		? previous : source;
};
