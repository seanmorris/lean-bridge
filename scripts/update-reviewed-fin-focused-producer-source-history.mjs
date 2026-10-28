#!/usr/bin/env node
/**
 * Record the focused reviewed-Fin producer source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	reviewedFinFocusedProducerAddedPaths
	, reviewedFinFocusedProducerHistoryPath
	, reviewedFinFocusedProducerImplementation
	, reviewedFinFocusedProducerImplementationAddedPaths
	, reviewedFinFocusedProducerImplementationPaths
	, reviewedFinFocusedProducerIntegrationAddedPaths
	, reviewedFinFocusedProducerIntegrationPaths
	, reviewedFinFocusedProducerPredecessor
	, reviewedFinFocusedProducerTrigger
	, reviewedFinFocusedProducerTriggerPaths
} from "../tests/helpers/reviewed-fin-focused-producer-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 64 * 1024 ** 2 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const integration = git(["rev-parse", "HEAD"]).trim();
assert.equal(git(["rev-parse"
	, `${reviewedFinFocusedProducerImplementation}^`]).trim()
, reviewedFinFocusedProducerPredecessor);
assert.equal(git(["rev-parse", `${reviewedFinFocusedProducerTrigger}^`]).trim()
	, reviewedFinFocusedProducerImplementation);
assert.equal(git(["rev-parse", `${integration}^`]).trim()
	, reviewedFinFocusedProducerTrigger);
assert.deepEqual(names(["diff", "--name-only"
	, reviewedFinFocusedProducerPredecessor
	, reviewedFinFocusedProducerImplementation]), [
	...reviewedFinFocusedProducerImplementationAddedPaths
	, ...reviewedFinFocusedProducerImplementationPaths
	].sort());
assert.deepEqual(names(["diff", "--name-only"
	, reviewedFinFocusedProducerImplementation, reviewedFinFocusedProducerTrigger])
, [...reviewedFinFocusedProducerTriggerPaths]);
assert.deepEqual(names(["diff", "--name-only"
	, reviewedFinFocusedProducerTrigger, integration]), [
	...reviewedFinFocusedProducerIntegrationAddedPaths
	, ...reviewedFinFocusedProducerIntegrationPaths
	].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, reviewedFinFocusedProducerHistoryPath]).trim(), "");
assert.equal(git(["status", "--short"]).trim(), "");

const updates = [];
for(const path of reviewedFinFocusedProducerImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, reviewedFinFocusedProducerPredecessor
		, reviewedFinFocusedProducerImplementation));
const triggerUpdates = [];
for(const path of reviewedFinFocusedProducerTriggerPaths)
	triggerUpdates.push(await gitSourceHistoryTransition(path
		, reviewedFinFocusedProducerImplementation
		, reviewedFinFocusedProducerTrigger));
const integrationUpdates = [];
for(const path of reviewedFinFocusedProducerIntegrationPaths)
	integrationUpdates.push(await gitSourceHistoryTransition(path
		, reviewedFinFocusedProducerTrigger, integration));
const additions = reviewedFinFocusedProducerAddedPaths.map(path => ({
	path, currentSha256: sha256(git(["show", `${integration}:${path}`]))
}));
await writeFile(reviewedFinFocusedProducerHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "reviewed-fin-focused-producer-source-v1"
	, predecessorCommit: reviewedFinFocusedProducerPredecessor
	, implementationCommit: reviewedFinFocusedProducerImplementation
	, triggerCommit: reviewedFinFocusedProducerTrigger
	, integrationCommit: integration
	, scope: "Repair the structural TypeScript prelude oracle to include its existing api.box call. Add a focused hosted producer that builds the locked engine/runtime and installs browsers once, executes original and probe modes independently, preserves both artifacts even after one mode fails, and is guarded by the repository's reviewed trigger budget. Retarget the field archiver to that exact producer while retaining terminal run and successful selected-job requirements. Preserve product contracts and type-surface claims until hosted evidence is green."
	, additions, updates, triggerUpdates, integrationUpdates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} implementation, `
	+ `${triggerUpdates.length} trigger and `
	+ `${integrationUpdates.length} integration updates.\n`);
