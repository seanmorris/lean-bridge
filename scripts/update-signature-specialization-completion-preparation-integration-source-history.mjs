#!/usr/bin/env node
/**
 * Record the central integration of signature-completion preparation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	signatureSpecializationCompletionPreparationIntegrationAddedPaths
	, signatureSpecializationCompletionPreparationIntegrationChangedPaths
	, signatureSpecializationCompletionPreparationIntegrationHistoryPath
	, signatureSpecializationCompletionPreparationIntegrationImplementation
	, signatureSpecializationCompletionPreparationIntegrationPredecessor
} from "../tests/helpers/signature-specialization-completion-preparation-integration-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor
	= signatureSpecializationCompletionPreparationIntegrationPredecessor;
const implementation
	= signatureSpecializationCompletionPreparationIntegrationImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Signature completion integration history requires its exact implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...signatureSpecializationCompletionPreparationIntegrationChangedPaths]
		.sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${signatureSpecializationCompletionPreparationIntegrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []);
assert.deepEqual(names([
	"ls-files", "--others", "--exclude-standard", "--"
	, ...signatureSpecializationCompletionPreparationIntegrationAddedPaths
]), [...signatureSpecializationCompletionPreparationIntegrationAddedPaths]
	.sort());

const updates = [];
for(const path of
	signatureSpecializationCompletionPreparationIntegrationChangedPaths)
	updates.push(await gitSourceHistoryTransition(
		path, predecessor, implementation));
const additions = [];
const addedPaths
	= signatureSpecializationCompletionPreparationIntegrationAddedPaths;
for(const path of addedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(
	signatureSpecializationCompletionPreparationIntegrationHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "signature-specialization-completion-preparation-integration-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Integrate the authenticated terminal-green hosted-signature completion preparation into the central Fin history and partition newest-first. Preserve exact source reconstruction before generating or promoting the immutable evidence archive."
		, additions, updates
	}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} integration updates and `
	+ `${additions.length} additions.\n`);
