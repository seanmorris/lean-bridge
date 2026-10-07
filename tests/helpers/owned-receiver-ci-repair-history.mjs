/**
 * Preserve frozen receiver receipts across CI tooling and documentation checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedPhpWasmReceiver, ownedPhpWasmReceiverNormalizationPaths } from "./owned-php-wasm-receiver-history.mjs";

export const ownedReceiverCiRepairPath = "docs/evidence/owned-receiver-ci-repair-20261001.json";
export const ownedReceiverCiRepairBaseline = "16fadc8add3769e83852c51d6ad89e6dedfb6c06";
export const ownedReceiverCiRepairPrevious = Object.freeze({
	path: "docs/evidence/owned-php-receivers-20261001.json"
	, sha256: "d21f7a35e62828b9d90b603f1733d57730ff63530a744080ae5043842b6ea259"
});
export const ownedReceiverCiRepairChangedPaths = [
	".github/workflows/perl-consumer.yml"
	, "docs/type-surface.v1.json"
	, "tests/documentation.test.mjs"
	, "tests/helpers/owned-perl-receiver-ci.mjs"
	, "tests/helpers/owned-perl-receiver-history.mjs"
	, "tests/helpers/owned-php-receiver-history.mjs"
	, "tests/owned-perl-receiver-ci.test.mjs"
	, "tests/owned-php-receiver-evidence.test.mjs"
].sort();
export const ownedReceiverCiRepairAddedPaths = [
	"docs/evidence/owned-receiver-ci-repair-20261001.md"
	, "tests/helpers/owned-receiver-ci-repair-history.mjs"
].sort();
let cached;
export const ownedReceiverCiRepairNormalizationPaths = [...new Set([...ownedReceiverCiRepairChangedPaths, ...ownedPhpWasmReceiverNormalizationPaths])].sort();

/**
 * Check complete identities before reversing registered edit spans.
 *
 * @param source - Complete current source.
 * @param update - Authenticated current and previous hashes and exact edits.
 */
export const reverseOwnedReceiverCiRepair = (source, update) => {
	assert.ok(ownedReceiverCiRepairChangedPaths.includes(update.path), update.path);
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
	parts.push(source.slice(end)); const prior = parts.join("");
	assert.equal(sha256(prior), update.previousSha256, update.path); return prior;
};

/**
 * Leave unknown changes visible and stop at the requested historical digest.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeOwnedReceiverCiRepair = (path, source, expected) => {
	source = beforeOwnedPhpWasmReceiver(path, source, expected);
	if(!ownedReceiverCiRepairChangedPaths.includes(path) || sha256(source) === expected) return source;
	const record = cached ??= JSON.parse(readFileSync(ownedReceiverCiRepairPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-receiver-ci-repair");
	assert.equal(record.baselineRevision, ownedReceiverCiRepairBaseline);
	assert.deepEqual(record.previous, ownedReceiverCiRepairPrevious);
	assert.deepEqual(record.updates.map(update => update.path), ownedReceiverCiRepairChangedPaths);
	const update = record.updates.find(value => value.path === path);
	return sha256(source) === update.currentSha256 ? reverseOwnedReceiverCiRepair(source, update) : source;
};

/**
 * Decode registered text only and preserve unrelated binary sources.
 *
 * @param path - Repository-relative path.
 * @param bytes - Complete source bytes.
 * @param expected - Optional stopping digest.
 */
export const ownedReceiverCiRepairHistoricalBytes = (path, bytes, expected) => ownedReceiverCiRepairNormalizationPaths.includes(path)
	? beforeOwnedReceiverCiRepair(path, bytes.toString("utf8"), expected) : bytes;
