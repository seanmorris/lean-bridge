/**
 * Preserve exact source predecessors of the WIT scalar Fin (#1425).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeFinDistributionSource } from "./fin-distribution-source-history.mjs";

export const witFinHistoryPath = "docs/evidence/wit-fin-source-history-20261006.json";
export const witFinChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/native-metadata.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs"
	, "src/build/native-wit-artifacts.mjs"
	, "src/release/native-wasi.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/documentation.test.mjs"
	, "tests/dotnet-fin.test.mjs"
	, "tests/helpers/combined-lineage-source-history-tests.mjs"
	, "tests/helpers/cpan-cli-control-source-history-tests.mjs"
	, "tests/helpers/diagnostic-followup-source-history-tests.mjs"
	, "tests/helpers/dotnet-fin-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/jvm-fin-source-history-tests.mjs"
	, "tests/helpers/native-fin-source-history-tests.mjs"
	, "tests/helpers/npm-fin-diagnostics-source-history-tests.mjs"
	, "tests/helpers/php-fin-source-history-tests.mjs"
	, "tests/helpers/php-fin-source-history.mjs"
	, "tests/helpers/python-fin-source-history-tests.mjs"
	, "tests/helpers/ruby-fin-source-history-tests.mjs"
	, "tests/helpers/runtime-receipt-source-history-tests.mjs"
	, "tests/helpers/rust-fin-source-history-tests.mjs"
	, "tests/helpers/test-profile-registration-source-history-tests.mjs"
	, "tests/jvm-fin.test.mjs"
	, "tests/native-fin.test.mjs"
	, "tests/php-fin.test.mjs"
	, "tests/python-fin.test.mjs"
	, "tests/ruby-fin.test.mjs"
	, "tests/rust-fin.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseWitFinUpdate = (source, update) => {
	assert.ok(witFinChangedPaths.includes(update.path));
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
 * Restore the source before #1425, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeWitFinSource = (path, source, expected) => {
	source = beforeFinDistributionSource(path, source, expected);
	if(typeof source !== "string" || !witFinChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(witFinHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseWitFinUpdate(source, update) : source;
};
