/**
 * Preserve exact source identities across the native Fin diagnostic update.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const finDiagnosticHistoryPath = "docs/evidence/native-fin-diagnostic-source-history-20261010.json";
export const finDiagnosticPredecessor = "5ba49f93ad5226a876b40057f436e265307f8323";
export const finDiagnosticChangedPaths = [
	"config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/type-surface.v1.json"
	, "package.json"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/c/native-primitives.mjs"
	, "tests/fin-container-entry-dispatch.test.mjs"
	, "tests/fixtures/fin-callback-consumers/c.c"
	, "tests/fixtures/fin-callback-consumers/cpp.cpp"
	, "tests/fixtures/fin-container-consumers/c.c"
	, "tests/fixtures/fin-container-consumers/cpp.cpp"
	, "tests/fixtures/fin-container-consumers/dotnet.cs"
	, "tests/fixtures/fin-container-consumers/java.java"
	, "tests/fixtures/fin-container-consumers/kotlin.kt"
	, "tests/fixtures/fin-container-consumers/php-native.php"
	, "tests/fixtures/fin-container-consumers/python.py"
	, "tests/fixtures/fin-container-consumers/ruby.rb"
	, "tests/fixtures/fin-container-consumers/rust.rs"
	, "tests/fixtures/fin-container-consumers/wit-wasi.c"
	, "tests/fixtures/fin-container-edge-consumers/c.c"
	, "tests/fixtures/fin-container-edge-consumers/cpp.cpp"
	, "tests/fixtures/fin-container-edge-consumers/python.py"
	, "tests/fixtures/fin-product-array-consumers/c.c"
	, "tests/fixtures/fin-product-array-consumers/cpp.cpp"
	, "tests/fixtures/fin-product-array-consumers/dotnet.cs"
	, "tests/fixtures/fin-product-array-consumers/java.java"
	, "tests/fixtures/fin-product-array-consumers/kotlin.kt"
	, "tests/fixtures/fin-product-array-consumers/php-native.php"
	, "tests/fixtures/fin-product-array-consumers/python.py"
	, "tests/fixtures/fin-product-array-consumers/ruby.rb"
	, "tests/fixtures/fin-product-array-consumers/rust.rs"
	, "tests/fixtures/fin-product-array-consumers/wit-wasi.c"
	, "tests/fixtures/fin-product-consumers/c.c"
	, "tests/fixtures/fin-product-consumers/cpp.cpp"
	, "tests/fixtures/fin-product-consumers/dotnet.cs"
	, "tests/fixtures/fin-product-consumers/java.java"
	, "tests/fixtures/fin-product-consumers/kotlin.kt"
	, "tests/fixtures/fin-product-consumers/php-native.php"
	, "tests/fixtures/fin-product-consumers/python.py"
	, "tests/fixtures/fin-product-consumers/ruby.rb"
	, "tests/fixtures/fin-product-consumers/rust.rs"
	, "tests/fixtures/fin-product-consumers/wit-wasi.c"
	, "tests/fixtures/fin-record-consumers/c.c"
	, "tests/fixtures/fin-record-consumers/cpp.cpp"
	, "tests/fixtures/fin-record-consumers/dotnet.cs"
	, "tests/fixtures/fin-record-consumers/java.java"
	, "tests/fixtures/fin-record-consumers/kotlin.kt"
	, "tests/fixtures/fin-record-consumers/php-native.php"
	, "tests/fixtures/fin-record-consumers/python.py"
	, "tests/fixtures/fin-record-consumers/ruby.rb"
	, "tests/fixtures/fin-record-consumers/rust.rs"
	, "tests/fixtures/fin-record-consumers/wit-wasi.c"
	, "tests/fixtures/fin-reply-consumers/bypass.c"
	, "tests/fixtures/fin-reply-consumers/c.c"
	, "tests/fixtures/fin-reply-consumers/cpp.cpp"
	, "tests/fixtures/inherited-record-consumers/c.c"
	, "tests/fixtures/inherited-record-consumers/cpp.cpp"
	, "tests/fixtures/reviewed-callback-fin-consumers/c.c"
	, "tests/fixtures/reviewed-callback-fin-consumers/cpp.cpp"
	, "tests/helpers/fin-container-entry-dispatch.mjs"
	, "tests/helpers/fin-container-entry-probes.mjs"
	, "tests/helpers/fin-container-host-probes.mjs"
	, "tests/helpers/fin-product-array-dispatch-evidence-tests.mjs"
	, "tests/helpers/fin-product-array-evidence-tests.mjs"
	, "tests/helpers/fin-product-array-mutation.mjs"
	, "tests/helpers/fin-record-evidence-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/fin-reply-compiled-tests.mjs"
	, "tests/helpers/fin-wit-record-evidence-tests.mjs"
	, "tests/helpers/generic-record-array-rollout-source-history.mjs"
	, "tests/helpers/native-fin-callback-evidence-tests.mjs"
	, "tests/helpers/php-wasm-fin-evidence-tests.mjs"
	, "tests/native-fin-callbacks.test.mjs"
	, "tests/native-fin-product-arrays.test.mjs"
	, "tests/native-fin-products.test.mjs"
	, "tests/native-fin-records.test.mjs"
	, "tests/php-wasm-fin.test.mjs"
];
let history;

/**
 * Reverse only complete, authenticated source transitions.
 *
 * @param source - Current source bytes decoded as UTF-8.
 * @param update - A registered exact transition.
 */
export const reverseFinDiagnosticUpdate = (source, update) => {
	assert.ok(finDiagnosticChangedPaths.includes(update.path));
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
 * Restore the exact predecessor, or preserve the requested/unknown source identity.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeFinDiagnosticSource = (path, source, expected) => {
	if(typeof source !== "string" || !finDiagnosticChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(finDiagnosticHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseFinDiagnosticUpdate(source, update) : source;
};
