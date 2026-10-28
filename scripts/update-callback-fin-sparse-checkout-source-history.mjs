#!/usr/bin/env node
/**
 * Record the sparse callback-Fin checkout and exact pin transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	callbackFinSparseCheckoutAddedPaths
	, callbackFinSparseCheckoutHistoryPath
	, callbackFinSparseCheckoutImplementation
	, callbackFinSparseCheckoutImplementationPaths
	, callbackFinSparseCheckoutIntegrationPaths
	, callbackFinSparseCheckoutPinPaths
	, callbackFinSparseCheckoutPinRepair
	, callbackFinSparseCheckoutPredecessor
} from "../tests/helpers/callback-fin-sparse-checkout-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();
const integration = git(["rev-parse", "HEAD"]).trim();
assert.equal(git(["rev-parse", `${callbackFinSparseCheckoutImplementation}^`]).trim()
	, callbackFinSparseCheckoutPredecessor);
assert.equal(git(["rev-parse", `${callbackFinSparseCheckoutPinRepair}^`]).trim()
	, callbackFinSparseCheckoutImplementation);
assert.equal(git(["rev-parse", `${integration}^`]).trim()
	, callbackFinSparseCheckoutPinRepair);
assert.deepEqual(names(["diff", "--name-only"
	, callbackFinSparseCheckoutPredecessor
	, callbackFinSparseCheckoutImplementation])
, [...callbackFinSparseCheckoutImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only"
	, callbackFinSparseCheckoutImplementation
	, callbackFinSparseCheckoutPinRepair])
, [...callbackFinSparseCheckoutPinPaths]);
assert.deepEqual(names(["diff", "--name-only"
	, callbackFinSparseCheckoutPinRepair, integration])
, [...callbackFinSparseCheckoutAddedPaths
	, ...callbackFinSparseCheckoutIntegrationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackFinSparseCheckoutHistoryPath]).trim(), "");
assert.equal(git(["status", "--short"]).trim(), "");

const updates = [];
for(const path of callbackFinSparseCheckoutImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, callbackFinSparseCheckoutPredecessor
		, callbackFinSparseCheckoutImplementation));
const pinUpdates = [];
for(const path of callbackFinSparseCheckoutPinPaths)
	pinUpdates.push(await gitSourceHistoryTransition(path
		, callbackFinSparseCheckoutImplementation
		, callbackFinSparseCheckoutPinRepair));
const integrationUpdates = [];
for(const path of callbackFinSparseCheckoutIntegrationPaths)
	integrationUpdates.push(await gitSourceHistoryTransition(path
		, callbackFinSparseCheckoutPinRepair, integration));
const additions = callbackFinSparseCheckoutAddedPaths.map(path => ({
	path, currentSha256: sha256(git(["show", `${integration}:${path}`]))
}));
await writeFile(callbackFinSparseCheckoutHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "callback-fin-sparse-checkout-source-v1"
	, predecessorCommit: callbackFinSparseCheckoutPredecessor
	, implementationCommit: callbackFinSparseCheckoutImplementation
	, pinRepairCommit: callbackFinSparseCheckoutPinRepair
	, integrationCommit: integration
	, scope: "Materialize the complete executable repository while excluding the 41+ GiB immutable docs/evidence corpus and the publication-only type-surface inventory from four callback acceptance checkouts. Retain the current commit, all source, fixtures, scripts and consumer-support contract. Refresh the one live source pin affected by this transition; change no type-surface claim, observation, evidence inventory or runtime contract."
	, livePinRefreshes: 1
	, additions, updates, pinUpdates, integrationUpdates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} workflow, ${pinUpdates.length} pin and ${integrationUpdates.length} integration updates.\n`);
