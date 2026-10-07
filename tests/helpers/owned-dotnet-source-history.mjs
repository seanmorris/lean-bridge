/**
 * Preserve exact predecessors across installed owned NuGet integration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedDotnetProcess, ownedDotnetProcessNormalizationPaths } from "./owned-dotnet-process-history.mjs";

export const ownedDotnetBaseline = "ab88c3888c3db7d4a1946e79093773233cdfafef";
export const ownedDotnetHistoryPath = "docs/evidence/owned-dotnet-integration-20260927.json";
export const ownedDotnetExecutionPath = "docs/evidence/owned-dotnet-execution-20260927.json";
export const ownedDotnetChangedPaths = [
	".github/workflows/consumer-matrix.yml", "config/checked-javascript.json"
	, "config/cli-package.v1.json", "docs/architecture/binding-ir.md"
	, "docs/consume/dotnet.md", "docs/lean/export-decisions.md"
	, "docs/publish/nuget.md", "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json", "package.json"
	, "src/adoption/test-profiles.mjs", "src/backends/dotnet/callables.mjs"
	, "src/backends/dotnet/copied-graph-assets.mjs"
	, "src/backends/dotnet/copied-values.mjs"
	, "src/build/native-c-projection.mjs", "src/build/native-project.mjs"
	, "tests/documentation.test.mjs", "tests/dotnet-graph-package.test.mjs"
	, "tests/helpers/dotnet-recursive-callable-probes.mjs"
	, "tests/helpers/dotnet-recursive-callable-consumer.mjs"
	, "tests/helpers/owned-aggregate-evidence.mjs"
	, "tests/helpers/owned-c-evidence.mjs"
	, "tests/helpers/owned-ci-source-history.mjs"
	, "tests/helpers/owned-cpp-order-history.mjs"
	, "tests/helpers/owned-package-evidence.mjs"
	, "tests/helpers/owned-reviewed-evidence.mjs"
	, "tests/helpers/owned-ruby-evidence.mjs"
	, "tests/helpers/owned-ruby-source-history.mjs"
	, "tests/helpers/owned-rust-evidence.mjs"
	, "tests/helpers/wit-recursive-callable-evidence.mjs"
	, "tests/owned-ruby-evidence.test.mjs"
].sort();
export const ownedDotnetNormalizationPaths = [...new Set([...ownedDotnetChangedPaths, ...ownedDotnetProcessNormalizationPaths])].sort();
export const ownedDotnetAddedPaths = [
	ownedDotnetExecutionPath
	, ...["foundation", "callbacks", "loading"].flatMap(name =>
		["json", "md"].map(extension => `docs/evidence/owned-dotnet-${name}-20260927.${extension}`))
	, "docs/evidence/owned-dotnet-packages-20260927.md"
	, ...["callables", "calls", "conversion-runtime", "conversions", "layout", "package", "runtime", "scalars", "thread-exit", "values"].map(name =>
		`src/backends/dotnet/owned-${name}.mjs`)
	, "src/backends/dotnet/verified-assets.mjs"
	, "src/build/owned-dotnet-artifacts.mjs"
	, "src/build/owned-dotnet-projection.mjs"
	, "src/release/owned-nuget.mjs"
	, ...["Owned.lean", "lakefile.toml", "lean-toolchain", "lean-bridge.exports.json"].map(name =>
		`tests/fixtures/onboarding/owned-dotnet-callables/${name}`)
	, ...["callables", "callback-signatures", "coexistence", "compositions", "conversions", "loading", "runtime", "scalars"].map(name =>
		`tests/fixtures/structured-types/owned-dotnet-${name}.cs`)
	, "tests/fixtures/structured-types/owned-installed-dotnet.cs"
	, "tests/fixtures/structured-types/owned-installed-dotnet-scalars.cs"
	, ...["callback-fixture", "evidence", "installed", "native", "source-history"].map(name => `tests/helpers/owned-dotnet-${name}.mjs`)
	, ...["callables", "callback-evidence", "callback-signatures", "coexistence", "conversions", "evidence", "layout", "loading-evidence", "package", "packaging", "runtime", "values"].map(name =>
		`tests/owned-dotnet-${name}.test.mjs`)
].sort();
let history;

/**
 * Reverse literal nonoverlapping edits after authenticating the whole file.
 *
 * @param source - Complete current source text.
 * @param update - Exact current and previous identities with ordered edits.
 */
export const reverseOwnedDotnetUpdate = (source, update) => {
	source = beforeOwnedDotnetProcess(update.path, source, update.currentSha256);
	assert.ok(ownedDotnetChangedPaths.includes(update.path), update.path);
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
 * Leave unknown content and explicitly requested current identities unchanged.
 *
 * @param path - Exact repository-relative source path.
 * @param source - Complete current or historical text.
 * @param expected - Optional exact identity at which normalization stops.
 */
export const beforeOwnedDotnet = (path, source, expected) => {
	source = beforeOwnedDotnetProcess(path, source, expected);
	if(typeof source === "string" && !ownedDotnetChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected || !ownedDotnetChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(ownedDotnetHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseOwnedDotnetUpdate(source, update) : source;
};

/**
 * Decode only declared text paths, preserving other bytes exactly.
 *
 * @param path - Exact repository-relative path.
 * @param bytes - Complete current or historical bytes.
 * @param expected - Optional exact identity at which normalization stops.
 */
export const ownedDotnetHistoricalBytes = (path, bytes, expected) => ownedDotnetNormalizationPaths.includes(path)
	? beforeOwnedDotnet(path, bytes.toString("utf8"), expected) : bytes;
