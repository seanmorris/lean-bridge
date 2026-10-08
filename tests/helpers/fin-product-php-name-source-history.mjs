/**
 * Preserve exact source predecessors of the PHP-safe product name change (#1220).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforePhpReceiverDependencySource } from "./php-receiver-dependency-source-history.mjs";

export const finProductPhpNameHistoryPath = "docs/evidence/fin-product-php-name-source-history-20261007.json";
export const finProductPhpNameChangedPaths = [
	"tests/fixtures/fin-product-consumers/c.c"
	, "tests/fixtures/fin-product-consumers/cpp.cpp"
	, "tests/fixtures/fin-product-consumers/dotnet.cs"
	, "tests/fixtures/fin-product-consumers/java.java"
	, "tests/fixtures/fin-product-consumers/kotlin.kt"
	, "tests/fixtures/fin-product-consumers/perl.pl"
	, "tests/fixtures/fin-product-consumers/php-native.php"
	, "tests/fixtures/fin-product-consumers/python.py"
	, "tests/fixtures/fin-product-consumers/ruby.rb"
	, "tests/fixtures/fin-product-consumers/rust.rs"
	, "tests/fixtures/fin-product-consumers/wit-wasi.c"
	, "tests/fixtures/onboarding/native-fin-products/FinProducts.lean"
	, "tests/helpers/ci-dependency-timeout-source-history-tests.mjs"
	, "tests/helpers/ci-dependency-timeout-source-history.mjs"
	, "tests/helpers/fin-product-evidence-tests.mjs"
	, "tests/helpers/fin-product-install.mjs"
	, "tests/helpers/fin-product-model.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/reviewed-fin-product-fixture.mjs"
	, "tests/php-wasm-fin.test.mjs"
	, "tests/php-wasm-generic-records.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseFinProductPhpNameUpdate = (source, update) => {
	assert.ok(finProductPhpNameChangedPaths.includes(update.path));
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
export const beforeFinProductPhpNameSource = (path, source, expected) => {
	source = beforePhpReceiverDependencySource(path, source, expected);
	if(typeof source !== "string" || !finProductPhpNameChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(finProductPhpNameHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseFinProductPhpNameUpdate(source, update) : source;
};
