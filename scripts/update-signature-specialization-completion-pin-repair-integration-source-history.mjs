#!/usr/bin/env node
/**
 * Record the central signature-completion pin-repair integration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	signatureSpecializationCompletionPinRepairIntegrationAddedPaths
	, signatureSpecializationCompletionPinRepairIntegrationChangedPaths
	, signatureSpecializationCompletionPinRepairIntegrationHistoryPath
	, signatureSpecializationCompletionPinRepairIntegrationImplementation
	, signatureSpecializationCompletionPinRepairIntegrationPredecessor
} from "../tests/helpers/signature-specialization-completion-pin-repair-integration-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor
	= signatureSpecializationCompletionPinRepairIntegrationPredecessor;
const implementation
	= signatureSpecializationCompletionPinRepairIntegrationImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Signature completion pin integration requires its exact implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...signatureSpecializationCompletionPinRepairIntegrationChangedPaths]
		.sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${signatureSpecializationCompletionPinRepairIntegrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []);
assert.deepEqual(names([
	"ls-files", "--others", "--exclude-standard", "--"
	, ...signatureSpecializationCompletionPinRepairIntegrationAddedPaths
]), [...signatureSpecializationCompletionPinRepairIntegrationAddedPaths]
	.sort());

const updates = [];
for(const path of
	signatureSpecializationCompletionPinRepairIntegrationChangedPaths)
	updates.push(await gitSourceHistoryTransition(
		path, predecessor, implementation));
const additions = [];
for(const path of signatureSpecializationCompletionPinRepairIntegrationAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(
	signatureSpecializationCompletionPinRepairIntegrationHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "signature-specialization-completion-pin-repair-integration-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Integrate the claim-neutral one-pin completion repair into the central Fin history and partition newest-first, including its pending integration ledger."
		, additions, updates
	}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} integration updates and `
	+ `${additions.length} additions.\n`);
