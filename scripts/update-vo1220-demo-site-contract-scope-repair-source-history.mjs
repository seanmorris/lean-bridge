#!/usr/bin/env node
/**
 * Record the demo site retained-contract scope repair.
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
	vo1220DemoSiteContractScopeRepairAddedPaths
	, vo1220DemoSiteContractScopeRepairHistoryPath
	, vo1220DemoSiteContractScopeRepairImplementation
	, vo1220DemoSiteContractScopeRepairImplementationPaths
	, vo1220DemoSiteContractScopeRepairIntegrationPaths
	, vo1220DemoSiteContractScopeRepairPredecessor
} from "../tests/helpers/vo1220-demo-site-contract-scope-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-vo1220-demo-site-contract-scope-repair-source-history.mjs");
assert.equal(existsSync(
	vo1220DemoSiteContractScopeRepairHistoryPath), false);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, vo1220DemoSiteContractScopeRepairImplementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, vo1220DemoSiteContractScopeRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, vo1220DemoSiteContractScopeRepairPredecessor
	, vo1220DemoSiteContractScopeRepairImplementation])
, [...vo1220DemoSiteContractScopeRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...vo1220DemoSiteContractScopeRepairIntegrationPaths])
, [...vo1220DemoSiteContractScopeRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...vo1220DemoSiteContractScopeRepairAddedPaths])
, [...vo1220DemoSiteContractScopeRepairAddedPaths].sort());

const inventory = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
const liveAudit = await auditCurrentSourcePins(inventory);
assert.deepEqual(liveAudit, {
	cohort: 2661, occurrences: 16326, findings: []
});
const updates = [];
for(const path of vo1220DemoSiteContractScopeRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, vo1220DemoSiteContractScopeRepairPredecessor
		, vo1220DemoSiteContractScopeRepairImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-demo-site-scope-"));
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
		, vo1220DemoSiteContractScopeRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...vo1220DemoSiteContractScopeRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, vo1220DemoSiteContractScopeRepairImplementation
	], { input: "Authenticate demo site contract scope\n" }).trim();
	const integrationUpdates = [];
	for(const path of vo1220DemoSiteContractScopeRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, vo1220DemoSiteContractScopeRepairImplementation
			, integrationCommit, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of vo1220DemoSiteContractScopeRepairAddedPaths)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(vo1220DemoSiteContractScopeRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "vo1220-demo-site-contract-scope-repair-v1"
			, predecessorCommit:
				vo1220DemoSiteContractScopeRepairPredecessor
			, implementationCommit:
				vo1220DemoSiteContractScopeRepairImplementation
			, integrationCommit
			, sourceInventory: {
				revision: vo1220DemoSiteContractScopeRepairPredecessor
				, sha256: "0d29c661d48ef35f1c3607eeae45c310408bf726c369c4766ce88959e4b1e11d"
				, evidence: 900, occurrences: 369393, paths: 123815
				, objects: 20975, bytes: 27250476635, batches: 240
				, conflicts: 0, missing: 0, mismatches: 0
			}
			, checkoutContract: {
				action: "actions/checkout@v6", fetchDepth: 1
				, filter: "blob:none", sparseCheckoutConeMode: false
				, manifestAuthority: ".github/workflows/demos-pages.yml"
				, retainedContracts: "deferred"
				, evidenceAuthority: ["Core quality contract"
					, "Downstream consumer contract"]
			}
			, rootCause: "The bounded demo checkout correctly retained the current documentation model and its small receipt closure, but site generation still invoked the authoritative type-surface reader. That reader realpathed and hashed every retained evidence file, including omitted binary payloads, so the presentation lane failed before rendering even though its separately owned current-documentation contract was complete."
			, scope: "Split structural model validation from retained evidence-byte authority. Require an explicit deferred scope in the demo site step, validate the three governing type-surface documents, and pass that validated inventory into reference generation. Preserve required as the default, keep the authoritative reader strict, reject unknown scopes, and prove that an isolated sparse model succeeds while the full reader rejects its missing evidence. Change no support cell, observation, runtime, proof, package API, documentation content or retained evidence identity."
			, localValidation: {
				siteTypecheck: "passed"
				, siteTests: { passed: 112, failed: 0, skipped: 0 }
				, demoDocumentation: { passed: 78, failed: 0, skipped: 3 }
				, modelAuthoritySeparation: { passed: 1, failed: 0 }
				, scopedLint: "passed"
				, checkedJavaScriptTypecheck: "passed"
			}
			, refreshedPins: 1
			, refreshedSourcePaths: ["src/adoption/type-surface.mjs"]
			, liveSourcePaths: liveAudit.cohort
			, liveSourceOccurrences: liveAudit.occurrences
			, remainingMismatches: 0
			, updates, integrationUpdates, additions
		}), { flag: "wx" });
	process.stdout.write("Recorded exact demo site contract-scope repair.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
