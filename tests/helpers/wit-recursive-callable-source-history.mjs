/**
 * Preserve authenticated predecessors across recursive WIT callable admission.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const witRecursiveCallableHistoryPath = "docs/evidence/wit-recursive-callable-integration-20260926.json";
export const witRecursiveCallableChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json", "config/cli-package.v1.json"
	, "docs/architecture/cross-language-authoring.md"
	, "docs/consume/wit-wasi.md", "docs/contributing/testing.md"
	, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
	, "docs/publish/wit-wasi.md", "docs/reference/types.md"
	, "docs/type-surface.v1.json", "nix/perl-engine-source-boundary.json"
	, "package.json", "scripts/generate-type-docs.mjs"
	, "site/workflows.test.mjs", "src/adoption/test-profiles.mjs"
	, "src/backends/wit/copied-graph-conversions.mjs"
	, "src/backends/wit/copied-graph-package.mjs"
	, "src/backends/wit/copied-model.mjs"
	, "src/build/native-graph-projection.mjs"
	, "src/build/native-wit-artifacts.mjs"
	, "src/build/native-wit-projection.mjs"
	, "src/release/native-wasi.mjs"
	, "tests/documentation.test.mjs"
	, "tests/dotnet-recursive-callable-contract.test.mjs"
	, "tests/helpers/php-recursive-callable-evidence.mjs"
	, "tests/helpers/php-wasm-recursive-callable-evidence.mjs"
	, "tests/helpers/php-wasm-recursive-callable-source-history.mjs"
	, "tests/jvm-recursive-callable-contract.test.mjs"
	, "tests/perl-recursive-callable-contract.test.mjs"
	, "tests/php-recursive-callable-contract.test.mjs"
	, "tests/php-wasm-recursive-callable-evidence.test.mjs"
	, "tests/type-surface-docs.test.mjs", "tests/type-surface.test.mjs"
].sort();
let history;

/**
 * Reconstruct exact prior text in one pass, checking every literal and digest.
 *
 * @param source - Complete measured current file.
 * @param update - Whole-file identities and ordered nonoverlapping edits.
 */
export const reverseWitRecursiveCallableUpdate = (source, update) => {
	assert.ok(witRecursiveCallableChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let end = 0; const chunks = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		chunks.push(source.slice(end, edit.start), edit.previous);
		end = edit.start + edit.current.length;
	}
	chunks.push(source.slice(end));
	const previous = chunks.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Reverse only this recorded transition and leave unknown changes visible.
 *
 * @param path - Repository-relative file path.
 * @param source - Complete current or historical text.
 * @param expected - Optional exact predecessor at which normalization stops.
 */
export const beforeWitRecursiveCallables = (path, source, expected) => {
	const digest = sha256(source);
	if(digest === expected || !witRecursiveCallableChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(witRecursiveCallableHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseWitRecursiveCallableUpdate(source, update) : source;
};
