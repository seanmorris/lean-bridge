#!/usr/bin/env node
/**
 * Record the release-gate partial-clone repair.
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
	vo1220ReleaseGatePartialCloneRepairAddedPaths
	, vo1220ReleaseGatePartialCloneRepairHistoryPath
	, vo1220ReleaseGatePartialCloneRepairImplementation
	, vo1220ReleaseGatePartialCloneRepairImplementationPaths
	, vo1220ReleaseGatePartialCloneRepairIntegrationPaths
	, vo1220ReleaseGatePartialCloneRepairPredecessor
} from "../tests/helpers/vo1220-release-gate-partial-clone-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-vo1220-release-gate-partial-clone-repair-source-history.mjs");
assert.equal(existsSync(vo1220ReleaseGatePartialCloneRepairHistoryPath), false);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, vo1220ReleaseGatePartialCloneRepairImplementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, vo1220ReleaseGatePartialCloneRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, vo1220ReleaseGatePartialCloneRepairPredecessor
	, vo1220ReleaseGatePartialCloneRepairImplementation])
, [...vo1220ReleaseGatePartialCloneRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...vo1220ReleaseGatePartialCloneRepairIntegrationPaths])
, [...vo1220ReleaseGatePartialCloneRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...vo1220ReleaseGatePartialCloneRepairAddedPaths])
, [...vo1220ReleaseGatePartialCloneRepairAddedPaths].sort());

const inventory = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
const cited = new Set(inventory.evidence.flatMap(item =>
	item.files.map(file => file.path)));
assert.deepEqual(vo1220ReleaseGatePartialCloneRepairImplementationPaths
	.filter(path => cited.has(path)), []);
const liveAudit = await auditCurrentSourcePins(inventory);
assert.deepEqual(liveAudit, {
	cohort: 2661, occurrences: 16326, findings: []
});
const updates = [];
for(const path of vo1220ReleaseGatePartialCloneRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, vo1220ReleaseGatePartialCloneRepairPredecessor
		, vo1220ReleaseGatePartialCloneRepairImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-release-gate-partial-clone-"));
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
	temporaryGit(["read-tree", vo1220ReleaseGatePartialCloneRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...vo1220ReleaseGatePartialCloneRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, vo1220ReleaseGatePartialCloneRepairImplementation
	], { input: "Authenticate release-gate partial-clone repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of vo1220ReleaseGatePartialCloneRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, vo1220ReleaseGatePartialCloneRepairImplementation
			, integrationCommit, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of vo1220ReleaseGatePartialCloneRepairAddedPaths)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(vo1220ReleaseGatePartialCloneRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "vo1220-release-gate-partial-clone-repair-v1"
			, predecessorCommit: vo1220ReleaseGatePartialCloneRepairPredecessor
			, implementationCommit: vo1220ReleaseGatePartialCloneRepairImplementation
			, integrationCommit
			, hostedFailure: {
				run: 43301840437, job: 131474757891, step: 6
				, conclusion: "failure"
				, candidate: vo1220ReleaseGatePartialCloneRepairPredecessor
				, code: "build-command-failed"
				, diagnostic: "resource exhausted (error code: 28, no space left on device)"
			}
			, rootCause: "The release workflow fetched the complete repository history without a partial-clone filter. The local exact-candidate object database contains a 25.25 GiB historical pack, so the hosted checkout consumed the disk headroom needed to build the native Lean core in Nix. The build stopped at Init.Notation with ENOSPC before producing either release candidate."
			, scope: "Keep fetch-depth zero and the non-shallow complete commit graph, but use blob:none so historical payloads stay promised unless the exact release tree addresses them. Prove that a blob-filtered non-shallow clone whose origin is unavailable can still prepare both independent source trees. Change no release artifact, runtime, proof, support observation, package contract, public citation or prior receipt."
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
	process.stdout.write("Recorded exact release-gate partial-clone repair.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
