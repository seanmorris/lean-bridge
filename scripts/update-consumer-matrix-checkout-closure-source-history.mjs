#!/usr/bin/env node
/**
 * Record the complete consumer-matrix checkout disk closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	assertConsumerMatrixCheckoutClosure
	, consumerMatrixCheckoutClosureAddedPaths
	, consumerMatrixCheckoutClosureHistoryPath
	, consumerMatrixCheckoutClosureImplementation
	, consumerMatrixCheckoutClosureImplementationPaths
	, consumerMatrixCheckoutClosureIntegrationPaths
	, consumerMatrixCheckoutClosurePinPaths
	, consumerMatrixCheckoutClosurePinRepair
	, consumerMatrixCheckoutClosurePredecessor
	, consumerMatrixCheckoutJobCount
	, consumerMatrixIntentionalCompleteCheckoutJobs
	, consumerMatrixNewSparseCheckoutJobs
} from "../tests/helpers/consumer-matrix-checkout-closure-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-consumer-matrix-checkout-closure-source-history.mjs");
const integration = git(["rev-parse", "HEAD"]).trim();
assert.equal(git(["rev-parse"
	, consumerMatrixCheckoutClosureImplementation + "^"]).trim()
, consumerMatrixCheckoutClosurePredecessor);
assert.equal(git(["rev-parse"
	, consumerMatrixCheckoutClosurePinRepair + "^"]).trim()
, consumerMatrixCheckoutClosureImplementation);
assert.equal(git(["rev-parse", integration + "^"]).trim()
	, consumerMatrixCheckoutClosurePinRepair);
assert.deepEqual(names(["diff", "--name-only"
	, consumerMatrixCheckoutClosurePredecessor
	, consumerMatrixCheckoutClosureImplementation])
, consumerMatrixCheckoutClosureImplementationPaths);
assert.deepEqual(names(["diff", "--name-only"
	, consumerMatrixCheckoutClosureImplementation
	, consumerMatrixCheckoutClosurePinRepair])
, consumerMatrixCheckoutClosurePinPaths);
assert.deepEqual(names(["diff", "--name-only"
	, consumerMatrixCheckoutClosurePinRepair, integration])
, [...consumerMatrixCheckoutClosureAddedPaths
	, ...consumerMatrixCheckoutClosureIntegrationPaths].sort());
assert.equal(existsSync(consumerMatrixCheckoutClosureHistoryPath), false);
assert.equal(git(["status", "--short"]).trim(), "");

const workflow = git(["show"
	, consumerMatrixCheckoutClosureImplementation
	+ ":.github/workflows/consumer-matrix.yml"]);
assertConsumerMatrixCheckoutClosure(workflow);
const updates = [];
for(const path of consumerMatrixCheckoutClosureImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, consumerMatrixCheckoutClosurePredecessor
		, consumerMatrixCheckoutClosureImplementation));
const pinUpdates = [];
for(const path of consumerMatrixCheckoutClosurePinPaths)
	pinUpdates.push(await gitSourceHistoryTransition(path
		, consumerMatrixCheckoutClosureImplementation
		, consumerMatrixCheckoutClosurePinRepair
		, { maximumEditBytes: 256 * 1024 * 1024 }));
const integrationUpdates = [];
for(const path of consumerMatrixCheckoutClosureIntegrationPaths)
	integrationUpdates.push(await gitSourceHistoryTransition(path
		, consumerMatrixCheckoutClosurePinRepair, integration
		, { maximumEditBytes: 256 * 1024 * 1024 }));
const additions = [];
for(const path of consumerMatrixCheckoutClosureAddedPaths)
	additions.push({ path, sha256: sha256(await readFile(path)) });

const currentSourcePin = {
	path: ".github/workflows/consumer-matrix.yml", count: 92
	, previous: sha256(git(["show"
		, consumerMatrixCheckoutClosurePredecessor
		+ ":.github/workflows/consumer-matrix.yml"]))
	, current: sha256(workflow)
};
assert.equal(currentSourcePin.previous
	, "ea54e7cbfa9fce0a9c33c1fe86d2e3bfd649fe17fddf5f2f23ba7c6d41c1f47d");
assert.equal(currentSourcePin.current
	, "c729331a3cebe4f35c14eb0fae196997fb7cba4abd2ddc412c47dcaae284ba48");
const beforeInventory = git(["show"
	, consumerMatrixCheckoutClosureImplementation
	+ ":docs/type-surface.v1.json"]);
const afterInventory = git(["show"
	, consumerMatrixCheckoutClosurePinRepair
	+ ":docs/type-surface.v1.json"]);
assert.equal(afterInventory.split(currentSourcePin.current).length - 1, 92);
assert.equal(afterInventory.includes(currentSourcePin.previous), false);
assert.equal(afterInventory.replaceAll(
	currentSourcePin.current, currentSourcePin.previous), beforeInventory);

await writeFile(consumerMatrixCheckoutClosureHistoryPath, canonicalJson({
	schemaVersion: 1, milestone: "consumer-matrix-checkout-closure-v1"
	, predecessorCommit: consumerMatrixCheckoutClosurePredecessor
	, implementationCommit: consumerMatrixCheckoutClosureImplementation
	, pinRepairCommit: consumerMatrixCheckoutClosurePinRepair
	, integrationCommit: integration
	, failedRun: {
		workflow: 41227734448, job: 124615494486
		, headSha: consumerMatrixCheckoutClosurePredecessor
		, jobName: "JavaScript and TypeScript receiver packages"
	}
	, failure: "hosted runner ENOSPC while actions/checkout was active"
	, annotation: {
		level: "failure", title: "System.IO.IOException"
		, message: "No space left on device"
		, path: "/home/runner/actions-runner/cached/2.338.2/_diag/Worker_*.log"
	}
	, rootCause: "The callback package family was bounded, but four other current-tree jobs still used complete checkout and three intentional history jobs did not reclaim hosted toolchains before materializing retained evidence. The JavaScript receiver job exhausted the runner during checkout before any language or package test executed."
	, scope: "Inventory every checkout in consumer-matrix.yml in one pass. Preserve complete history and evidence only for Documentation, owned JavaScript/Wasm history, and native PHP callback history, with pre-checkout disk reclamation. Move JavaScript receivers, PHP receivers, optional-parameter reconciliation, and support-summary reporting onto the shared depth-one non-cone sparse manifest; add receiver cleanup before checkout. Preserve every other existing sparse checkout, all semantic commands, support observations, evidence scope and runtime behavior."
	, checkoutJobs: consumerMatrixCheckoutJobCount, sparseCheckoutJobs: 33
	, intentionalCompleteCheckoutJobs:
		consumerMatrixIntentionalCompleteCheckoutJobs
	, newSparseCheckoutJobs: consumerMatrixNewSparseCheckoutJobs
	, currentSourcePin, additions, updates, pinUpdates, integrationUpdates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} workflow, `
	+ `${pinUpdates.length} pin and ${integrationUpdates.length} integration `
	+ `transitions across ${consumerMatrixCheckoutJobCount} checkout jobs.\n`);
