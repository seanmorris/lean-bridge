#!/usr/bin/env node
/**
 * Record the bounded callback package checkout closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	assertCallbackPackageCheckoutContract
	, consumerCallbackPackageCheckoutClosureAddedPaths
	, consumerCallbackPackageCheckoutClosureHistoryPath
	, consumerCallbackPackageCheckoutClosureImplementation
	, consumerCallbackPackageCheckoutClosureImplementationPaths
	, consumerCallbackPackageCheckoutClosureIntegrationPaths
	, consumerCallbackPackageCheckoutClosurePinPaths
	, consumerCallbackPackageCheckoutClosurePinRepair
	, consumerCallbackPackageCheckoutClosurePredecessor
	, consumerCallbackPackageCheckoutJobIds
	, consumerWorkflowJobs
} from "../tests/helpers/consumer-callback-package-checkout-closure-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-consumer-callback-package-checkout-closure-source-history.mjs");
const integration = git(["rev-parse", "HEAD"]).trim();
assert.equal(git(["rev-parse"
	, consumerCallbackPackageCheckoutClosureImplementation + "^"]).trim()
, consumerCallbackPackageCheckoutClosurePredecessor);
assert.equal(git(["rev-parse"
	, consumerCallbackPackageCheckoutClosurePinRepair + "^"]).trim()
, consumerCallbackPackageCheckoutClosureImplementation);
assert.equal(git(["rev-parse", integration + "^"]).trim()
	, consumerCallbackPackageCheckoutClosurePinRepair);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, consumerCallbackPackageCheckoutClosurePredecessor
	, consumerCallbackPackageCheckoutClosureImplementation])
, consumerCallbackPackageCheckoutClosureImplementationPaths);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, consumerCallbackPackageCheckoutClosurePredecessor
	, consumerCallbackPackageCheckoutClosureImplementation]), []);
assert.deepEqual(names(["diff", "--name-only"
	, consumerCallbackPackageCheckoutClosureImplementation
	, consumerCallbackPackageCheckoutClosurePinRepair])
, consumerCallbackPackageCheckoutClosurePinPaths);
assert.deepEqual(names(["diff", "--name-only"
	, consumerCallbackPackageCheckoutClosurePinRepair, integration])
, [...consumerCallbackPackageCheckoutClosureAddedPaths
	, ...consumerCallbackPackageCheckoutClosureIntegrationPaths].sort());
assert.equal(existsSync(
	consumerCallbackPackageCheckoutClosureHistoryPath), false);
assert.equal(git(["status", "--short"]).trim(), "");

const workflow = git(["show"
	, consumerCallbackPackageCheckoutClosureImplementation
		+ ":.github/workflows/consumer-matrix.yml"]);
const jobs = consumerWorkflowJobs(workflow);
const callbacks = [...jobs].filter(([, body]) => body.includes(
	"Free hosted runner disk before callback package builds"));
assert.deepEqual(callbacks.map(([id]) => id)
	, consumerCallbackPackageCheckoutJobIds);
for(const [id, job] of callbacks)
	assertCallbackPackageCheckoutContract(id, job);

const updates = [];
for(const path of consumerCallbackPackageCheckoutClosureImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, consumerCallbackPackageCheckoutClosurePredecessor
		, consumerCallbackPackageCheckoutClosureImplementation));
const pinUpdates = [];
for(const path of consumerCallbackPackageCheckoutClosurePinPaths)
	pinUpdates.push(await gitSourceHistoryTransition(path
		, consumerCallbackPackageCheckoutClosureImplementation
		, consumerCallbackPackageCheckoutClosurePinRepair
		, { maximumEditBytes: 256 * 1024 * 1024 }));
const integrationUpdates = [];
for(const path of consumerCallbackPackageCheckoutClosureIntegrationPaths)
	integrationUpdates.push(await gitSourceHistoryTransition(path
		, consumerCallbackPackageCheckoutClosurePinRepair, integration
		, { maximumEditBytes: 256 * 1024 * 1024 }));
const additions = [];
for(const path of consumerCallbackPackageCheckoutClosureAddedPaths)
	additions.push({ path, sha256: sha256(await readFile(path)) });

const currentSourcePin = {
	path: ".github/workflows/consumer-matrix.yml", count: 92
	, previous: sha256(git(["show"
		, consumerCallbackPackageCheckoutClosurePredecessor
			+ ":.github/workflows/consumer-matrix.yml"]))
	, current: sha256(workflow)
};
assert.equal(currentSourcePin.previous
	, "00c0bd9a424894a0b0e0fecce7e2e6323460c844ceff50b4e89b9e728bdf3ba9");
assert.equal(currentSourcePin.current
	, "ea54e7cbfa9fce0a9c33c1fe86d2e3bfd649fe17fddf5f2f23ba7c6d41c1f47d");
const beforeInventory = git(["show"
	, consumerCallbackPackageCheckoutClosureImplementation
		+ ":docs/type-surface.v1.json"]);
const afterInventory = git(["show"
	, consumerCallbackPackageCheckoutClosurePinRepair
		+ ":docs/type-surface.v1.json"]);
assert.equal(afterInventory.split(currentSourcePin.current).length - 1
	, currentSourcePin.count);
assert.equal(afterInventory.includes(currentSourcePin.previous), false);
assert.equal(afterInventory.replaceAll(
	currentSourcePin.current, currentSourcePin.previous), beforeInventory);

await writeFile(consumerCallbackPackageCheckoutClosureHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "consumer-callback-package-checkout-closure-v1"
		, predecessorCommit:
			consumerCallbackPackageCheckoutClosurePredecessor
		, implementationCommit:
			consumerCallbackPackageCheckoutClosureImplementation
		, pinRepairCommit: consumerCallbackPackageCheckoutClosurePinRepair
		, integrationCommit: integration
		, failedRun: {
			workflow: 41225209353, job: 124610162218
			, headSha: consumerCallbackPackageCheckoutClosurePredecessor
			, jobName: "Callback-result lifetimes in installed Maven packages"
		}
		, failure: "hosted runner ENOSPC while actions/checkout was active"
		, annotation: {
			level: "failure", title: "System.IO.IOException"
			, message: "No space left on device"
			, path: "/home/runner/actions-runner/cached/2.338.2/_diag/Worker_*.log"
		}
		, rootCause: "All eight callback package jobs removed large hosted toolchains before cloning, but their unbounded complete checkout still materialized the retained evidence payload corpus. The Maven job exhausted the runner while actions/checkout was active, before any language or package test executed."
		, scope: "Apply the already shared bounded source-and-metadata sparse manifest to all eight callback package jobs. Retain exact-head depth one, disabled checkout credentials, non-cone matching, root evidence metadata and per-corpus index files while excluding nested retained payloads. Change no callback semantics, support observations, type-surface claims or runtime implementation."
		, contract: {
			fetchDepth: 1, persistCredentials: false, sparseCheckout: true
			, sparseManifest: "LEAN_BRIDGE_CONSUMER_SPARSE_CHECKOUT"
			, coneMode: false, cleanupBeforeCheckout: true
			, retainedEvidence: ["*.json", "*.md", "*.xml", "*/index.json"]
			, excludedEvidence: "nested retained payload corpus"
		}
		, callbackJobIds: consumerCallbackPackageCheckoutJobIds
		, currentSourcePin, additions, updates, pinUpdates, integrationUpdates
	}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} workflow, `
	+ `${pinUpdates.length} pin and ${integrationUpdates.length} integration `
	+ `transitions for ${consumerCallbackPackageCheckoutJobIds.length} jobs.\n`);
