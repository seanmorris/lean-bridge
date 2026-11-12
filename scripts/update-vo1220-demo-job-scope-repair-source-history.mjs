#!/usr/bin/env node
/**
 * Record the demo job retained-contract scope repair.
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
	vo1220DemoJobScopeRepairAddedPaths
	, vo1220DemoJobScopeRepairHistoryPath
	, vo1220DemoJobScopeRepairImplementation
	, vo1220DemoJobScopeRepairImplementationPaths
	, vo1220DemoJobScopeRepairIntegrationPaths
	, vo1220DemoJobScopeRepairPredecessor
} from "../tests/helpers/vo1220-demo-job-scope-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-vo1220-demo-job-scope-repair-source-history.mjs");
assert.equal(existsSync(vo1220DemoJobScopeRepairHistoryPath), false);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, vo1220DemoJobScopeRepairImplementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, vo1220DemoJobScopeRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, vo1220DemoJobScopeRepairPredecessor
	, vo1220DemoJobScopeRepairImplementation])
, [...vo1220DemoJobScopeRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...vo1220DemoJobScopeRepairIntegrationPaths])
, [...vo1220DemoJobScopeRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...vo1220DemoJobScopeRepairAddedPaths])
, [...vo1220DemoJobScopeRepairAddedPaths].sort());

const inventory = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
const liveAudit = await auditCurrentSourcePins(inventory);
assert.deepEqual(liveAudit, {
	cohort: 2661, occurrences: 16326, findings: []
});
const updates = [];
for(const path of vo1220DemoJobScopeRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, vo1220DemoJobScopeRepairPredecessor
		, vo1220DemoJobScopeRepairImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-demo-job-scope-"));
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
	temporaryGit(["read-tree", vo1220DemoJobScopeRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...vo1220DemoJobScopeRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", vo1220DemoJobScopeRepairImplementation
	], { input: "Authenticate demo job scope\n" }).trim();
	const integrationUpdates = [];
	for(const path of vo1220DemoJobScopeRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, vo1220DemoJobScopeRepairImplementation
			, integrationCommit, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of vo1220DemoJobScopeRepairAddedPaths)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(vo1220DemoJobScopeRepairHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "vo1220-demo-job-scope-repair-v1"
		, predecessorCommit: vo1220DemoJobScopeRepairPredecessor
		, implementationCommit: vo1220DemoJobScopeRepairImplementation
		, integrationCommit
		, sourceInventory: {
			revision: vo1220DemoJobScopeRepairPredecessor
			, sha256: "3203c49f161c7becbc6f31e28972c7b45df45f70e4ee9b2fe65f184aee59597b"
			, evidence: 900, occurrences: 369393, paths: 123815
			, objects: 20975, bytes: 27250477669, batches: 240
			, conflicts: 0, missing: 0, mismatches: 0
		}
		, hostedFailure: {
			run: 43323785635, job: 131550980549
			, passedBoundary: "Check the React site and canonical documentation"
			, failedBoundary: "Build and verify demo artifacts"
			, missingPath: "docs/evidence/callback-checked-record-browser-20261023/hosted/artifact.zip.parts/0000.part"
		}
		, rootCause: "The explicit deferred contract scope covered the named site and documentation test steps, but demos:verify launched demos:site and site:build as nested child processes. Those children inherited only the job environment, fell back to the strict required default, and correctly rejected omitted retained evidence after every demo proof had already compiled."
		, scope: "Move the already explicit deferred contract scope to the demo build job so every direct and nested site-generation entrypoint inherits one lane boundary. Keep strict required behavior as the library default and in every authority lane. Remove duplicate step bindings, change no sparse manifest, runtime, proof, support claim, package, documentation content, evidence identity or type-surface pin, and add a workflow contract that requires the job-level binding."
		, localValidation: {
			nestedSiteGeneration: { compiledPages: 79
				, retainedEvidenceFailure: false }
			, focusedWorkflowContract: { passed: 2, failed: 0 }
			, scopedLint: "passed"
			, checkedJavaScriptTypecheck: "passed"
		}
		, refreshedPins: 0, refreshedSourcePaths: []
		, liveSourcePaths: liveAudit.cohort
		, liveSourceOccurrences: liveAudit.occurrences
		, remainingMismatches: 0
		, updates, integrationUpdates, additions
	}), { flag: "wx" });
	process.stdout.write("Recorded exact demo job-scope repair.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
