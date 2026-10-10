/**
 * Authenticate Native Fin JVM exit diagnostics integration without changing earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforePhpWasmSubtypeEntrySource } from "./php-wasm-subtype-entry-history.mjs";

export const finJvmDiagnosticsHistoryPath = "docs/evidence/fin-jvm-diagnostics-source-history-20261010.json";
export const finJvmDiagnosticsPredecessor = "3beb2ca905ee1c4020033aa9dce540a386b091dc";
export const finJvmDiagnosticsChangedPaths = [
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-container-edge-jvm-gdb.mjs"
	, "tests/helpers/fin-container-edge-report-hosts.mjs"
	, "tests/helpers/fin-container-edge-sdk-tests.mjs"
	, "tests/helpers/fin-dotnet-sdk-history-tests.mjs"
	, "tests/helpers/fin-dotnet-sdk-history.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/php-wasm-direct-fin-promotion-tests.mjs"
	, "tests/helpers/php-wasm-subtype-promotion-tests.mjs"
];
let history;

/**
 * Reverse registered spans only after authenticating both complete sources.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseFinJvmDiagnosticsUpdate = (source, update) => {
	assert.ok(finJvmDiagnosticsChangedPaths.includes(update.path));
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
 * Restore only authenticated predecessors, preserving requested stopping digests.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeFinJvmDiagnosticsSource = (path, source, expected) => {
	source = beforePhpWasmSubtypeEntrySource(path, source, expected);
	if(typeof source !== "string" || !finJvmDiagnosticsChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(finJvmDiagnosticsHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseFinJvmDiagnosticsUpdate(source, update) : source;
};
