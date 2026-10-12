/**
 * Preserve source identities when adding retained PHP-Wasm failure diagnostics.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmFailureDiagnosticsHistoryPath = "docs/evidence/php-wasm-failure-diagnostics-source-history-20261012.json";
export const phpWasmFailureDiagnosticsPredecessor = "41ed314cf35d1157daf21a9692a094c62976e22c";
export const phpWasmFailureDiagnosticsChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/type-surface.v1.json"
	, "src/build/canonical-build.mjs"
	, "src/build/process-runner.mjs"
	, "tests/canonical-build.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-dotnet-ci-history.mjs"
	, "tests/helpers/nominal-subtype-dotnet-ci-history-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-ci-workflow-tests.mjs"
	, "tests/php-wasm-recursive-callable-generated.test.mjs"
];
let history;

/**
 * Reverse only exact complete-source transitions with authenticated spans.
 *
 * @param source - Complete current source.
 * @param update - Immutable source transition.
 */
export const reversePhpWasmFailureDiagnosticsUpdate = (source, update) => {
	assert.ok(phpWasmFailureDiagnosticsChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
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
 * Keep unknown edits and honor explicit intermediate stopping digests.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforePhpWasmFailureDiagnosticsSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !phpWasmFailureDiagnosticsChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(phpWasmFailureDiagnosticsHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reversePhpWasmFailureDiagnosticsUpdate(source, update) : source;
};
