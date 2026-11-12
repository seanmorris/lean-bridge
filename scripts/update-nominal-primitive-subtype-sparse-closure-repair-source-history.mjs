#!/usr/bin/env node
/**
 * Record the complete primitive-base sparse-history closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nominalPrimitiveSubtypeHistoryEvidencePaths }
	from "../tests/helpers/nominal-primitive-subtype-history-checkout.mjs";
import {
	nominalPrimitiveSubtypeSparseClosureRepairAddedPaths
	, nominalPrimitiveSubtypeSparseClosureRepairEvidencePaths
	, nominalPrimitiveSubtypeSparseClosureRepairHistoryPath
	, nominalPrimitiveSubtypeSparseClosureRepairImplementation
	, nominalPrimitiveSubtypeSparseClosureRepairImplementationPaths
	, nominalPrimitiveSubtypeSparseClosureRepairIntegrationPaths
	, nominalPrimitiveSubtypeSparseClosureRepairPinPaths
	, nominalPrimitiveSubtypeSparseClosureRepairPinRepair
	, nominalPrimitiveSubtypeSparseClosureRepairPredecessor
	, nominalPrimitiveSubtypeSparseClosureRepairWorkflowPaths
} from "../tests/helpers/nominal-primitive-subtype-sparse-closure-repair-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-nominal-primitive-subtype-sparse-closure-repair-source-history.mjs");
const integration = git(["rev-parse", "HEAD"]).trim();
assert.equal(git(["rev-parse"
	, nominalPrimitiveSubtypeSparseClosureRepairImplementation + "^"]).trim()
, nominalPrimitiveSubtypeSparseClosureRepairPredecessor);
assert.equal(git(["rev-parse"
	, nominalPrimitiveSubtypeSparseClosureRepairPinRepair + "^"]).trim()
, nominalPrimitiveSubtypeSparseClosureRepairImplementation);
assert.equal(git(["rev-parse", integration + "^"]).trim()
	, nominalPrimitiveSubtypeSparseClosureRepairPinRepair);
assert.deepEqual(names(["diff", "--name-only"
	, nominalPrimitiveSubtypeSparseClosureRepairPredecessor
	, nominalPrimitiveSubtypeSparseClosureRepairImplementation])
, [...nominalPrimitiveSubtypeSparseClosureRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only"
	, nominalPrimitiveSubtypeSparseClosureRepairImplementation
	, nominalPrimitiveSubtypeSparseClosureRepairPinRepair])
, nominalPrimitiveSubtypeSparseClosureRepairPinPaths);
assert.deepEqual(names(["diff", "--name-only"
	, nominalPrimitiveSubtypeSparseClosureRepairPinRepair, integration])
, [...nominalPrimitiveSubtypeSparseClosureRepairAddedPaths
	, ...nominalPrimitiveSubtypeSparseClosureRepairIntegrationPaths].sort());
assert.equal(existsSync(
	nominalPrimitiveSubtypeSparseClosureRepairHistoryPath), false);
assert.equal(git(["status", "--short"]).trim(), "");
assert.deepEqual(nominalPrimitiveSubtypeHistoryEvidencePaths
	, nominalPrimitiveSubtypeSparseClosureRepairEvidencePaths);

const updates = [];
for(const path of nominalPrimitiveSubtypeSparseClosureRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, nominalPrimitiveSubtypeSparseClosureRepairPredecessor
		, nominalPrimitiveSubtypeSparseClosureRepairImplementation));
const pinUpdates = [];
for(const path of nominalPrimitiveSubtypeSparseClosureRepairPinPaths)
	pinUpdates.push(await gitSourceHistoryTransition(path
		, nominalPrimitiveSubtypeSparseClosureRepairImplementation
		, nominalPrimitiveSubtypeSparseClosureRepairPinRepair
		, { maximumEditBytes: 256 * 1024 * 1024 }));
const integrationUpdates = [];
for(const path of nominalPrimitiveSubtypeSparseClosureRepairIntegrationPaths)
	integrationUpdates.push(await gitSourceHistoryTransition(path
		, nominalPrimitiveSubtypeSparseClosureRepairPinRepair, integration
		, { maximumEditBytes: 256 * 1024 * 1024 }));
const additions = [];
for(const path of nominalPrimitiveSubtypeSparseClosureRepairAddedPaths)
	additions.push({ path, sha256: sha256(await readFile(path)) });

const citedWorkflows
	= nominalPrimitiveSubtypeSparseClosureRepairWorkflowPaths.filter(path =>
		!path.endsWith("-supplement.yml"));
const currentSourcePins = citedWorkflows.map(path => ({
	path, count: 4
	, previous: sha256(git(["show"
		, nominalPrimitiveSubtypeSparseClosureRepairPredecessor + ":" + path]))
	, current: sha256(git(["show"
		, nominalPrimitiveSubtypeSparseClosureRepairImplementation + ":" + path]))
}));
assert.equal(currentSourcePins.length, 12);
const beforeInventory = git(["show"
	, nominalPrimitiveSubtypeSparseClosureRepairImplementation
		+ ":docs/type-surface.v1.json"]);
const afterInventory = git(["show"
	, nominalPrimitiveSubtypeSparseClosureRepairPinRepair
		+ ":docs/type-surface.v1.json"]);
let restored = afterInventory;
for(const pin of currentSourcePins)
{
	assert.equal(afterInventory.split(pin.current).length - 1
		, pin.count, pin.path);
	assert.equal(afterInventory.includes(pin.previous), false, pin.path);
	restored = restored.replaceAll(pin.current, pin.previous);
}
assert.equal(restored, beforeInventory);

await writeFile(nominalPrimitiveSubtypeSparseClosureRepairHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "nominal-primitive-subtype-sparse-closure-repair-v1"
		, predecessorCommit:
			nominalPrimitiveSubtypeSparseClosureRepairPredecessor
		, implementationCommit:
			nominalPrimitiveSubtypeSparseClosureRepairImplementation
		, pinRepairCommit:
			nominalPrimitiveSubtypeSparseClosureRepairPinRepair
		, integrationCommit: integration
		, failedHead: nominalPrimitiveSubtypeSparseClosureRepairPredecessor
		, failedRuns: [
			{ workflow: 43268892037, job: 131359793444, lane: "browser" }
			, { workflow: 43268982805, job: 131360105292, lane: "npm" }
		]
		, failureClass: "deterministic sparse-checkout ENOENT"
		, firstMissingPath:
			"docs/evidence/optional-parameter-dispatch-bridge-source-history-20261029.json"
		, rootCause: "The three filtered engine tests shared a module with retained historical suites. Node applied the name filter only after importing that complete module graph, while all thirteen nominal acceptance workflows still materialized the older three-record sparse contract. Browser and npm therefore failed before semantic execution on the first newly eager history record; adding only that first path would have exposed the next missing record."
		, scope: "Probe the exact sparse checkout until its filtered engine import graph closes; retain all twenty small authenticated history records in the one shared checkout used by every nominal workflow; reject removal of any record; advance exactly forty-eight live workflow citations; change no runtime, package, support cell, immutable archive, acceptance command or mathematical behavior."
		, gotcha: "A filtered Node test still imports skipped top-level suites before applying its test-name pattern. Sparse input closure must cover the imported module graph, not only tests whose names will execute."
		, evidencePaths:
			nominalPrimitiveSubtypeSparseClosureRepairEvidencePaths
		, sparseProbe: {
			materializedBytes: 473634035, filteredTests: 3, passed: 3
		}
		, currentSourcePins, additions, updates, pinUpdates, integrationUpdates
	}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} implementation, `
	+ `${pinUpdates.length} pin and ${integrationUpdates.length} integration `
	+ "transitions for the complete nominal sparse-history closure.\n");
