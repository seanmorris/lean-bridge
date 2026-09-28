/**
 * Preserve published source evidence across owned CPAN package integration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforePerlContractRepair, perlContractRepairChangedPaths } from "./perl-contract-repair-history.mjs";

export const ownedPerlBaseline = "84d157c351f20ae3a41f3926db17cc14e69a3989";
export const ownedPerlHistoryPath = "docs/evidence/owned-perl-integration-20260928.json";
export const ownedPerlChangedPaths = [
	".github/workflows/perl-consumer.yml"
	, "config/checked-javascript.json", "config/cli-package.v1.json"
	, "docs/architecture/binding-ir.md", "docs/consume/perl.md"
	, "docs/contributing/testing.md", "docs/lean/export-decisions.md"
	, "docs/publish/cpan.md", "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json", "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/perl/Build.pm", "src/backends/perl/Runtime.pm"
	, "src/backends/perl/Runtime.xs"
	, "src/build/cpan-projection.mjs", "src/build/elaborated-component.mjs"
	, "src/build/native-project.mjs", "src/build/owned-native-model.mjs"
	, "src/release/cpan-package.mjs", "tests/documentation.test.mjs"
	, "tests/helpers/jvm-probe-repair-history.mjs"
	, "tests/helpers/owned-jvm-source-history.mjs"
	, "tests/owned-c-packaging.test.mjs"
	, "tests/owned-jvm-package-evidence.test.mjs"
].sort();
export const ownedPerlNormalizationPaths = [...new Set([...ownedPerlChangedPaths, ...perlContractRepairChangedPaths])].sort();
export const ownedPerlAddedPaths = [
	"docs/evidence/owned-perl-packages-20260927.md"
	, "docs/evidence/owned-perl-runtime-20260927.md"
	, "src/backends/perl/OwnedAssets.pm"
	, "src/backends/perl/owned-conversions.mjs"
	, "src/backends/perl/owned-package.mjs"
	, "src/backends/perl/owned-runtime.mjs"
	, "src/backends/perl/owned-values.mjs"
	, "src/backends/perl/owned-xs.mjs"
	, "src/build/owned-perl-artifacts.mjs"
	, "src/build/owned-perl-projection.mjs"
	, "tests/fixtures/structured-types/owned-perl-assets.pl"
	, "tests/fixtures/structured-types/owned-perl-calls.pl"
	, "tests/fixtures/structured-types/owned-perl-coexistence.pl"
	, "tests/fixtures/structured-types/owned-perl-conversions.pl"
	, "tests/fixtures/structured-types/owned-perl-installed-assets.pl"
	, "tests/fixtures/structured-types/owned-perl-installed-scalars.pl"
	, "tests/fixtures/structured-types/owned-perl-loader.pl"
	, "tests/fixtures/structured-types/owned-perl-runtime.pl"
	, "tests/fixtures/structured-types/owned-perl-runtime.xs"
	, "tests/fixtures/structured-types/owned-perl-scalars.pl"
	, "tests/fixtures/structured-types/owned-perl-signatures.pl"
	, "tests/helpers/owned-perl-coexistence.mjs"
	, "tests/helpers/owned-perl-conversion-probe.mjs"
	, "tests/helpers/owned-perl-installed-assets.mjs"
	, "tests/helpers/owned-perl-native.mjs"
	, "tests/helpers/owned-perl-package-evidence.mjs"
	, "tests/helpers/owned-perl-source-history.mjs"
	, "tests/owned-perl-coexistence.test.mjs"
	, "tests/owned-perl-conversions.test.mjs"
	, "tests/owned-perl-documentation.test.mjs"
	, "tests/owned-perl-loader.test.mjs"
	, "tests/owned-perl-package-evidence.test.mjs"
	, "tests/owned-perl-package.test.mjs"
	, "tests/owned-perl-runtime.test.mjs"
	, "tests/owned-perl-scalars.test.mjs"
	, "tests/owned-perl-values.test.mjs"
	, "tests/owned-perl-xs.test.mjs"
];
let cached;

/**
 * Reverse exact literal changes only after authenticating both whole files.
 *
 * @param source - Complete current source text.
 * @param update - Recorded predecessor/current identities and literal edits.
 */
export const reverseOwnedPerlUpdate = (source, update) => {
	assert.ok(ownedPerlChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	const pieces = []; let end = 0;
	for(const { start, current, previous } of update.edits)
	{
		assert.ok(Number.isSafeInteger(start) && start >= end);
		assert.equal(typeof current, "string"); assert.equal(typeof previous, "string");
		assert.notEqual(current, previous);
		assert.equal(source.slice(start, start + current.length), current, update.path);
		pieces.push(source.slice(end, start), previous); end = start + current.length;
	}
	pieces.push(source.slice(end));
	const restored = pieces.join("");
	assert.equal(sha256(restored), update.previousSha256, update.path);
	return restored;
};

/**
 * Restore a known predecessor and leave every unknown edit visible.
 *
 * @param path - Exact repository-relative path.
 * @param source - Complete current or historical text.
 * @param expected - Optional requested identity at which to stop.
 */
export const beforeOwnedPerlPackages = (path, source, expected) => {
	source = beforePerlContractRepair(path, source, expected);
	const digest = sha256(source);
	if(digest === expected || !ownedPerlChangedPaths.includes(path)) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedPerlHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.kind, "owned-perl-package-integration");
	assert.equal(record.baselineRevision, ownedPerlBaseline);
	assert.deepEqual(record.updates.map(item => item.path).sort(), ownedPerlChangedPaths);
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseOwnedPerlUpdate(source, update) : source;
};

/**
 * Normalize declared text paths only, preserving unrelated binary bytes.
 *
 * @param path - Exact repository-relative path.
 * @param bytes - Complete current or historical file bytes.
 * @param expected - Optional requested identity.
 */
export const ownedPerlHistoricalBytes = (path, bytes, expected) => ownedPerlNormalizationPaths.includes(path)
	? beforeOwnedPerlPackages(path, bytes.toString("utf8"), expected) : bytes;
