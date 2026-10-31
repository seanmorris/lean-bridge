#!/usr/bin/env node
/**
 * Record the complete documentation sparse-input closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	assertConsumerDocumentationSparseInputClosure
	, consumerDocumentationEvidenceRoots
	, consumerDocumentationSparseInputClosureAddedPaths
	, consumerDocumentationSparseInputClosureHistoryPath
	, consumerDocumentationSparseInputClosureImplementation
	, consumerDocumentationSparseInputClosureImplementationPaths
	, consumerDocumentationSparseInputClosureIntegrationPaths
	, consumerDocumentationSparseInputClosurePinPaths
	, consumerDocumentationSparseInputClosurePinRepair
	, consumerDocumentationSparseInputClosurePredecessor
} from "../tests/helpers/consumer-documentation-sparse-input-closure-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-consumer-documentation-sparse-input-closure-source-history.mjs");
const integration = git(["rev-parse", "HEAD"]).trim();
assert.equal(git(["rev-parse"
	, consumerDocumentationSparseInputClosureImplementation + "^"]).trim()
, consumerDocumentationSparseInputClosurePredecessor);
assert.equal(git(["rev-parse"
	, consumerDocumentationSparseInputClosurePinRepair + "^"]).trim()
, consumerDocumentationSparseInputClosureImplementation);
assert.equal(git(["rev-parse", integration + "^"]).trim()
	, consumerDocumentationSparseInputClosurePinRepair);
assert.deepEqual(names(["diff", "--name-only"
	, consumerDocumentationSparseInputClosurePredecessor
	, consumerDocumentationSparseInputClosureImplementation])
, consumerDocumentationSparseInputClosureImplementationPaths);
assert.deepEqual(names(["diff", "--name-only"
	, consumerDocumentationSparseInputClosureImplementation
	, consumerDocumentationSparseInputClosurePinRepair])
, consumerDocumentationSparseInputClosurePinPaths);
assert.deepEqual(names(["diff", "--name-only"
	, consumerDocumentationSparseInputClosurePinRepair, integration])
, [...consumerDocumentationSparseInputClosureAddedPaths
	, ...consumerDocumentationSparseInputClosureIntegrationPaths].sort());
assert.equal(existsSync(consumerDocumentationSparseInputClosureHistoryPath)
	, false);
assert.equal(git(["status", "--short"]).trim(), "");

const workflow = git(["show"
	, consumerDocumentationSparseInputClosureImplementation
	+ ":.github/workflows/consumer-matrix.yml"]);
assertConsumerDocumentationSparseInputClosure(workflow);
const updates = [];
for(const path of consumerDocumentationSparseInputClosureImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, consumerDocumentationSparseInputClosurePredecessor
		, consumerDocumentationSparseInputClosureImplementation));
const pinUpdates = [];
for(const path of consumerDocumentationSparseInputClosurePinPaths)
	pinUpdates.push(await gitSourceHistoryTransition(path
		, consumerDocumentationSparseInputClosureImplementation
		, consumerDocumentationSparseInputClosurePinRepair
		, { maximumEditBytes: 256 * 1024 * 1024 }));
const integrationUpdates = [];
for(const path of consumerDocumentationSparseInputClosureIntegrationPaths)
	integrationUpdates.push(await gitSourceHistoryTransition(path
		, consumerDocumentationSparseInputClosurePinRepair, integration
		, { maximumEditBytes: 256 * 1024 * 1024 }));
const additions = [];
for(const path of consumerDocumentationSparseInputClosureAddedPaths)
	additions.push({ path, sha256: sha256(await readFile(path)) });

const currentSourcePin = {
	path: ".github/workflows/consumer-matrix.yml", count: 92
	, previous: sha256(git(["show"
		, consumerDocumentationSparseInputClosurePredecessor
		+ ":.github/workflows/consumer-matrix.yml"]))
	, current: sha256(workflow)
};
assert.equal(currentSourcePin.previous
	, "3f42de7adffc19c47844f0768be3451e810e8f51ac5a6ca83cee7af3f45001c2");
assert.equal(currentSourcePin.current
	, "e030dd3d7b920fdab9ca19301946ff4261a2aa2d217e2a57551c131ed795197f");
const beforeInventory = git(["show"
	, consumerDocumentationSparseInputClosureImplementation
	+ ":docs/type-surface.v1.json"]);
const afterInventory = git(["show"
	, consumerDocumentationSparseInputClosurePinRepair
	+ ":docs/type-surface.v1.json"]);
assert.equal(afterInventory.split(currentSourcePin.current).length - 1, 92);
assert.equal(afterInventory.includes(currentSourcePin.previous), false);
assert.equal(afterInventory.replaceAll(
	currentSourcePin.current, currentSourcePin.previous), beforeInventory);
let directEvidenceFiles = 0, directEvidenceBytes = 0;
for(const root of consumerDocumentationEvidenceRoots)
{
	const lines = git(["ls-tree", "-lr"
		, consumerDocumentationSparseInputClosureImplementation
		, `docs/evidence/${root}`]).trim().split("\n").filter(Boolean);
	for(const line of lines)
	{
		const match = /^\d+\s+blob\s+[0-9a-f]+\s+(\d+)\t/u.exec(line);
		assert.ok(match, line);
		directEvidenceFiles++;
		directEvidenceBytes += Number(match[1]);
	}
}

await writeFile(consumerDocumentationSparseInputClosureHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "consumer-documentation-sparse-input-closure-v1"
		, predecessorCommit: consumerDocumentationSparseInputClosurePredecessor
		, implementationCommit:
			consumerDocumentationSparseInputClosureImplementation
		, pinRepairCommit: consumerDocumentationSparseInputClosurePinRepair
		, integrationCommit: integration
		, localFailure: {
			command: "npm run test:docs", passed: 109, failed: 5
			, headSha: consumerDocumentationSparseInputClosurePredecessor
		}
		, missingInputClasses: [
			"retained Lean source", "TAP transcript"
			, "execution queue", "type-surface evidence files"
		]
		, rootCause: "The first documentation sparse manifest covered public-link text receipts but the full documentation contract also authenticates selected author-guide archives and generated type references. Those readers intentionally open retained Lean sources, TAP transcripts and execution queues; reference generation additionally verifies the complete type-surface evidence inventory when no exact authenticated receipt is bound."
		, scope: "Make Documentation depend on the existing exact-head type-surface authentication job, restore and bind its commit-scoped receipt, and retain the fourteen small original text-evidence roots read directly by author documentation. Keep the receipt verifier, every author/archive check and every generated-document comparison intact while continuing to exclude the 51.8 GB retained package, archive, object and executable corpus."
		, directEvidenceRoots: consumerDocumentationEvidenceRoots
		, directEvidenceFiles, directEvidenceBytes
		, currentSourcePin, additions, updates, pinUpdates, integrationUpdates
	}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} workflow, `
	+ `${pinUpdates.length} pin and ${integrationUpdates.length} integration `
	+ `transitions for ${directEvidenceFiles} direct documentation files.\n`);
