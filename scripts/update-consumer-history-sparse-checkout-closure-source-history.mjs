#!/usr/bin/env node
/**
 * Record the history-aware consumer sparse-checkout closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	assertConsumerHistorySparseCheckoutClosure
	, consumerHistoryCheckoutJobCount
	, consumerHistoryNewSparseCheckoutJobs
	, consumerHistorySparseCheckoutClosureAddedPaths
	, consumerHistorySparseCheckoutClosureHistoryPath
	, consumerHistorySparseCheckoutClosureImplementation
	, consumerHistorySparseCheckoutClosureImplementationPaths
	, consumerHistorySparseCheckoutClosureIntegrationPaths
	, consumerHistorySparseCheckoutClosurePinPaths
	, consumerHistorySparseCheckoutClosurePinRepair
	, consumerHistorySparseCheckoutClosurePredecessor
	, consumerHistorySparseCheckoutJobs
} from "../tests/helpers/consumer-history-sparse-checkout-closure-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-consumer-history-sparse-checkout-closure-source-history.mjs");
const integration = git(["rev-parse", "HEAD"]).trim();
assert.equal(git(["rev-parse"
	, consumerHistorySparseCheckoutClosureImplementation + "^"]).trim()
, consumerHistorySparseCheckoutClosurePredecessor);
assert.equal(git(["rev-parse"
	, consumerHistorySparseCheckoutClosurePinRepair + "^"]).trim()
, consumerHistorySparseCheckoutClosureImplementation);
assert.equal(git(["rev-parse", integration + "^"]).trim()
	, consumerHistorySparseCheckoutClosurePinRepair);
assert.deepEqual(names(["diff", "--name-only"
	, consumerHistorySparseCheckoutClosurePredecessor
	, consumerHistorySparseCheckoutClosureImplementation])
, consumerHistorySparseCheckoutClosureImplementationPaths);
assert.deepEqual(names(["diff", "--name-only"
	, consumerHistorySparseCheckoutClosureImplementation
	, consumerHistorySparseCheckoutClosurePinRepair])
, consumerHistorySparseCheckoutClosurePinPaths);
assert.deepEqual(names(["diff", "--name-only"
	, consumerHistorySparseCheckoutClosurePinRepair, integration])
, [...consumerHistorySparseCheckoutClosureAddedPaths
	, ...consumerHistorySparseCheckoutClosureIntegrationPaths].sort());
assert.equal(existsSync(consumerHistorySparseCheckoutClosureHistoryPath), false);
assert.equal(git(["status", "--short"]).trim(), "");

const workflow = git(["show"
	, consumerHistorySparseCheckoutClosureImplementation
	+ ":.github/workflows/consumer-matrix.yml"]);
assertConsumerHistorySparseCheckoutClosure(workflow);
const updates = [];
for(const path of consumerHistorySparseCheckoutClosureImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, consumerHistorySparseCheckoutClosurePredecessor
		, consumerHistorySparseCheckoutClosureImplementation));
const pinUpdates = [];
for(const path of consumerHistorySparseCheckoutClosurePinPaths)
	pinUpdates.push(await gitSourceHistoryTransition(path
		, consumerHistorySparseCheckoutClosureImplementation
		, consumerHistorySparseCheckoutClosurePinRepair
		, { maximumEditBytes: 256 * 1024 * 1024 }));
const integrationUpdates = [];
for(const path of consumerHistorySparseCheckoutClosureIntegrationPaths)
	integrationUpdates.push(await gitSourceHistoryTransition(path
		, consumerHistorySparseCheckoutClosurePinRepair, integration
		, { maximumEditBytes: 256 * 1024 * 1024 }));
const additions = [];
for(const path of consumerHistorySparseCheckoutClosureAddedPaths)
	additions.push({ path, sha256: sha256(await readFile(path)) });

const currentSourcePin = {
	path: ".github/workflows/consumer-matrix.yml", count: 92
	, previous: sha256(git(["show"
		, consumerHistorySparseCheckoutClosurePredecessor
		+ ":.github/workflows/consumer-matrix.yml"]))
	, current: sha256(workflow)
};
assert.equal(currentSourcePin.previous
	, "c729331a3cebe4f35c14eb0fae196997fb7cba4abd2ddc412c47dcaae284ba48");
assert.equal(currentSourcePin.current
	, "3f42de7adffc19c47844f0768be3451e810e8f51ac5a6ca83cee7af3f45001c2");
const beforeInventory = git(["show"
	, consumerHistorySparseCheckoutClosureImplementation
	+ ":docs/type-surface.v1.json"]);
const afterInventory = git(["show"
	, consumerHistorySparseCheckoutClosurePinRepair
	+ ":docs/type-surface.v1.json"]);
assert.equal(afterInventory.split(currentSourcePin.current).length - 1, 92);
assert.equal(afterInventory.includes(currentSourcePin.previous), false);
assert.equal(afterInventory.replaceAll(
	currentSourcePin.current, currentSourcePin.previous), beforeInventory);

await writeFile(consumerHistorySparseCheckoutClosureHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "consumer-history-sparse-checkout-closure-v1"
		, predecessorCommit: consumerHistorySparseCheckoutClosurePredecessor
		, implementationCommit:
			consumerHistorySparseCheckoutClosureImplementation
		, pinRepairCommit: consumerHistorySparseCheckoutClosurePinRepair
		, integrationCommit: integration
		, failedRun: {
			workflow: 41230798417, job: 124624546320
			, headSha: consumerHistorySparseCheckoutClosurePredecessor
			, jobName: "Native PHP callback-result acceptance"
		}
		, failure: "hosted runner ENOSPC while actions/checkout was active"
		, annotation: {
			level: "failure", title: "System.IO.IOException"
			, message: "No space left on device"
			, path:
				"/home/runner/actions-runner/cached/2.338.2/_diag/Worker_*.log"
		}
		, observedSteps: {
			cleanup: "success", checkout: "failure"
			, firstSemanticStep: "not started"
		}
		, rootCause: "The preceding closure bounded worktree materialization for current-tree jobs but deliberately retained three complete full-history checkouts. Cleanup alone could not fit the repository's retained 51.8 GB evidence corpus; native PHP exhausted the hosted runner before any semantic command. The same audit also made the blobless partial-clone behavior explicit for all thirteen history-dependent jobs instead of relying only on sparse-worktree appearance."
		, scope: "Preserve complete Git history while making every Consumer Matrix checkout sparse. Use explicit blob:none partial clones for all thirteen fetch-depth-zero jobs. Give Documentation a text-receipt manifest that includes nested JSON, Markdown and XML links without materializing retained archives or packages; use the shared source manifest for owned JavaScript/Wasm and native PHP callback acceptance. Preserve all semantic commands, exact historical commits, support observations, evidence scope and runtime behavior."
		, checkoutJobs: consumerHistoryCheckoutJobCount
		, sparseCheckoutJobs: consumerHistoryCheckoutJobCount
		, historySparseCheckoutJobs: consumerHistorySparseCheckoutJobs
		, newSparseCheckoutJobs: consumerHistoryNewSparseCheckoutJobs
		, actionsCheckoutBehavior: {
			version: "v6"
			, source: "actions/checkout src/git-source-provider.ts"
			, contract: "sparse checkout fetches with blob:none and then configures the requested sparse worktree"
		}
		, currentSourcePin, additions, updates, pinUpdates, integrationUpdates
	}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} workflow, `
	+ `${pinUpdates.length} pin and ${integrationUpdates.length} integration `
	+ `transitions across ${consumerHistoryCheckoutJobCount} sparse checkout jobs.\n`);
