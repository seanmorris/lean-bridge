/**
 * Preserve exact source predecessors of the Ruby scalar Fin (#1425).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeDotnetFinSource } from "./dotnet-fin-source-history.mjs";

export const rubyFinHistoryPath = "docs/evidence/ruby-fin-source-history-20261006.json";
export const rubyFinChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/native-metadata.mjs"
	, "src/backends/ruby/copied-values.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs"
	, "src/build/native-ruby-artifacts.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/combined-lineage-source-history-tests.mjs"
	, "tests/helpers/cpan-cli-control-source-history-tests.mjs"
	, "tests/helpers/diagnostic-followup-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/native-fin-source-history-tests.mjs"
	, "tests/helpers/npm-fin-diagnostics-source-history-tests.mjs"
	, "tests/helpers/python-fin-source-history-tests.mjs"
	, "tests/helpers/runtime-receipt-source-history-tests.mjs"
	, "tests/helpers/rust-fin-source-history-tests.mjs"
	, "tests/helpers/rust-fin-source-history.mjs"
	, "tests/helpers/test-profile-registration-source-history-tests.mjs"
	, "tests/native-fin.test.mjs"
	, "tests/python-fin.test.mjs"
	, "tests/rust-fin.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseRubyFinUpdate = (source, update) => {
	assert.ok(rubyFinChangedPaths.includes(update.path));
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
export const beforeRubyFinSource = (path, source, expected) => {
	source = beforeDotnetFinSource(path, source, expected);
	if(typeof source !== "string" || !rubyFinChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(rubyFinHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseRubyFinUpdate(source, update) : source;
};
