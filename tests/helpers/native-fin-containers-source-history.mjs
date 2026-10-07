/**
 * Preserve exact source predecessors of the Native Fin container (#1220).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const nativeFinContainersHistoryPath = "docs/evidence/native-fin-containers-source-history-20261006.json";
export const nativeFinContainersChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/consume/dotnet.md"
	, "docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/consume/ruby.md"
	, "docs/consume/rust.md"
	, "docs/consume/wit-wasi.md"
	, "docs/lean/existing-package.md"
	, "docs/php.md"
	, "docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/native-metadata.mjs"
	, "src/analyze/native-types.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/dotnet/copied-values.mjs"
	, "src/backends/jvm/copied-values.mjs"
	, "src/backends/native/fin-refinements.mjs"
	, "src/backends/php/copied-values.mjs"
	, "src/backends/python/copied-values.mjs"
	, "src/backends/python/refinements.mjs"
	, "src/backends/ruby/copied-values.mjs"
	, "src/backends/rust/copied-values.mjs"
	, "src/backends/wit/fin-refinements.mjs"
	, "src/build/native-model.mjs"
	, "src/build/native-project.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/combined-lineage-source-history-tests.mjs"
	, "tests/helpers/cpan-cli-control-source-history-tests.mjs"
	, "tests/helpers/diagnostic-followup-source-history-tests.mjs"
	, "tests/helpers/dotnet-fin-source-history-tests.mjs"
	, "tests/helpers/fin-distribution-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/host-fin-evidence-source-history-tests.mjs"
	, "tests/helpers/jvm-fin-source-history-tests.mjs"
	, "tests/helpers/native-fin-source-history-tests.mjs"
	, "tests/helpers/native-specializations-source-history-tests.mjs"
	, "tests/helpers/native-specializations-source-history.mjs"
	, "tests/helpers/npm-fin-diagnostics-source-history-tests.mjs"
	, "tests/helpers/perl-fin-source-history-tests.mjs"
	, "tests/helpers/php-fin-source-history-tests.mjs"
	, "tests/helpers/python-fin-source-history-tests.mjs"
	, "tests/helpers/ruby-fin-source-history-tests.mjs"
	, "tests/helpers/runtime-receipt-source-history-tests.mjs"
	, "tests/helpers/rust-fin-source-history-tests.mjs"
	, "tests/helpers/test-profile-registration-source-history-tests.mjs"
	, "tests/helpers/wit-fin-source-history-tests.mjs"
	, "tests/native-fin.test.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseNativeFinContainersUpdate = (source, update) => {
	assert.ok(nativeFinContainersChangedPaths.includes(update.path));
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
 * Restore the source before #1220, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNativeFinContainersSource = (path, source, expected) => {
	if(typeof source !== "string" || !nativeFinContainersChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nativeFinContainersHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNativeFinContainersUpdate(source, update) : source;
};
