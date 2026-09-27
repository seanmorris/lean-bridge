/**
 * Preserve exact source predecessors of the owned Python wheel projection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedPythonBaseline = "78d2e09252d81f0b123d6175bb6ea454c9205577";
export const ownedPythonHistoryPath = "docs/evidence/owned-python-integration-20260927.json";
export const ownedPythonExecutionPath = "docs/evidence/owned-python-execution-20260927.json";
export const ownedPythonChangedPaths = [
	".github/workflows/consumer-matrix.yml", "config/checked-javascript.json"
	, "config/cli-package.v1.json", "docs/architecture/binding-ir.md"
	, "docs/consume/python.md", "docs/lean/export-decisions.md"
	, "docs/publish/pypi.md", "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json", "package.json"
	, "src/adoption/test-profiles.mjs", "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs", "src/build/owned-c-projection.mjs"
	, "src/build/owned-rust-artifacts.mjs", "tests/documentation.test.mjs"
	, "tests/helpers/owned-aggregate-evidence.mjs"
	, "tests/helpers/owned-c-evidence.mjs"
	, "tests/helpers/owned-ci-source-history.mjs"
	, "tests/helpers/owned-cpp-order-history.mjs"
	, "tests/helpers/owned-package-evidence.mjs"
	, "tests/helpers/owned-reviewed-evidence.mjs"
	, "tests/helpers/owned-rust-evidence.mjs"
	, "tests/helpers/owned-rust-source-history.mjs"
	, "tests/helpers/wit-recursive-callable-evidence.mjs"
	, "tests/owned-c-packaging.test.mjs", "tests/owned-rust-evidence.test.mjs"
].sort();
export const ownedPythonAddedPaths = [
	ownedPythonExecutionPath
	, ...["runtime", "values", "packages"].map(name => `docs/evidence/owned-python-${name}-20260927.md`)
	, "docs/evidence/owned-python-values-20260927.json"
	, ...["assets", "runtime", "values", "conversions", "callables", "package"].map(name => `src/backends/python/owned-${name}.mjs`)
	, "src/build/owned-python-artifacts.mjs", "src/release/owned-pypi.mjs"
	, ...["runtime", "values", "scalars", "callables", "typed", "invalid"].map(name => `tests/fixtures/structured-types/owned-python-${name}.py`)
	, "tests/fixtures/structured-types/owned-installed-python.py"
	, "tests/fixtures/structured-types/owned-installed-python-scalars.py"
	, ...["source-history", "evidence", "installed-probes", "scalars-fixture"].map(name => `tests/helpers/owned-python-${name}.mjs`)
	, ...["runtime", "values", "package", "packaging", "scalar-packaging", "evidence"].map(name => `tests/owned-python-${name}.test.mjs`)
].sort();
let history;

/**
 * Restore recorded nonoverlapping edits only after checking the complete file.
 *
 * @param source - Complete current source text.
 * @param update - Exact predecessor identities and literal edits.
 */
export const reverseOwnedPythonUpdate = (source, update) => {
	assert.ok(ownedPythonChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedPython = (path, source, expected) => {
	const digest = sha256(source);
	if(digest === expected || !ownedPythonChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(ownedPythonHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseOwnedPythonUpdate(source, update) : source;
};
