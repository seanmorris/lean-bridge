#!/usr/bin/env node
/**
 * Record the central signature-completion promotion integration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	signatureSpecializationCompletionPromotionIntegrationAddedPaths
	, signatureSpecializationCompletionPromotionIntegrationChangedPaths
	, signatureSpecializationCompletionPromotionIntegrationHistoryPath
	, signatureSpecializationCompletionPromotionIntegrationImplementation
	, signatureSpecializationCompletionPromotionIntegrationPredecessor
} from "../tests/helpers/signature-specialization-completion-promotion-integration-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor
	= signatureSpecializationCompletionPromotionIntegrationPredecessor;
const implementation
	= signatureSpecializationCompletionPromotionIntegrationImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Signature completion promotion integration requires its exact implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...signatureSpecializationCompletionPromotionIntegrationChangedPaths]
		.sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${signatureSpecializationCompletionPromotionIntegrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []);
assert.deepEqual(names([
	"ls-files", "--others", "--exclude-standard", "--"
	, ...signatureSpecializationCompletionPromotionIntegrationAddedPaths
]), [...signatureSpecializationCompletionPromotionIntegrationAddedPaths]
	.sort());

const updates = [];
for(const path of
	signatureSpecializationCompletionPromotionIntegrationChangedPaths)
	updates.push(await gitSourceHistoryTransition(
		path, predecessor, implementation));
const additions = [];
const addedPaths
	= signatureSpecializationCompletionPromotionIntegrationAddedPaths;
for(const path of addedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(
	signatureSpecializationCompletionPromotionIntegrationHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "signature-specialization-completion-promotion-integration-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Integrate the authenticated exact 45-cell signature promotion into the central Fin history and partition newest-first, including its own pending integration ledger."
		, additions, updates
	}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} integration updates and `
	+ `${additions.length} additions.\n`);
