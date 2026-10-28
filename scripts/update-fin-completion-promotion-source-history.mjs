#!/usr/bin/env node
/**
 * Record the exact final Fin field/callback promotion source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	finCompletionPromotionHistoryPath
	, finCompletionPromotionImplementation
	, finCompletionPromotionImplementationPaths
	, finCompletionPromotionIntegrationAddedPaths
	, finCompletionPromotionIntegrationPaths
	, finCompletionPromotionPredecessor
} from "../tests/helpers/fin-completion-promotion-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 256 * 1024 ** 2 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const integration = git(["rev-parse", "HEAD"]).trim();
assert.equal(git(["rev-parse"
	, `${finCompletionPromotionImplementation}^`]).trim()
, finCompletionPromotionPredecessor);
assert.equal(git(["rev-parse", `${integration}^`]).trim()
	, finCompletionPromotionImplementation);
assert.deepEqual(names(["diff", "--name-only"
	, finCompletionPromotionPredecessor
	, finCompletionPromotionImplementation])
, [...finCompletionPromotionImplementationPaths]);
assert.deepEqual(names(["diff", "--name-only"
	, finCompletionPromotionImplementation, integration]), [
	...finCompletionPromotionIntegrationAddedPaths
	, ...finCompletionPromotionIntegrationPaths
	].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, finCompletionPromotionHistoryPath]).trim(), "");
assert.equal(git(["status", "--short"]).trim(), "");

const updates = [];
for(const path of finCompletionPromotionImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, finCompletionPromotionPredecessor
		, finCompletionPromotionImplementation));
const integrationUpdates = [];
for(const path of finCompletionPromotionIntegrationPaths)
	integrationUpdates.push(await gitSourceHistoryTransition(path
		, finCompletionPromotionImplementation, integration));
const additions = finCompletionPromotionIntegrationAddedPaths.map(path => ({
	path, currentSha256: sha256(git(["show", `${integration}:${path}`]))
}));
await writeFile(finCompletionPromotionHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "fin-completion-promotion-source-v1"
	, predecessorCommit: finCompletionPromotionPredecessor
	, implementationCommit: finCompletionPromotionImplementation
	, integrationCommit: integration
	, scope: "Promote four independently replayed hosted archives through seven observations and exactly the final 50 copied-field and callback Fin cells. Preserve every earlier evidence and observation byte, reject any inventory whose missing Fin scope differs, and retain exact producer, checker, artifact and validator identities. Register the inventory transition in the reversible Fin source-history chain without changing runtime, compiler or package source."
	, additions, updates, integrationUpdates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} implementation and `
	+ `${integrationUpdates.length} integration updates.\n`);
