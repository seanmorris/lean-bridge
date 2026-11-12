#!/usr/bin/env node
/**
 * Record the demo documentation boundary repair.
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
	vo1220DemoDocumentationBoundaryRepairAddedPaths
	, vo1220DemoDocumentationBoundaryRepairHistoryPath
	, vo1220DemoDocumentationBoundaryRepairImplementation
	, vo1220DemoDocumentationBoundaryRepairImplementationPaths
	, vo1220DemoDocumentationBoundaryRepairIntegrationPaths
	, vo1220DemoDocumentationBoundaryRepairPredecessor
} from "../tests/helpers/vo1220-demo-documentation-boundary-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-vo1220-demo-documentation-boundary-repair-source-history.mjs");
assert.equal(existsSync(
	vo1220DemoDocumentationBoundaryRepairHistoryPath), false);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, vo1220DemoDocumentationBoundaryRepairImplementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, vo1220DemoDocumentationBoundaryRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, vo1220DemoDocumentationBoundaryRepairPredecessor
	, vo1220DemoDocumentationBoundaryRepairImplementation])
, [...vo1220DemoDocumentationBoundaryRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...vo1220DemoDocumentationBoundaryRepairIntegrationPaths])
, [...vo1220DemoDocumentationBoundaryRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...vo1220DemoDocumentationBoundaryRepairAddedPaths])
, [...vo1220DemoDocumentationBoundaryRepairAddedPaths].sort());

const inventory = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
const liveAudit = await auditCurrentSourcePins(inventory);
assert.deepEqual(liveAudit, {
	cohort: 2661, occurrences: 16326, findings: []
});
const updates = [];
for(const path of vo1220DemoDocumentationBoundaryRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, vo1220DemoDocumentationBoundaryRepairPredecessor
		, vo1220DemoDocumentationBoundaryRepairImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-demo-doc-boundary-"));
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
		, vo1220DemoDocumentationBoundaryRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...vo1220DemoDocumentationBoundaryRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, vo1220DemoDocumentationBoundaryRepairImplementation
	], { input: "Authenticate demo documentation boundary\n" }).trim();
	const integrationUpdates = [];
	for(const path of vo1220DemoDocumentationBoundaryRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, vo1220DemoDocumentationBoundaryRepairImplementation
			, integrationCommit, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of vo1220DemoDocumentationBoundaryRepairAddedPaths)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(vo1220DemoDocumentationBoundaryRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "vo1220-demo-documentation-boundary-repair-v1"
			, predecessorCommit:
				vo1220DemoDocumentationBoundaryRepairPredecessor
			, implementationCommit:
				vo1220DemoDocumentationBoundaryRepairImplementation
			, integrationCommit
			, sourceInventory: {
				revision: vo1220DemoDocumentationBoundaryRepairPredecessor
				, evidence: 900, occurrences: 369393, paths: 123815
				, objects: 20975, bytes: 27250476050, mismatches: 0
			}
			, checkoutContract: {
				action: "actions/checkout@v6", fetchDepth: 1
				, filter: "blob:none", sparseCheckoutConeMode: false
				, manifestAuthority: ".github/workflows/consumer-matrix.yml"
				, retainedContracts: "deferred", diskCleanupBeforeCheckout: true
			}
			, rootCause: "The shallow demo checkout executed the complete retained-history documentation entrypoint. Nineteen failures were retained source-history or archived-evidence failures rather than current documentation or demo defects, and the default checkout also materialized the 27,250,476,050-byte retained-evidence current tree. The presentation lane was therefore pretending to be an authoritative retained-history lane while paying its full storage cost."
			, scope: "Reuse Consumer Matrix's authenticated bounded documentation manifest with a shallow blob-filtered sparse checkout and disk cleanup. Add a demo documentation entrypoint that checks every current documentation suite while deferring only the retained type-surface suite and the explicitly registered retained contracts. Keep the full documentation entrypoint unchanged and authoritative in Core and Consumer Matrix. Change no runtime, proof, support observation, package API, documentation content, type-surface inventory or prior receipt."
			, localValidation: {
				demoDocumentation: { passed: 78, failed: 0, skipped: 3 }
				, focusedCheckout: { passed: 2, failed: 0 }
				, scopedLint: "passed", checkedJavaScriptTypecheck: "passed"
			}
			, refreshedPins: 50
			, refreshedSourcePaths: [
				"package.json", "tests/documentation.test.mjs"
			]
			, liveSourcePaths: liveAudit.cohort
			, liveSourceOccurrences: liveAudit.occurrences
			, remainingMismatches: 0
			, updates, integrationUpdates, additions
		}), { flag: "wx" });
	process.stdout.write("Recorded exact demo documentation boundary repair.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
