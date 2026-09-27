/**
 * Preserve exact source predecessors of the owned Cargo projection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedRustBaseline = "16e4ef6994b2594bf87e0b2805a85b437c53f091";
export const ownedRustHistoryPath = "docs/evidence/owned-rust-integration-20260927.json";
export const ownedRustExecutionPath = "docs/evidence/owned-rust-execution-20260927.json";
export const ownedRustChangedPaths = [
	".github/workflows/consumer-matrix.yml", "config/checked-javascript.json"
	, "config/cli-package.v1.json", "docs/architecture/binding-ir.md"
	, "docs/consume/rust.md", "docs/lean/export-decisions.md"
	, "docs/publish/cargo.md"
	, "docs/type-surface.v1.json", "nix/perl-engine-source-boundary.json"
	, "package.json", "src/adoption/test-profiles.mjs"
	, "src/build/native-c-projection.mjs", "src/build/native-project.mjs"
	, "src/build/owned-c-projection.mjs", "tests/documentation.test.mjs"
	, "tests/helpers/owned-aggregate-evidence.mjs"
	, "tests/helpers/owned-c-evidence.mjs"
	, "tests/helpers/owned-ci-source-history.mjs"
	, "tests/helpers/owned-cpp-evidence.mjs"
	, "tests/helpers/owned-cpp-order-history.mjs"
	, "tests/helpers/owned-package-evidence.mjs"
	, "tests/helpers/owned-reviewed-evidence.mjs"
	, "tests/helpers/wit-recursive-callable-evidence.mjs"
	, "tests/owned-c-packaging.test.mjs"
	, "tests/owned-cpp-evidence.test.mjs"
].sort();
export const ownedRustAddedPaths = [
	ownedRustExecutionPath, "docs/evidence/owned-rust-values-20260927.md"
	, ...["runtime", "values", "conversions", "callables", "package"].map(name => `src/backends/rust/owned-${name}.mjs`)
	, "src/build/owned-rust-artifacts.mjs", "src/build/owned-rust-projection.mjs"
	, "src/release/owned-cargo.mjs"
	, ...["owned-rust-runtime", "owned-rust-values", "owned-rust-callables", "owned-installed-rust"].map(name => `tests/fixtures/structured-types/${name}.rs`)
	, ...["source-history", "evidence"].map(name => `tests/helpers/owned-rust-${name}.mjs`)
	, ...["runtime", "values", "packaging", "evidence"].map(name => `tests/owned-rust-${name}.test.mjs`)
].sort();
let history;

/**
 * Reverse recorded nonoverlapping edits after checking the entire source.
 *
 * @param source - Complete source text.
 * @param update - Exact predecessor identities and literal edits.
 */
export const reverseOwnedRustUpdate = (source, update) => {
	assert.ok(ownedRustChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	const chunks = []; let end = 0;
	for(const { start, current, previous } of update.edits)
	{
		assert.ok(Number.isSafeInteger(start) && start >= end);
		assert.equal(typeof current, "string"); assert.equal(typeof previous, "string");
		assert.notEqual(current, previous);
		assert.equal(source.slice(start, start + current.length), current);
		chunks.push(source.slice(end, start), previous); end = start + current.length;
	}
	chunks.push(source.slice(end)); const restored = chunks.join("");
	assert.equal(sha256(restored), update.previousSha256, update.path);
	return restored;
};

/**
 * Leave unknown bytes and explicitly requested current identities unchanged.
 *
 * @param path - Exact repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional identity at which normalization stops.
 */
export const beforeOwnedRust = (path, source, expected) => {
	const digest = sha256(source);
	if(digest === expected || !ownedRustChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(ownedRustHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseOwnedRustUpdate(source, update) : source;
};
