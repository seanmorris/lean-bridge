#!/usr/bin/env node
/**
 * Record the hosted-signature type-surface promotion transaction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	signatureSpecializationCompletionPromotionAddedPaths
	, signatureSpecializationCompletionPromotionChangedPaths
	, signatureSpecializationCompletionPromotionCommits
	, signatureSpecializationCompletionPromotionHistoryPath
	, signatureSpecializationCompletionPromotionImplementation
	, signatureSpecializationCompletionPromotionPredecessor
} from "../tests/helpers/signature-specialization-completion-promotion-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = signatureSpecializationCompletionPromotionPredecessor;
const implementation = signatureSpecializationCompletionPromotionImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Signature completion promotion history requires its exact implementation commit");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, signatureSpecializationCompletionPromotionCommits);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...signatureSpecializationCompletionPromotionChangedPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${signatureSpecializationCompletionPromotionHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []);
assert.deepEqual(names([
	"ls-files", "--others", "--exclude-standard", "--"
	, ...signatureSpecializationCompletionPromotionAddedPaths
]), [...signatureSpecializationCompletionPromotionAddedPaths].sort());

const updates = [];
for(const path of signatureSpecializationCompletionPromotionChangedPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 16 * 1024 * 1024 }));
const additions = [];
for(const path of signatureSpecializationCompletionPromotionAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(signatureSpecializationCompletionPromotionHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "signature-specialization-completion-promotion-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, implementationCommits: signatureSpecializationCompletionPromotionCommits
		, scope: "Reconcile exactly eleven overlapping legacy generic-signature owners without changing their unrelated shapes, then bind one fully replayed ten-lane installed archive through five observations and exactly 45 signature cells. Reconcile 102 live source pins and preserve every unrelated cell, evidence entry and observation."
		, additions, updates
	}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} promotion updates and `
	+ `${additions.length} additions.\n`);
