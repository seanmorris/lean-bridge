/**
 * Preserve exact source predecessors of the owned Ruby gem projection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedDotnet, ownedDotnetNormalizationPaths } from "./owned-dotnet-source-history.mjs";

export const ownedRubyBaseline = "ef9bd830d49a932a13bbc0d683a7a14cd7139b62";
export const ownedRubyHistoryPath = "docs/evidence/owned-ruby-integration-20260927.json";
export const ownedRubyExecutionPath = "docs/evidence/owned-ruby-execution-20260927.json";
export const ownedRubyChangedPaths = [
	".github/workflows/consumer-matrix.yml", "config/checked-javascript.json"
	, "config/cli-package.v1.json", "docs/architecture/binding-ir.md"
	, "docs/consume/ruby.md", "docs/lean/export-decisions.md"
	, "docs/publish/rubygems.md", "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json", "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/c/native-callable-graph-calls.mjs"
	, "src/backends/ruby/copied-assets.mjs", "src/build/native-c-projection.mjs"
	, "src/build/native-gmp.mjs", "src/build/native-project.mjs"
	, "tests/documentation.test.mjs"
	, "tests/native-recursive-callable-model.test.mjs"
	, "tests/owned-c-packaging.test.mjs", "tests/owned-python-evidence.test.mjs"
	, "tests/helpers/owned-aggregate-evidence.mjs"
	, "tests/helpers/owned-c-evidence.mjs"
	, "tests/helpers/owned-ci-source-history.mjs"
	, "tests/helpers/owned-cpp-order-history.mjs"
	, "tests/helpers/owned-package-evidence.mjs"
	, "tests/helpers/owned-python-evidence.mjs"
	, "tests/helpers/owned-python-source-history.mjs"
	, "tests/helpers/owned-reviewed-evidence.mjs"
	, "tests/helpers/owned-rust-evidence.mjs"
	, "tests/helpers/wit-recursive-callable-evidence.mjs"
].sort();
export const ownedRubyAddedPaths = [
	ownedRubyExecutionPath
	, ...["foundation", "conversions", "gmp", "loading"].flatMap(name =>
		["json", "md"].map(extension => `docs/evidence/owned-ruby-${name}-20260927.${extension}`))
	, "docs/evidence/owned-ruby-packages-20260927.md"
	, ...["abi", "call-boundary", "callables", "conversion-runtime", "conversions", "layout", "package", "runtime", "values"].map(name =>
		`src/backends/ruby/owned-${name}.mjs`)
	, "src/backends/ruby/verified-assets.mjs"
	, "src/build/owned-ruby-artifacts.mjs", "src/build/owned-ruby-projection.mjs"
	, "src/release/owned-rubygems.mjs"
	, ...["callables", "coexistence", "gmp", "installed-loader", "loading", "probe", "runtime", "scalars", "values"].map(name =>
		`tests/fixtures/structured-types/owned-ruby-${name}.rb`)
	, "tests/fixtures/structured-types/owned-ruby-gmp.c"
	, "tests/fixtures/structured-types/owned-installed-ruby.rb"
	, "tests/fixtures/structured-types/owned-installed-ruby-scalars.rb"
	, ...["conversion-evidence", "evidence", "source-history"].map(name => `tests/helpers/owned-ruby-${name}.mjs`)
	, ...["coexistence", "conversion-evidence", "conversions", "evidence", "gmp", "layout", "package", "packaging", "runtime", "values"].map(name =>
		`tests/owned-ruby-${name}.test.mjs`)
].sort();
let history;

/**
 * Restore recorded nonoverlapping edits only after checking the complete file.
 *
 * @param source - Complete current source text.
 * @param update - Exact predecessor identities and literal edits.
 */
export const reverseOwnedRubyUpdate = (source, update) => {
	source = beforeOwnedDotnet(update.path, source, update.currentSha256);
	assert.ok(ownedRubyChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedRuby = (path, source, expected) => {
	source = beforeOwnedDotnet(path, source, expected);
	if(typeof source === "string" && !ownedRubyChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected || !ownedRubyChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(ownedRubyHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseOwnedRubyUpdate(source, update) : source;
};

/**
 * Decode only recorded text paths and preserve binary bytes unchanged.
 *
 * @param path - Exact repository-relative source path.
 * @param bytes - Complete current or historical bytes.
 * @param expected - Optional identity at which normalization stops.
 */
export const ownedRubyHistoricalBytes = (path, bytes, expected) => ownedRubyChangedPaths.includes(path) || ownedDotnetNormalizationPaths.includes(path)
	? beforeOwnedRuby(path, bytes.toString("utf8"), expected) : bytes;
