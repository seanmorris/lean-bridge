/**
 * Preserve exact predecessors when integrating the native generic-record Array rollout.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeFinDiagnosticSource } from "./native-fin-diagnostic-source-history.mjs";

export const arrayRolloutHistoryPath = "docs/evidence/generic-record-array-rollout-source-history-20261009.json";
export const arrayRolloutPredecessor = "e0c45bdfe5c11bcfcccb3d6a41510c70dfa54ad5";
export const arrayRolloutChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/perl-consumer.yml"
	, "docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/consume/dotnet.md"
	, "docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/consume/perl.md"
	, "docs/consume/python.md"
	, "docs/consume/ruby.md"
	, "docs/consume/rust.md"
	, "docs/consume/wit-wasi.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/php.md"
	, "docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/generic-record-arrays.test.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/generic-record-arrays.mjs"
	, "tests/helpers/perl-xs-budget-source-history-tests.mjs"
	, "tests/helpers/wasm-entry-supplement-source-history.mjs"
	, "tests/wasm-entry-supplement-history.test.mjs"
	, "tests/perl-scalar-promotion.test.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseArrayRolloutUpdate = (source, update) => {
	assert.ok(arrayRolloutChangedPaths.includes(update.path));
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
 * Restore the source before the native Array rollout, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeArrayRolloutSource = (path, source, expected) => {
	source = beforeFinDiagnosticSource(path, source, expected);
	if(typeof source !== "string" || !arrayRolloutChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(arrayRolloutHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseArrayRolloutUpdate(source, update) : source;
};
