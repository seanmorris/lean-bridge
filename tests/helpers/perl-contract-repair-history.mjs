/**
 * Preserve frozen package evidence across the post-Perl contract corrections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const perlContractRepairBaseline = "20d95044ae6f1dcf2d156cd8043126a16bbd1b4e";
export const perlContractRepairPath = "docs/evidence/perl-contract-repair-20260928.json";
export const perlContractRepairPrevious = Object.freeze({
	path: "docs/evidence/owned-perl-integration-20260928.json"
	, sha256: "a05b1678b37823a6fa9ab2956055969a26948cc2643706e08b2b7191d6d05f17"
});
export const perlContractRepairChangedPaths = [
	"docs/type-surface.v1.json", "src/adoption/test-profiles.mjs"
	, "tests/dotnet-recursive-callable-evidence.test.mjs"
	, "tests/helpers/jvm-probe-repair-history.mjs"
	, "tests/helpers/owned-jvm-source-history.mjs"
	, "tests/helpers/owned-perl-source-history.mjs"
	, "tests/owned-dotnet-callback-evidence.test.mjs"
	, "tests/owned-perl-package-evidence.test.mjs"
].sort();
export const perlContractRepairAddedPaths = [
	"docs/evidence/perl-contract-repair-20260928.md"
	, "tests/helpers/perl-contract-repair-history.mjs"
	, "tests/perl-contract-repair-evidence.test.mjs"
].sort();
let cached;

/**
 * Reverse only declared literal edits with exact current and predecessor hashes.
 *
 * @param source - Complete current source text.
 * @param update - Explicit repository path, whole-file hashes and ordered edits.
 */
export const reversePerlContractRepair = (source, update) => {
	assert.ok(perlContractRepairChangedPaths.includes(update.path), update.path);
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
	pieces.push(source.slice(end)); const restored = pieces.join("");
	assert.equal(sha256(restored), update.previousSha256, update.path);
	return restored;
};

/**
 * Restore known successor text, while preserving every unrecorded edit.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact identity at which normalization stops.
 */
export const beforePerlContractRepair = (path, source, expected) => {
	const digest = sha256(source);
	if(digest === expected || !perlContractRepairChangedPaths.includes(path)) return source;
	const record = cached ??= JSON.parse(readFileSync(perlContractRepairPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.kind, "post-perl-contract-repair");
	assert.equal(record.baselineRevision, perlContractRepairBaseline);
	assert.deepEqual(record.previous, perlContractRepairPrevious);
	assert.deepEqual(record.updates.map(item => item.path).sort(), perlContractRepairChangedPaths);
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reversePerlContractRepair(source, update) : source;
};

/**
 * Normalize only the declared text paths; unrelated binary data stays untouched.
 *
 * @param path - Repository-relative source path.
 * @param bytes - Complete current or historical bytes.
 * @param expected - Optional requested historical identity.
 */
export const perlContractRepairBytes = (path, bytes, expected) => perlContractRepairChangedPaths.includes(path)
	? beforePerlContractRepair(path, bytes.toString("utf8"), expected) : bytes;
