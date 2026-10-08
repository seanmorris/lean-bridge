/**
 * Preserve exact source predecessors of the Copied-graph repair change (#1451).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const copiedGraphRepairHistoryPath = "docs/evidence/copied-graph-repair-source-history-20261008.json";
export const copiedGraphRepairChangedPaths = [
	"src/build/component-recursive-lean.mjs"
	, "tests/native-graph-model.test.mjs"
	, "tests/php-wasm-graph-package.test.mjs"
	, "docs/type-surface.v1.json"
	, "tests/helpers/checked-record-promotion-source-history.mjs"
	, "tests/helpers/checked-record-promotion-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/c-structured-callable-evidence.mjs"
	, "tests/helpers/closure-thread-evidence.mjs"
	, "tests/helpers/cpp-structured-callable-evidence.mjs"
	, "tests/helpers/dotnet-recursive-callable-evidence.mjs"
	, "tests/helpers/dotnet-structured-callable-evidence.mjs"
	, "tests/helpers/jvm-recursive-callable-evidence.mjs"
	, "tests/helpers/jvm-structured-callable-evidence.mjs"
	, "tests/helpers/managed-ci-isolation-evidence.mjs"
	, "tests/helpers/native-fork-repair-evidence.mjs"
	, "tests/helpers/native-recursive-callable-evidence.mjs"
	, "tests/helpers/nominal-fin-contract-tests.mjs"
	, "tests/helpers/npm-structured-callable-evidence.mjs"
	, "tests/helpers/owned-aggregate-evidence.mjs"
	, "tests/helpers/owned-c-evidence.mjs"
	, "tests/helpers/owned-cpp-evidence.mjs"
	, "tests/helpers/owned-dotnet-evidence.mjs"
	, "tests/helpers/owned-dotnet-process-evidence.mjs"
	, "tests/helpers/owned-host-evidence.mjs"
	, "tests/helpers/owned-jvm-package-evidence.mjs"
	, "tests/helpers/owned-package-evidence.mjs"
	, "tests/helpers/owned-python-evidence.mjs"
	, "tests/helpers/owned-reviewed-evidence.mjs"
	, "tests/helpers/owned-ruby-evidence.mjs"
	, "tests/helpers/owned-rust-evidence.mjs"
	, "tests/helpers/perl-recursive-callable-evidence.mjs"
	, "tests/helpers/perl-structured-callable-evidence.mjs"
	, "tests/helpers/php-ci-regression-evidence.mjs"
	, "tests/helpers/php-recursive-callable-evidence.mjs"
	, "tests/helpers/php-structured-callable-evidence.mjs"
	, "tests/helpers/php-wasm-recursive-callable-evidence.mjs"
	, "tests/helpers/php-wasm-structured-callable-evidence.mjs"
	, "tests/helpers/python-recursive-callable-evidence.mjs"
	, "tests/helpers/python-structured-callable-evidence.mjs"
	, "tests/helpers/ruby-recursive-callable-evidence.mjs"
	, "tests/helpers/ruby-structured-callable-evidence.mjs"
	, "tests/helpers/rust-recursive-callable-evidence.mjs"
	, "tests/helpers/rust-structured-callable-evidence.mjs"
	, "tests/helpers/wit-recursive-acceptance.mjs"
	, "tests/helpers/wit-recursive-callable-evidence.mjs"
	, "tests/helpers/wit-structured-callable-evidence.mjs"
	, "tests/type-surface.test.mjs"
	, "tests/helpers/checked-record-evidence-tests.mjs"
	, "tests/type-corpus.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCopiedGraphRepairUpdate = (source, update) => {
	assert.ok(copiedGraphRepairChangedPaths.includes(update.path));
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
 * Restore the source before the copied-graph repair, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCopiedGraphRepairSource = (path, source, expected) => {
	if(typeof source !== "string" || !copiedGraphRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(copiedGraphRepairHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseCopiedGraphRepairUpdate(source, update) : source;
};
