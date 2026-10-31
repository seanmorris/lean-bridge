#!/usr/bin/env node
/**
 * Record the evidence-free Docker consumer source repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	consumerDockerEvidenceExclusionHistoryAdditions
	, consumerDockerEvidenceExclusionHistoryPath
	, consumerDockerEvidenceExclusionImplementation
	, consumerDockerEvidenceExclusionImplementationPaths
	, consumerDockerEvidenceExclusionIntegrationPaths
	, consumerDockerEvidenceExclusionPredecessor
} from "../tests/helpers/consumer-docker-evidence-exclusion-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-consumer-docker-evidence-exclusion-source-history.mjs");
assert.equal(existsSync(consumerDockerEvidenceExclusionHistoryPath), false
	, consumerDockerEvidenceExclusionHistoryPath + " already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, consumerDockerEvidenceExclusionImplementation);
assert.equal(git(["rev-parse"
	, consumerDockerEvidenceExclusionImplementation + "^"]).trim()
, consumerDockerEvidenceExclusionPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, consumerDockerEvidenceExclusionPredecessor
	, consumerDockerEvidenceExclusionImplementation, "--"])
, [...consumerDockerEvidenceExclusionImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, consumerDockerEvidenceExclusionPredecessor
	, consumerDockerEvidenceExclusionImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, consumerDockerEvidenceExclusionImplementation + ":"
		+ consumerDockerEvidenceExclusionHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...consumerDockerEvidenceExclusionIntegrationPaths])
, [...consumerDockerEvidenceExclusionIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...consumerDockerEvidenceExclusionHistoryAdditions])
, [...consumerDockerEvidenceExclusionHistoryAdditions].sort());

const inventoryPath = "docs/type-surface.v1.json";
const before = git(["show"
	, consumerDockerEvidenceExclusionPredecessor + ":" + inventoryPath]);
const after = git(["show"
	, consumerDockerEvidenceExclusionImplementation + ":" + inventoryPath]);
const workflowPath = ".github/workflows/consumer-matrix.yml";
const previousWorkflow = git(["show"
	, consumerDockerEvidenceExclusionPredecessor + ":" + workflowPath]);
const currentWorkflow = git(["show"
	, consumerDockerEvidenceExclusionImplementation + ":" + workflowPath]);
const previousWorkflowSha256 = sha256(previousWorkflow);
const currentWorkflowSha256 = sha256(currentWorkflow);
const refreshedCitationCount = after.split(currentWorkflowSha256).length - 1;
assert.equal(refreshedCitationCount, 92);
assert.equal(after.includes(previousWorkflowSha256), false);
assert.equal(after.replaceAll(currentWorkflowSha256, previousWorkflowSha256)
	, before);
const beforeDocument = JSON.parse(before);
const afterDocument = JSON.parse(after);
assert.deepEqual(afterDocument.profiles, beforeDocument.profiles);
assert.deepEqual(afterDocument.observations, beforeDocument.observations);

const dockerJob = currentWorkflow.split("  docker-engine:\n")[1]
	?.split("\n  perl-consumer:\n")[0];
assert.ok(dockerJob);
for(const expression of [
	/^ {10}fetch-depth: 1$/mu
	, /^ {10}sparse-checkout: \|$/mu
	, /^ {12}!\/docs\/evidence\/$/mu
	, /^ {10}sparse-checkout-cone-mode: false$/mu
	, /git rev-list --objects --missing=print HEAD/u
	, /test "\$missing_blobs" -gt 1000/u
	, /test "\$git_bytes" -lt 2097152/u
	, /test "\$source_bytes" -lt 2097152/u
	, /^ {10}LEAN_BRIDGE_CONSUMER_SOURCE_MODE: sparse-path$/mu
]) assert.match(dockerJob, expression);
const runner = git(["show"
	, consumerDockerEvidenceExclusionImplementation
		+ ":scripts/test-docker-consumer-ci.sh"]);
for(const expression of [
	/git -C "\$LEAN_BRIDGE_CI_ROOT" archive --format=tar HEAD -- \./u
	, /':\(exclude\)docs\/evidence'/u
	, /"\$flake#universal-core-artifacts"/u
	, /"\$flake#npm-package"/u
	, /node --test tests\/consumer-node\.test\.mjs/u
]) assert.match(runner, expression);

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
	consumerDockerEvidenceExclusionImplementation);
assert.deepEqual(trackedTree, {
	allBytes: 51999627829, allFiles: 228984
	, evidenceBytes: 51797463311, evidenceFiles: 217300
	, nonEvidenceBytes: 202164518, nonEvidenceFiles: 11684
});

const updates = [];
for(const path of consumerDockerEvidenceExclusionImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, consumerDockerEvidenceExclusionPredecessor
		, consumerDockerEvidenceExclusionImplementation
		, { maximumEditBytes: 128 * 1024 * 1024 }));
const directory = await mkdtemp(join(
	tmpdir(), "lean-consumer-docker-evidence-exclusion-"));
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
	temporaryGit(["read-tree", consumerDockerEvidenceExclusionImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...consumerDockerEvidenceExclusionIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", consumerDockerEvidenceExclusionImplementation
	], { input: "Authenticate Docker evidence exclusion\n" }).trim();
	const integrationUpdates = [];
	for(const path of consumerDockerEvidenceExclusionIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, consumerDockerEvidenceExclusionImplementation
			, integrationCommit, { maximumEditBytes: 128 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of consumerDockerEvidenceExclusionHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(consumerDockerEvidenceExclusionHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "consumer-docker-evidence-exclusion-source-v1"
		, predecessorCommit: consumerDockerEvidenceExclusionPredecessor
		, implementationCommit: consumerDockerEvidenceExclusionImplementation
		, failedRun: { workflow: 41197560800, job: 124530096368 }
		, failure: {
			step: "Execute the clean consumer through Docker"
			, completedAt: "2026-10-31T12:32:45Z"
			, error: "write of 24576 bytes: No space left on device"
			, runnerDiskBeforeCleanupGiB: 86
			, runnerDiskAfterCleanupGiB: 108
			, checkoutGitGiB: 25
			, runnerDiskAfterCheckoutGiB: 34
		}
		, trackedTree
		, checkout: {
			fetchDepth: 1, sparse: true, coneMode: false
			, omitted: "docs/evidence", missingBlobFloor: 1000
			, gitKiBCeiling: 2097152, sourceKiBCeiling: 2097152
		}
		, buildSource: {
			mode: "sparse-path", snapshotsPerAttempt: 1
			, excluded: "docs/evidence"
			, flakeOutputs: ["universal-core-artifacts", "npm-package"]
			, consumer: "tests/consumer-node.test.mjs"
			, revisionBoundary: "Behavioral Docker acceptance uses the flake path input's deterministic zero-revision fallback. Publication and reproducibility gates separately require the exact Git revision."
		}
		, scope: "Exclude the 51.8 GB retained evidence corpus from the Docker consumer checkout after the exact hosted failure proved that a depth-one checkout still materialized the huge current tree. Require a blobless non-cone sparse checkout, fail closed on missing-blob and two independent size guards, and build both Nix outputs from one evidence-free tracked archive exposed as a path flake. Preserve the existing Docker builder, ownership checks, consumer behavior, exact transient retry and every type-surface claim. Refresh exactly 92 workflow citations and record zero semantic type-surface changes."
		, refreshedCitationCount
		, currentSourcePins: [{
			path: workflowPath, count: refreshedCitationCount
			, previous: previousWorkflowSha256, current: currentWorkflowSha256
		}]
		, semanticChanges: 0, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write("Recorded " + updates.length
		+ " implementation transitions, " + integrationUpdates.length
		+ " integration transitions and " + refreshedCitationCount
		+ " pins.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
