#!/usr/bin/env node
/**
 * Record the release-ready sparse-checkout repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { auditCurrentSourcePins }
	from "../tests/helpers/current-source-pin-preflight.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	vo1220ReleaseReadySparseCheckoutRepairAddedPaths
	, vo1220ReleaseReadySparseCheckoutRepairHistoryPath
	, vo1220ReleaseReadySparseCheckoutRepairImplementation
	, vo1220ReleaseReadySparseCheckoutRepairImplementationPaths
	, vo1220ReleaseReadySparseCheckoutRepairIntegrationPaths
	, vo1220ReleaseReadySparseCheckoutRepairPredecessor
} from "../tests/helpers/vo1220-release-ready-sparse-checkout-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-vo1220-release-ready-sparse-checkout-repair-source-history.mjs");
assert.equal(existsSync(
	vo1220ReleaseReadySparseCheckoutRepairHistoryPath), false);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, vo1220ReleaseReadySparseCheckoutRepairImplementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, vo1220ReleaseReadySparseCheckoutRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, vo1220ReleaseReadySparseCheckoutRepairPredecessor
	, vo1220ReleaseReadySparseCheckoutRepairImplementation])
, [...vo1220ReleaseReadySparseCheckoutRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...vo1220ReleaseReadySparseCheckoutRepairIntegrationPaths])
, [...vo1220ReleaseReadySparseCheckoutRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...vo1220ReleaseReadySparseCheckoutRepairAddedPaths])
, [...vo1220ReleaseReadySparseCheckoutRepairAddedPaths].sort());

const inventory = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
const cited = new Set(inventory.evidence.flatMap(item =>
	item.files.map(file => file.path)));
assert.deepEqual(vo1220ReleaseReadySparseCheckoutRepairImplementationPaths
	.filter(path => cited.has(path)), []);
const liveAudit = await auditCurrentSourcePins(inventory);
assert.deepEqual(liveAudit, {
	cohort: 2661, occurrences: 16326, findings: []
});
const updates = [];
for(const path of vo1220ReleaseReadySparseCheckoutRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, vo1220ReleaseReadySparseCheckoutRepairPredecessor
		, vo1220ReleaseReadySparseCheckoutRepairImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-release-ready-sparse-"));
try
{
	const environment = {
		...process.env, GIT_INDEX_FILE: join(directory, "index")
		, GIT_AUTHOR_NAME: "Lean Bridge history writer"
		, GIT_AUTHOR_EMAIL: "history@example.invalid"
		, GIT_COMMITTER_NAME: "Lean Bridge history writer"
		, GIT_COMMITTER_EMAIL: "history@example.invalid"
		, GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z"
		, GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z"
	};
	const temporaryGit = (arguments_, options = {}) => execFileSync(
		"git", arguments_, {
			encoding: "utf8", maxBuffer: 512 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree"
		, vo1220ReleaseReadySparseCheckoutRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...vo1220ReleaseReadySparseCheckoutRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, vo1220ReleaseReadySparseCheckoutRepairImplementation
	], { input: "Authenticate release-ready sparse checkout\n" }).trim();
	const integrationUpdates = [];
	for(const path of vo1220ReleaseReadySparseCheckoutRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, vo1220ReleaseReadySparseCheckoutRepairImplementation
			, integrationCommit, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of vo1220ReleaseReadySparseCheckoutRepairAddedPaths)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(vo1220ReleaseReadySparseCheckoutRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "vo1220-release-ready-sparse-checkout-repair-v1"
			, predecessorCommit:
				vo1220ReleaseReadySparseCheckoutRepairPredecessor
			, implementationCommit:
				vo1220ReleaseReadySparseCheckoutRepairImplementation
			, integrationCommit
			, sourceInventory: {
				revision: vo1220ReleaseReadySparseCheckoutRepairPredecessor
				, evidence: 900, occurrences: 369393, paths: 123815
				, objects: 20975, bytes: 27250476050, mismatches: 0
			}
			, checkoutContract: {
				action: "actions/checkout@v6", jobs: 2
				, filter: "blob:none", sparseCheckoutConeMode: false
				, excludedPath: "docs/evidence/"
			}
			, rootCause: "The first release job had a storage-safe sparse partial checkout, but the dependent release-ready verifier used a second default checkout. That checkout still materialized the 27,250,476,050-byte retained-evidence current tree before it could verify the already-built artifact, recreating the same hosted-runner disk risk at the final handoff. The earlier workflow assertion matched only the first checkout and therefore could not detect this asymmetric contract."
			, scope: "Apply the same blob-filtered non-cone docs/evidence exclusion to the release-ready verifier. Replace the single-match workflow assertion with an exact two-checkout inventory and validate every checkout independently. Change no release artifact, verification semantics, runtime, proof, support observation, package contract, public citation, inventory or prior receipt."
			, localValidation: {
				releaseAuthorization: { passed: 25, failed: 0 }
				, scopedLint: "passed", checkedJavaScriptTypecheck: "passed"
			}
			, refreshedPins: 0
			, liveSourcePaths: liveAudit.cohort
			, liveSourceOccurrences: liveAudit.occurrences
			, remainingMismatches: 0
			, updates, integrationUpdates, additions
		}), { flag: "wx" });
	process.stdout.write("Recorded exact release-ready sparse checkout.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
