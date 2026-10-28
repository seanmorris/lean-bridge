#!/usr/bin/env node
/**
 * Record the exact signature-completion promotion test-pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	signatureSpecializationCompletionPinRepairAddedPaths
	, signatureSpecializationCompletionPinRepairChangedPaths
	, signatureSpecializationCompletionPinRepairHistoryPath
	, signatureSpecializationCompletionPinRepairImplementation
	, signatureSpecializationCompletionPinRepairPin
	, signatureSpecializationCompletionPinRepairPredecessor
} from "../tests/helpers/signature-specialization-completion-pin-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = signatureSpecializationCompletionPinRepairPredecessor;
const implementation = signatureSpecializationCompletionPinRepairImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Signature completion pin repair history requires its exact implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...signatureSpecializationCompletionPinRepairChangedPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${signatureSpecializationCompletionPinRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []);
assert.deepEqual(names([
	"ls-files", "--others", "--exclude-standard", "--"
	, ...signatureSpecializationCompletionPinRepairAddedPaths
]), [...signatureSpecializationCompletionPinRepairAddedPaths].sort());

const updates = [];
for(const path of signatureSpecializationCompletionPinRepairChangedPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 16 * 1024 * 1024 }));
assert.equal(updates[0].edits.length, 1);
assert.ok(updates[0].edits[0].previous.includes(
	signatureSpecializationCompletionPinRepairPin.previousSha256));
assert.ok(updates[0].edits[0].current.includes(
	signatureSpecializationCompletionPinRepairPin.currentSha256));
const additions = [];
for(const path of signatureSpecializationCompletionPinRepairAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(signatureSpecializationCompletionPinRepairHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "signature-specialization-completion-pin-repair-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Refresh exactly one live pin for the final sparse-safe promotion regression after its implementation changed. Preserve every support cell, observation, evidence identity and unrelated inventory byte."
		, pin: signatureSpecializationCompletionPinRepairPin
		, additions, updates
	}), { flag: "wx" });
process.stdout.write("Recorded one signature-completion pin repair and "
	+ `${additions.length} additions.\n`);
