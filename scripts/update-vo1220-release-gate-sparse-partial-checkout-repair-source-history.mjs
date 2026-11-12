#!/usr/bin/env node
/**
 * Record the release-gate sparse partial-checkout repair.
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
	vo1220ReleaseGateSparsePartialCheckoutRepairAddedPaths
	, vo1220ReleaseGateSparsePartialCheckoutRepairHistoryPath
	, vo1220ReleaseGateSparsePartialCheckoutRepairImplementation
	, vo1220ReleaseGateSparsePartialCheckoutRepairImplementationPaths
	, vo1220ReleaseGateSparsePartialCheckoutRepairIntegrationPaths
	, vo1220ReleaseGateSparsePartialCheckoutRepairPredecessor
} from "../tests/helpers/vo1220-release-gate-sparse-partial-checkout-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-vo1220-release-gate-sparse-partial-checkout-repair-source-history.mjs");
assert.equal(existsSync(
	vo1220ReleaseGateSparsePartialCheckoutRepairHistoryPath), false);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, vo1220ReleaseGateSparsePartialCheckoutRepairImplementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, vo1220ReleaseGateSparsePartialCheckoutRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, vo1220ReleaseGateSparsePartialCheckoutRepairPredecessor
	, vo1220ReleaseGateSparsePartialCheckoutRepairImplementation])
, [...vo1220ReleaseGateSparsePartialCheckoutRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...vo1220ReleaseGateSparsePartialCheckoutRepairIntegrationPaths])
, [...vo1220ReleaseGateSparsePartialCheckoutRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...vo1220ReleaseGateSparsePartialCheckoutRepairAddedPaths])
, [...vo1220ReleaseGateSparsePartialCheckoutRepairAddedPaths].sort());

const inventory = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
const cited = new Set(inventory.evidence.flatMap(item =>
	item.files.map(file => file.path)));
assert.deepEqual(vo1220ReleaseGateSparsePartialCheckoutRepairImplementationPaths
	.filter(path => cited.has(path)), []);
const liveAudit = await auditCurrentSourcePins(inventory);
assert.deepEqual(liveAudit, {
	cohort: 2661, occurrences: 16326, findings: []
});
const updates = [];
for(const path of vo1220ReleaseGateSparsePartialCheckoutRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, vo1220ReleaseGateSparsePartialCheckoutRepairPredecessor
		, vo1220ReleaseGateSparsePartialCheckoutRepairImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-release-gate-sparse-partial-"));
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
		, vo1220ReleaseGateSparsePartialCheckoutRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...vo1220ReleaseGateSparsePartialCheckoutRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, vo1220ReleaseGateSparsePartialCheckoutRepairImplementation
	], { input: "Authenticate release-gate sparse partial checkout\n" }).trim();
	const integrationUpdates = [];
	for(const path of vo1220ReleaseGateSparsePartialCheckoutRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, vo1220ReleaseGateSparsePartialCheckoutRepairImplementation
			, integrationCommit, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of vo1220ReleaseGateSparsePartialCheckoutRepairAddedPaths)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(vo1220ReleaseGateSparsePartialCheckoutRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "vo1220-release-gate-sparse-partial-checkout-repair-v1"
			, predecessorCommit:
				vo1220ReleaseGateSparsePartialCheckoutRepairPredecessor
			, implementationCommit:
				vo1220ReleaseGateSparsePartialCheckoutRepairImplementation
			, integrationCommit
			, sourceInventory: {
				revision: vo1220ReleaseGateSparsePartialCheckoutRepairPredecessor
				, evidence: 900, occurrences: 369393, paths: 123815
				, objects: 20975, bytes: 27250476050, mismatches: 0
			}
			, checkoutContract: {
				action: "actions/checkout@v6"
				, filter: "blob:none", sparseCheckoutConeMode: false
				, excludedPath: "docs/evidence/"
			}
			, rootCause: "A blob:none filter avoids historical-only blobs but, by itself, still materializes every blob in the current checkout. The exact current type-surface inventory addresses 27,250,476,050 bytes under 123,815 paths, overwhelmingly retained evidence that the release gate explicitly excludes from both clean source trees. The partial filter therefore needed the same non-cone docs/evidence exclusion at the initial hosted checkout boundary."
			, scope: "Combine fetch-depth zero and blob:none with a non-cone sparse checkout of the full current tree except docs/evidence. Extend the executable regression so the partial repository itself omits a current evidence file before it prepares both clean sources. Change no release artifact, runtime, proof, support observation, package contract, public citation, inventory or prior receipt."
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
	process.stdout.write("Recorded exact release-gate sparse partial checkout.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
