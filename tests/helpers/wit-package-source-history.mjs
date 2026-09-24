/**
 * Reconstruct complete pre-WIT-package sources without rewriting old receipts.
 * Installed execution and regression records are checked separately.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeWitHostIntegration } from "./wit-host-source-history.mjs";

export const witPackageHistoryPath = "docs/evidence/wit-recursive-package-integration-20260924.json";
export const witPackageChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/consume/wit-wasi.md"
	, "nix/perl-engine-source-boundary.json"
	, "package.json", "src/adoption/test-profiles.mjs"
	, "src/backends/wit/copied-graph-conversions.mjs"
	, "src/backends/wit/copied-graph-runtime.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-graph-projection.mjs", "src/build/native-project.mjs"
	, "src/build/native-wit-artifacts.mjs", "src/build/native-wit-projection.mjs"
	, "src/release/native-wasi.mjs", "tests/documentation.test.mjs"
	, "tests/dotnet-graph-package.test.mjs"
	, "tests/fixtures/recursive-consumers/wit-conversions.c"
	, "tests/helpers/current-collection-evidence.mjs"
	, "tests/helpers/current-php-graph-evidence.mjs"
	, "tests/helpers/dotnet-current-graph-evidence.mjs"
	, "tests/helpers/dotnet-installed-regressions.mjs"
	, "tests/helpers/jvm-shared-regression-receipt.mjs"
	, "tests/helpers/native-cargo-graph-regression.mjs"
	, "tests/helpers/native-dotnet-graph-regression.mjs"
	, "tests/helpers/native-graph-jvm-regression.mjs"
	, "tests/helpers/native-perl-graph-regression.mjs"
	, "tests/helpers/native-shared-admission.mjs"
	, "tests/helpers/native-shared-test-updates.mjs"
	, "tests/helpers/native-shared-verifier-updates.mjs"
	, "tests/helpers/php-installed-regressions.mjs"
	, "tests/helpers/recursive-acceptance-updates.mjs"
	, "tests/helpers/recursive-source-history.mjs"
	, "tests/helpers/source-inventory-order.mjs"
	, "tests/helpers/source-registration-flags.mjs"
	, "tests/helpers/source-registration-history.mjs"
	, "tests/helpers/test-registration-history.mjs"
	, "tests/helpers/wit-graph-source-lineage.mjs"
	, "tests/jvm-graph-package.test.mjs", "tests/native-shared-admission.test.mjs"
	, "tests/perl-graph-package.test.mjs", "tests/php-graph-package.test.mjs"
	, "tests/python-graph-package.test.mjs", "tests/ruby-graph-package.test.mjs"
	, "tests/rust-graph-package.test.mjs"
].sort();
let history;

/**
 * Reverse uniquely located complete hunks and verify both source identities.
 *
 * @param source - The entire current source, not an extracted fragment.
 * @param update - An explicitly recorded, reversible source change.
 */
export const reverseWitPackageUpdate = (source, update) => {
	assert.ok(witPackageChangedPaths.includes(update.path), "Not a WIT package integration path");
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	for(const { current, previous } of update.edits.toReversed())
	{
		assert.ok(typeof current === "string" && current.length > 0 && typeof previous === "string");
		assert.equal(source.split(current).length, 2, "Exactly one WIT package source hunk");
		source = source.replace(current, previous);
	}
	assert.equal(sha256(source), update.previousSha256, update.path);
	return source;
};

/**
 * Undo declared edits while retaining every unrelated byte for older checkers.
 * An unrecognized source is returned unchanged, never replaced with a snapshot.
 * Callers must still compare the complete result against their original digest.
 *
 * @param path - Exact file named in the integration record.
 * @param source - Complete current or historical source.
 * @param expected - Optional intermediate predecessor at which to stop.
 */
export const beforeWitPackageIntegration = (path, source, expected) => {
	source = beforeWitHostIntegration(path, source, expected);
	if(sha256(source) === expected || !witPackageChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(witPackageHistoryPath, "utf8"));
	for(const update of record.updates.filter(update => update.path === path).toReversed())
	{
		if(sha256(source) === expected) break;
		let previous = source, matched = true;
		for(const edit of update.edits.toReversed())
		{
			if(!edit.current || previous.split(edit.current).length !== 2)
			{ matched = false; break; }
			previous = previous.replace(edit.current, edit.previous);
		}
		if(matched) source = previous;
	}
	return source;
};
