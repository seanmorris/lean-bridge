/**
 * Preserve exact source predecessors of the native Fin callback reply integration (#1220).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeCallbackCoverageRepairSource } from "./callback-coverage-repair-source-history.mjs";

export const nativeFinReplyHistoryPath = "docs/evidence/native-fin-reply-source-history-20261008.json";
export const nativeFinReplyChangedPaths = [
	"docs/type-surface.v1.json"
	, ".github/workflows/consumer-matrix.yml"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/native-types.mjs"
	, "src/backends/c/native-callables.mjs"
	, "src/build/native-component.mjs"
	, "src/build/native-model.mjs"
	, "src/release/native-c-family.mjs"
	, "tests/native-fin-callbacks.test.mjs"
	, "tests/native-fin-containers.test.mjs"
	, "tests/native-fin.test.mjs"
	, "tests/reviewed-callback-fin.test.mjs"
	, "docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/lean/existing-package.md"
	, "docs/contributing/testing.md"
	, "tests/documentation.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/php-wasm-fin-promotion-source-history.mjs"
	, "tests/helpers/php-wasm-fin-promotion-source-history-tests.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseNativeFinReplyUpdate = (source, update) => {
	assert.ok(nativeFinReplyChangedPaths.includes(update.path));
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
 * Restore the source before the native Fin callback reply integration, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNativeFinReplySource = (path, source, expected) => {
	source = beforeCallbackCoverageRepairSource(path, source, expected);
	if(typeof source !== "string" || !nativeFinReplyChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nativeFinReplyHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNativeFinReplyUpdate(source, update) : source;
};
