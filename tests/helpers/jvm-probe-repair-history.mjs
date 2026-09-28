/**
 * Preserve published evidence across the recursive JVM probe's loader repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedPerlPackages, ownedPerlNormalizationPaths } from "./owned-perl-source-history.mjs";

export const jvmProbeRepairBaseline = "578f04d09320e6998959390a3a0218ac6fd66d02";
export const jvmProbeRepairPath = "docs/evidence/jvm-recursive-probe-repair-20260927.json";
export const jvmProbeRepairChangedPaths = [
	"docs/type-surface.v1.json"
	, "tests/helpers/jvm-recursive-callable-probes.mjs"
	, "tests/helpers/managed-ci-isolation-history.mjs"
	, "tests/helpers/owned-jvm-package-evidence.mjs"
	, "tests/helpers/owned-jvm-source-history.mjs"
	, "tests/owned-jvm-package-evidence.test.mjs"
];
let cached;

/**
 * Restore only a recorded complete source identity, leaving unknown edits intact.
 *
 * @param path - Repository-relative source path.
 * @param source - Current or already historical source text.
 * @param expected - Optional identity at which normalization must stop.
 */
export const beforeJvmProbeRepair = (path, source, expected) => {
	source = beforeOwnedPerlPackages(path, source, expected);
	const digest = sha256(source);
	if(digest === expected || !jvmProbeRepairChangedPaths.includes(path)) return source;
	const record = cached ??= JSON.parse(readFileSync(jvmProbeRepairPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	if(update?.currentSha256 !== digest) return source;
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.baselineRevision, jvmProbeRepairBaseline);
	assert.deepEqual(record.updates.map(item => item.path).sort(), jvmProbeRepairChangedPaths);
	const pieces = []; let end = 0;
	for(const { start, current, previous } of update.edits)
	{
		assert.ok(Number.isSafeInteger(start) && start >= end);
		assert.equal(typeof current, "string"); assert.equal(typeof previous, "string");
		assert.notEqual(current, previous);
		assert.equal(source.slice(start, start + current.length), current, path);
		pieces.push(source.slice(end, start), previous); end = start + current.length;
	}
	pieces.push(source.slice(end));
	const restored = pieces.join("");
	assert.equal(sha256(restored), update.previousSha256, path);
	return restored;
};

/**
 * Decode only declared text paths; leave all other bytes unchanged.
 *
 * @param path - Repository-relative source path.
 * @param bytes - Complete current or historical file bytes.
 * @param expected - Optional stopping identity.
 */
export const jvmProbeRepairBytes = (path, bytes, expected) => jvmProbeRepairChangedPaths.includes(path) || ownedPerlNormalizationPaths.includes(path)
	? beforeJvmProbeRepair(path, bytes.toString("utf8"), expected) : bytes;
