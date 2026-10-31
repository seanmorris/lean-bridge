#!/usr/bin/env node
/**
 * Record the workflow-wide Nix consumer source-closure repair.
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
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	consumerNixSourceClosureAuditHistoryAdditions
	, consumerNixSourceClosureAuditHistoryPath
	, consumerNixSourceClosureAuditImplementation
	, consumerNixSourceClosureAuditImplementationAdditions
	, consumerNixSourceClosureAuditImplementationUpdates
	, consumerNixSourceClosureAuditIntegrationPaths
	, consumerNixSourceClosureAuditPredecessor
} from "../tests/helpers/consumer-nix-source-closure-audit-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-consumer-nix-source-closure-audit-source-history.mjs");
assert.equal(existsSync(consumerNixSourceClosureAuditHistoryPath), false
	, consumerNixSourceClosureAuditHistoryPath + " already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, consumerNixSourceClosureAuditImplementation);
assert.equal(git(["rev-parse"
	, consumerNixSourceClosureAuditImplementation + "^"]).trim()
, consumerNixSourceClosureAuditPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, consumerNixSourceClosureAuditPredecessor
	, consumerNixSourceClosureAuditImplementation, "--"])
, [...consumerNixSourceClosureAuditImplementationUpdates].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, consumerNixSourceClosureAuditPredecessor
	, consumerNixSourceClosureAuditImplementation, "--"])
, [...consumerNixSourceClosureAuditImplementationAdditions].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...consumerNixSourceClosureAuditIntegrationPaths])
, [...consumerNixSourceClosureAuditIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...consumerNixSourceClosureAuditHistoryAdditions])
, [...consumerNixSourceClosureAuditHistoryAdditions].sort());

const inventoryPath = "docs/type-surface.v1.json";
const workflowPath = ".github/workflows/consumer-matrix.yml";
const beforeInventory = git(["show"
	, consumerNixSourceClosureAuditPredecessor + ":" + inventoryPath]);
const afterInventory = git(["show"
	, consumerNixSourceClosureAuditImplementation + ":" + inventoryPath]);
const previousWorkflow = git(["show"
	, consumerNixSourceClosureAuditPredecessor + ":" + workflowPath]);
const currentWorkflow = git(["show"
	, consumerNixSourceClosureAuditImplementation + ":" + workflowPath]);
const previousWorkflowSha256 = sha256(previousWorkflow);
const currentWorkflowSha256 = sha256(currentWorkflow);
const refreshedCitationCount = afterInventory.split(
	currentWorkflowSha256).length - 1;
assert.equal(refreshedCitationCount, 92);
assert.equal(afterInventory.includes(previousWorkflowSha256), false);
assert.equal(afterInventory.replaceAll(currentWorkflowSha256
	, previousWorkflowSha256), beforeInventory);

const expectedNixJobs = [
	"browser-consumer", "docker-engine", "host-null-systems"
	, "managed-consumers", "native-c-family-values", "native-consumers"
	, "nix-cache", "node-consumers", "owned-jvm-values", "owned-wit-receivers"
	, "php-consumers", "php-multi-profile", "php-wasm-callback-results"
	, "php-wasm-consumers", "php-wasm-corpus", "php-wasm-receivers"
	, "reviewed-fin-wasm-entry", "wasi-consumer"
];
const starts = [...currentWorkflow.matchAll(
	/^ {2}([A-Za-z0-9_-]+):\s*$/gmu)];
const jobs = new Map(starts.map((match, index) => [
	match[1]
	, currentWorkflow.slice(match.index
		, starts[index + 1]?.index ?? currentWorkflow.length)
]));
const actualNixJobs = [...jobs].filter(([, source]) => source.includes(
	"uses: cachix/install-nix-action@v31")).map(([name]) => name).sort();
assert.deepEqual(actualNixJobs, expectedNixJobs);
const generalNixJobs = expectedNixJobs.filter(name =>
	!["docker-engine", "nix-cache"].includes(name));
for(const name of generalNixJobs)
{
	const job = jobs.get(name);
	assert.match(job
		, /sparse-checkout: \$\{\{ env\.LEAN_BRIDGE_CONSUMER_SPARSE_CHECKOUT \}\}/u
		, name);
	assert.match(job, /run: bash scripts\/check-consumer-source-closure\.sh/u
		, name);
}

const treeInventory = revision => {
	let allBytes = 0, allFiles = 0, evidenceBytes = 0, evidenceFiles = 0;
	for(const line of git(["ls-tree", "-rlz", revision]).split("\0"))
	{
		if(line === "") continue;
		const match = line.match(/^\d+ blob [0-9a-f]+ +(\d+)\t(.*)$/u);
		if(match === null) continue;
		const bytes = Number(match[1]), path = match[2];
		allBytes += bytes; allFiles++;
		if(path.startsWith("docs/evidence/"))
		{ evidenceBytes += bytes; evidenceFiles++; }
	}
	return {
		allBytes, allFiles, evidenceBytes, evidenceFiles
		, nonEvidenceBytes: allBytes - evidenceBytes
		, nonEvidenceFiles: allFiles - evidenceFiles
	};
};
const trackedTree = treeInventory(
	consumerNixSourceClosureAuditImplementation);

const updates = [];
for(const path of consumerNixSourceClosureAuditImplementationUpdates)
	updates.push(await gitSourceHistoryTransition(path
		, consumerNixSourceClosureAuditPredecessor
		, consumerNixSourceClosureAuditImplementation
		, { maximumEditBytes: 256 * 1024 * 1024 }));
const implementationAdditions = [];
for(const path of consumerNixSourceClosureAuditImplementationAdditions)
	implementationAdditions.push({ path
		, sha256: sha256(git(["show"
			, consumerNixSourceClosureAuditImplementation + ":" + path])) });

const directory = await mkdtemp(join(
	tmpdir(), "lean-consumer-nix-source-closure-audit-"));
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
	temporaryGit(["read-tree", consumerNixSourceClosureAuditImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...consumerNixSourceClosureAuditIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", consumerNixSourceClosureAuditImplementation
	], { input: "Authenticate workflow-wide Nix source closures\n" }).trim();
	const integrationUpdates = [];
	for(const path of consumerNixSourceClosureAuditIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, consumerNixSourceClosureAuditImplementation
			, integrationCommit, { maximumEditBytes: 128 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of consumerNixSourceClosureAuditHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(consumerNixSourceClosureAuditHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "consumer-nix-source-closure-audit-v1"
		, predecessorCommit: consumerNixSourceClosureAuditPredecessor
		, implementationCommit: consumerNixSourceClosureAuditImplementation
		, failedRun: { workflow: 41204400085, job: 124548377113 }
		, failure: {
			consumer: "browser-javascript"
			, step: "Install the npm archive and execute real Lean in Chromium"
			, completedAt: "2026-10-31T13:45:27Z"
			, error: "write of 24576 bytes: No space left on device"
			, runnerDiskBeforeCleanupGiB: 86
			, runnerDiskAfterCleanupGiB: 108
			, executedProductBoundary: false
		}
		, trackedTree
		, jobs: {
			totalNix: expectedNixJobs.length
			, generalMetadataClosures: generalNixJobs
			, dedicatedClosures: ["docker-engine", "nix-cache"]
		}
		, checkout: {
			coneMode: false, missingBlobFloor: 1000
			, gitKiBCeiling: 2097152, sourceKiBCeiling: 2097152
			, evidenceMetadataKiBCeiling: 1572864
			, evidenceRootFormats: ["json", "md", "xml"]
			, retainedArchiveFile: "index.json"
			, excluded: "all other docs/evidence descendants"
		}
		, scope: "Replace every disk-heavy full checkout in the downstream Nix matrix with one shared metadata-only sparse closure after the Browser npm job independently reproduced the Docker ENOSPC failure. Inventory all eighteen Nix-installing jobs: sixteen general consumer jobs must use the shared closure and its hosted size guard, while Docker and the signed-cache recipe retain their stricter dedicated closures. Preserve root evidence metadata and archive indexes needed by consumer contract tests, exclude all retained payloads, refresh exactly 92 workflow citations, and change no support cell or product behavior."
		, refreshedCitationCount
		, currentSourcePins: [{
			path: workflowPath, count: refreshedCitationCount
			, previous: previousWorkflowSha256, current: currentWorkflowSha256
		}]
		, semanticChanges: 0, updates, implementationAdditions
		, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write("Recorded " + updates.length
		+ " source transitions, " + implementationAdditions.length
		+ " implementation addition, " + integrationUpdates.length
		+ " integration transitions and " + refreshedCitationCount
		+ " workflow pins.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
