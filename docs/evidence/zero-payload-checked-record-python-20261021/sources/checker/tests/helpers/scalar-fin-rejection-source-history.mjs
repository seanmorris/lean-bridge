/**
 * Preserve exact source predecessors of the Scalar Fin rejection (#1430).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeScalarFinWordingSource } from "./scalar-fin-wording-source-history.mjs";

export const scalarFinRejectionHistoryPath = "docs/evidence/scalar-fin-rejection-source-history-20261007.json";
export const scalarFinRejectionChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/contributing/testing.md"
	, "docs/evidence/npm-browser-refinements-20261007.md"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "src/build/compiler-adapters.mjs"
	, "src/build/component-callable-adapters.mjs"
	, "src/build/component-copied-adapters.mjs"
	, "src/build/component-record-adapters.mjs"
	, "src/build/component-scalar-adapters.mjs"
	, "tests/browser-refinements.test.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/component-record-contract.test.mjs"
	, "tests/documentation.test.mjs"
	, "tests/fixtures/browser-refinements/javascript.mjs"
	, "tests/helpers/browser-refinement-packages.mjs"
	, "tests/helpers/browser-refinements-source-history-tests.mjs"
	, "tests/helpers/browser-refinements-source-history.mjs"
	, "tests/helpers/combined-lineage-source-history-tests.mjs"
	, "tests/helpers/cpan-cli-control-source-history-tests.mjs"
	, "tests/helpers/diagnostic-followup-source-history-tests.mjs"
	, "tests/helpers/dotnet-fin-source-history-tests.mjs"
	, "tests/helpers/fin-distribution-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/host-fin-evidence-source-history-tests.mjs"
	, "tests/helpers/jvm-fin-source-history-tests.mjs"
	, "tests/helpers/native-fin-containers-source-history-tests.mjs"
	, "tests/helpers/native-fin-source-history-tests.mjs"
	, "tests/helpers/native-specializations-source-history-tests.mjs"
	, "tests/helpers/native-subtype-source-history-tests.mjs"
	, "tests/helpers/npm-fin-diagnostics-source-history-tests.mjs"
	, "tests/helpers/perl-fin-source-history-tests.mjs"
	, "tests/helpers/php-fin-source-history-tests.mjs"
	, "tests/helpers/python-fin-source-history-tests.mjs"
	, "tests/helpers/refinement-audit-source-history-tests.mjs"
	, "tests/helpers/ruby-fin-source-history-tests.mjs"
	, "tests/helpers/runtime-receipt-source-history-tests.mjs"
	, "tests/helpers/rust-fin-source-history-tests.mjs"
	, "tests/helpers/test-profile-registration-source-history-tests.mjs"
	, "tests/helpers/wit-fin-source-history-tests.mjs"
	, "tests/type-surface.test.mjs"
	, "tests/word-contract.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseScalarFinRejectionUpdate = (source, update) => {
	assert.ok(scalarFinRejectionChangedPaths.includes(update.path));
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
 * Restore the source before #1430, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeScalarFinRejectionSource = (path, source, expected) => {
	source = beforeScalarFinWordingSource(path, source, expected);
	if(typeof source !== "string" || !scalarFinRejectionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(scalarFinRejectionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseScalarFinRejectionUpdate(source, update) : source;
};
