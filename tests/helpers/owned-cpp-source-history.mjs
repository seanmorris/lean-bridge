/**
 * Preserve the exact predecessors of the C++ ownership projection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedCppOrder } from "./owned-cpp-order-history.mjs";

export const ownedCppBaseline = "de6ec9dde00779476152481876de339f4cb82656";
export const ownedCppHistoryPath = "docs/evidence/owned-cpp-integration-20260927.json";
export const ownedCppExecutionPath = "docs/evidence/owned-cpp-execution-20260927.json";
export const ownedCppChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json", "config/cli-package.v1.json"
	, "docs/architecture/binding-ir.md", "docs/consume/cpp.md"
	, "docs/lean/export-decisions.md", "docs/publish/c.md", "docs/publish/cpp.md"
	, "docs/type-surface.v1.json", "nix/perl-engine-source-boundary.json"
	, "package.json", "src/adoption/test-profiles.mjs"
	, "src/backends/c/copied-graph-layout.mjs"
	, "src/backends/cpp/copied-graph-values.mjs"
	, "src/build/native-c-projection.mjs", "src/build/native-project.mjs"
	, "src/build/owned-c-projection.mjs", "src/release/owned-c-package.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/owned-aggregate-evidence.mjs"
	, "tests/helpers/owned-c-evidence.mjs"
	, "tests/helpers/owned-ci-source-history.mjs"
	, "tests/helpers/owned-package-evidence.mjs"
	, "tests/helpers/owned-reviewed-evidence.mjs"
	, "tests/helpers/wit-recursive-callable-evidence.mjs"
	, "tests/owned-c-packaging.test.mjs", "tests/owned-host-evidence.test.mjs"
].sort();
export const ownedCppAddedPaths = [
	ownedCppExecutionPath, "docs/evidence/owned-cpp-values-20260927.md"
	, ...["runtime", "values", "conversions", "callables", "package"].map(name => `src/backends/cpp/owned-${name}.mjs`)
	, ...["Owned.lean", "lakefile.toml", "lean-toolchain", "lean-bridge.exports.json"]
		.map(name => `tests/fixtures/onboarding/owned-cpp-composition/${name}`)
	, ...["owned-cpp-runtime", "owned-cpp-callables", "owned-installed-cpp"]
		.map(name => `tests/fixtures/structured-types/${name}.cpp`)
	, ...["composition-fixture", "source-history", "evidence"]
		.map(name => `tests/helpers/owned-cpp-${name}.mjs`)
	, ...["runtime", "callables", "packaging", "evidence"].map(name => `tests/owned-cpp-${name}.test.mjs`)
].sort();
let history;

/**
 * Reverse only recorded complete text identities and nonoverlapping edits.
 *
 * @param source - Complete current source text.
 * @param update - Recorded source identities and literal edits.
 */
export const reverseOwnedCppUpdate = (source, update) => {
	source = beforeOwnedCppOrder(update.path, source, update.currentSha256);
	assert.ok(ownedCppChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length);
	const chunks = []; let end = 0;
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		chunks.push(source.slice(end, edit.start), edit.previous); end = edit.start + edit.current.length;
	}
	chunks.push(source.slice(end));
	const previous = chunks.join(""); assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Leave unknown bytes and explicitly requested current identities unchanged.
 *
 * @param path - Exact repository-relative source path.
 * @param source - Complete current or historical text.
 * @param expected - Optional identity at which normalization must stop.
 */
export const beforeOwnedCpp = (path, source, expected) => {
	source = beforeOwnedCppOrder(path, source, expected);
	if(typeof source === "string" && !ownedCppChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected || !ownedCppChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(ownedCppHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseOwnedCppUpdate(source, update) : source;
};
