/**
 * Authenticate exact predecessor sources across Perl receiver support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedPerlReceiverPath = "docs/evidence/owned-perl-receivers-20261001.json";
export const ownedPerlReceiverBaseline = "2e9e748fc0354bfa309c2283de66ff8a917df349";
export const ownedPerlReceiverPrevious = Object.freeze({
	path: "docs/evidence/owned-jvm-receivers-20261001.json"
	, sha256: "88c9051e92bc37cd809e46b9617b60e9ab8fd3d50e5557b7f9eb4abd4eb4845b"
});
export const ownedPerlReceiverChangedPaths = [
	".github/workflows/perl-consumer.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/consume/perl.md"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/c.md"
	, "docs/publish/cpan.md"
	, "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/perl/Build.pm"
	, "src/backends/perl/owned-borrows.mjs"
	, "src/backends/perl/owned-conversions.mjs"
	, "src/backends/perl/owned-package.mjs"
	, "src/backends/perl/owned-runtime.mjs"
	, "src/backends/perl/owned-values.mjs"
	, "src/backends/perl/owned-xs.mjs"
	, "src/build/native-project.mjs"
	, "src/build/owned-perl-projection.mjs"
	, "src/release/cpan-package.mjs"
	, "src/release/owned-cpan-contract.mjs"
	, "tests/helpers/owned-dotnet-receiver-history.mjs"
	, "tests/helpers/owned-jvm-receiver-history.mjs"
	, "tests/helpers/owned-jvm-receiver-package-evidence.mjs"
	, "tests/helpers/owned-perl-borrow-evidence.mjs"
	, "tests/helpers/owned-perl-native.mjs"
	, "tests/owned-jvm-receiver-evidence.test.mjs"
].sort();
export const ownedPerlReceiverAddedPaths = [
	"docs/evidence/owned-perl-receivers-20261001.md"
	, "src/backends/perl/owned-receivers.mjs"
	, "tests/fixtures/structured-types/owned-perl-receivers.pl"
	, "tests/helpers/owned-perl-receiver-ci.mjs"
	, "tests/helpers/owned-perl-receiver-evidence.mjs"
	, "tests/helpers/owned-perl-receiver-fixture.mjs"
	, "tests/helpers/owned-perl-receiver-history.mjs"
	, "tests/helpers/owned-perl-receiver-installed.mjs"
	, "tests/helpers/owned-perl-receiver-package-evidence.mjs"
	, "tests/owned-perl-receiver-ci.test.mjs"
	, "tests/owned-perl-receiver-contract.test.mjs"
	, "tests/owned-perl-receiver-core.test.mjs"
	, "tests/owned-perl-receiver-documentation.test.mjs"
	, "tests/owned-perl-receiver-evidence.test.mjs"
	, "tests/owned-perl-receiver-packaging.test.mjs"
	, "tests/owned-perl-receiver-plain.test.mjs"
	, "tests/owned-perl-receiver-resource-packaging.test.mjs"
	, "tests/owned-perl-receiver-unanchored.test.mjs"
].sort();
let cached;

/**
 * Reverse registered edit spans after checking both complete source identities.
 *
 * @param source - Complete current text.
 * @param update - Authenticated path, identities and replacement spans.
 */
export const reverseOwnedPerlReceiverUpdate = (source, update) => {
	assert.ok(ownedPerlReceiverChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let end = 0; const parts = [];
	for(const { start, current, previous } of update.edits)
	{
		assert.ok(Number.isSafeInteger(start) && start >= end);
		assert.equal(typeof current, "string"); assert.equal(typeof previous, "string");
		assert.notEqual(current, previous);
		assert.equal(source.slice(start, start + current.length), current, update.path);
		parts.push(source.slice(end, start), previous); end = start + current.length;
	}
	parts.push(source.slice(end)); const restored = parts.join("");
	assert.equal(sha256(restored), update.previousSha256, update.path); return restored;
};

/**
 * Stop at requested identities and never conceal unrecorded changes.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional stopping identity.
 */
export const beforeOwnedPerlReceiver = (path, source, expected) => {
	if(!ownedPerlReceiverChangedPaths.includes(path) || sha256(source) === expected) return source;
	if(!cached)
	{
		cached = JSON.parse(readFileSync(ownedPerlReceiverPath, "utf8"));
		if(cached.acceptance === "pending")
		{
			assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), ownedPerlReceiverBaseline);
			assert.equal(execFileSync("git", ["ls-files", "--", ownedPerlReceiverPath], { encoding: "utf8" }), "");
		}
		else assert.equal(cached.acceptance, "passed");
	}
	assert.equal(cached.schemaVersion, 1); assert.equal(cached.kind, "owned-perl-receivers");
	assert.equal(cached.baselineRevision, ownedPerlReceiverBaseline);
	assert.deepEqual(cached.previous, ownedPerlReceiverPrevious);
	assert.deepEqual(cached.updates.map(update => update.path), ownedPerlReceiverChangedPaths);
	const update = cached.updates.find(update => update.path === path);
	return update.currentSha256 === sha256(source) ? reverseOwnedPerlReceiverUpdate(source, update) : source;
};

/**
 * Preserve binary inputs and decode only the registered text paths.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional stopping identity.
 */
export const ownedPerlReceiverHistoricalBytes = (path, bytes, expected) => ownedPerlReceiverChangedPaths.includes(path)
	? beforeOwnedPerlReceiver(path, bytes.toString("utf8"), expected) : bytes;
