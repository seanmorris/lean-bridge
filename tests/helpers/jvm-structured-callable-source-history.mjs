/**
 * Preserve exact predecessor sources around structured JVM callable support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforePerlStructuredCallables } from "./perl-structured-callable-source-history.mjs";

export const jvmStructuredCallableHistoryPath = "docs/evidence/jvm-structured-callable-integration-20260925.json";
export const jvmStructuredCallableChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/consume/java.md", "docs/consume/kotlin.md"
	, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
	, "docs/publish/maven.md", "docs/reference/types.md"
	, "docs/type-surface.v1.json", "scripts/generate-type-docs.mjs"
	, "src/adoption/test-profiles.mjs", "src/backends/jvm/callables.mjs"
	, "src/backends/jvm/copied-kotlin.mjs", "src/backends/jvm/copied-model.mjs"
	, "src/backends/jvm/copied-runtime.mjs", "src/backends/jvm/copied-values.mjs"
	, "src/build/native-c-projection.mjs", "src/build/native-project.mjs"
	, "tests/current-source-evidence.test.mjs", "tests/documentation.test.mjs"
	, "tests/dotnet-structured-callable-evidence.test.mjs"
	, "tests/helpers/dotnet-structured-callable-evidence.mjs"
	, "tests/helpers/dotnet-structured-callable-source-history.mjs"
	, "tests/helpers/jvm-source-history.mjs", "tests/helpers/type-corpus-jvm.mjs"
	, "tests/java-collection-evidence.test.mjs"
	, "tests/kotlin-collection-evidence.test.mjs"
	, "tests/jvm-callable-contract.test.mjs"
	, "tests/jvm-callable-evidence.test.mjs"
	, "tests/jvm-compound-contract.test.mjs", "tests/jvm-list-contract.test.mjs"
	, "tests/native-c-family.test.mjs"
	, "tests/type-surface-docs.test.mjs", "tests/type-surface.test.mjs"
].sort();
let history;
const reverse = (source, update) => {
	let result = source;
	for(const edit of update.edits.toReversed())
	{
		if(result.slice(edit.start, edit.start + edit.current.length) !== edit.current) return source;
		result = result.slice(0, edit.start) + edit.previous + result.slice(edit.start + edit.current.length);
	}
	return result;
};

/**
 * Authenticate complete source bytes and every ordered literal edit.
 *
 * @param source - Complete source at this milestone.
 * @param update - Explicit predecessor and replacement spans.
 */
export const reverseJvmStructuredCallableUpdate = (source, update) => {
	assert.ok(jvmStructuredCallableChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let end = 0;
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		end = edit.start + edit.current.length;
	}
	const previous = reverse(source, update);
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Undo only recorded JVM edits, leaving unrelated changes visible to checks.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or predecessor source.
 * @param expected - Optional intermediate identity at which to stop.
 */
export const beforeJvmStructuredCallables = (path, source, expected) => {
	source = beforePerlStructuredCallables(path, source, expected);
	if(sha256(source) === expected || !jvmStructuredCallableChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(jvmStructuredCallableHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update ? reverse(source, update) : source;
};
