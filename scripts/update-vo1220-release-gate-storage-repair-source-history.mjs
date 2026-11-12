#!/usr/bin/env node
/**
 * Record the bounded release-gate checkout and stale site-contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	vo1220ReleaseGateStorageRepairAddedPaths
	, vo1220ReleaseGateStorageRepairHistoryPath
	, vo1220ReleaseGateStorageRepairImplementation
	, vo1220ReleaseGateStorageRepairImplementationPaths
	, vo1220ReleaseGateStorageRepairIntegrationPaths
	, vo1220ReleaseGateStorageRepairPredecessor
} from "../tests/helpers/vo1220-release-gate-storage-repair-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-vo1220-release-gate-storage-repair-source-history.mjs");
const integration = git(["rev-parse", "HEAD"]).trim();
assert.equal(git(["rev-parse"
	, vo1220ReleaseGateStorageRepairImplementation + "^"]).trim()
, vo1220ReleaseGateStorageRepairPredecessor);
assert.equal(git(["rev-parse", integration + "^"]).trim()
	, vo1220ReleaseGateStorageRepairImplementation);
assert.deepEqual(names(["diff", "--name-only"
	, vo1220ReleaseGateStorageRepairPredecessor
	, vo1220ReleaseGateStorageRepairImplementation])
, [...vo1220ReleaseGateStorageRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only"
	, vo1220ReleaseGateStorageRepairImplementation, integration])
, [...vo1220ReleaseGateStorageRepairAddedPaths
	, ...vo1220ReleaseGateStorageRepairIntegrationPaths].sort());
assert.equal(existsSync(vo1220ReleaseGateStorageRepairHistoryPath), false);
assert.equal(git(["status", "--short"]).trim(), "");

const updates = [];
for(const path of vo1220ReleaseGateStorageRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, vo1220ReleaseGateStorageRepairPredecessor
		, vo1220ReleaseGateStorageRepairImplementation));
const integrationUpdates = [];
for(const path of vo1220ReleaseGateStorageRepairIntegrationPaths)
	integrationUpdates.push(await gitSourceHistoryTransition(path
		, vo1220ReleaseGateStorageRepairImplementation, integration
		, { maximumEditBytes: 64 * 1024 * 1024 }));
const additions = [];
for(const path of vo1220ReleaseGateStorageRepairAddedPaths)
	additions.push({ path, sha256: sha256(await readFile(path)) });

await writeFile(vo1220ReleaseGateStorageRepairHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "vo1220-release-gate-storage-repair-v1"
	, predecessorCommit: vo1220ReleaseGateStorageRepairPredecessor
	, implementationCommit: vo1220ReleaseGateStorageRepairImplementation
	, integrationCommit: integration
	, failedRuns: [
		{ workflow: 43273104746, job: 131374362438, failure: "stale site capability assertion" }
		, { workflow: 43273104917, job: 131374361748, failure: "opaque full object-store clone exit 128" }
	]
	, rootCause: "The site contract still required the pre-dependent-Fin wording after the documentation had narrowed that boundary. Separately, both reproducibility source preparers forced two physical copies of a repository object database that has grown beyond 25 GiB; the universal workflow reached Git exit 128 before either semantic build and discarded the bounded Git stderr while wrapping the failure."
	, scope: "Match the site assertion to the exact current dependent-Fin boundary; keep two independent writable release trees while reusing immutable Git objects according to each lifetime contract; exclude retained evidence only from Lean Bridge's repository-owned universal working trees; refuse shallow universal sources; preserve bounded command diagnostics; retain self-contained component checkouts after author-source deletion; change no package bytes, type-surface support claim, runtime behavior, proof, or immutable prior receipt."
	, storageObservation: {
		packedRepository: "greater than 25 GiB"
		, universalSparseCheckoutBytes: 246367667
		, priorPhysicalObjectCopies: 2
		, currentPhysicalObjectCopies: 0
	}
	, additions, updates, integrationUpdates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} implementation and `
	+ `${integrationUpdates.length} integration transitions for the release-gate storage repair.\n`);
