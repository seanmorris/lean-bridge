#!/usr/bin/env node
/**
 * Record the component clone-lifetime contract repair.
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
	vo1220ComponentCloneContractRepairAddedPaths
	, vo1220ComponentCloneContractRepairHistoryPath
	, vo1220ComponentCloneContractRepairImplementation
	, vo1220ComponentCloneContractRepairImplementationPaths
	, vo1220ComponentCloneContractRepairIntegrationPaths
	, vo1220ComponentCloneContractRepairPredecessor
} from "../tests/helpers/vo1220-component-clone-contract-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-vo1220-component-clone-contract-repair-source-history.mjs");
assert.equal(existsSync(vo1220ComponentCloneContractRepairHistoryPath), false);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, vo1220ComponentCloneContractRepairImplementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, vo1220ComponentCloneContractRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, vo1220ComponentCloneContractRepairPredecessor
	, vo1220ComponentCloneContractRepairImplementation])
, [...vo1220ComponentCloneContractRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...vo1220ComponentCloneContractRepairIntegrationPaths])
, [...vo1220ComponentCloneContractRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...vo1220ComponentCloneContractRepairAddedPaths])
, [...vo1220ComponentCloneContractRepairAddedPaths].sort());

const inventory = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
const cited = new Set(inventory.evidence.flatMap(item =>
	item.files.map(file => file.path)));
assert.deepEqual(vo1220ComponentCloneContractRepairImplementationPaths
	.filter(path => cited.has(path)), []);
const liveAudit = await auditCurrentSourcePins(inventory);
assert.deepEqual(liveAudit, {
	cohort: 2661, occurrences: 16326, findings: []
});
const updates = [];
for(const path of vo1220ComponentCloneContractRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, vo1220ComponentCloneContractRepairPredecessor
		, vo1220ComponentCloneContractRepairImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-component-clone-contract-"));
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
	temporaryGit(["read-tree", vo1220ComponentCloneContractRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...vo1220ComponentCloneContractRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, vo1220ComponentCloneContractRepairImplementation
	], { input: "Authenticate component clone-lifetime contract repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of vo1220ComponentCloneContractRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, vo1220ComponentCloneContractRepairImplementation
			, integrationCommit, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of vo1220ComponentCloneContractRepairAddedPaths)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(vo1220ComponentCloneContractRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "vo1220-component-clone-contract-repair-v1"
			, predecessorCommit: vo1220ComponentCloneContractRepairPredecessor
			, implementationCommit: vo1220ComponentCloneContractRepairImplementation
			, integrationCommit
			, hostedFailure: {
				run: 43298549752, job: 131463236381, test: 16
				, conclusion: "failure"
				, candidate: vo1220ComponentCloneContractRepairPredecessor
			}
			, review: {
				pullRequest: 10, comment: 4555997123, severity: "high"
				, commit: vo1220ComponentCloneContractRepairPredecessor
			}
			, rootCause: "The product correctly added --dissociate, but the complete release-authorization suite retained a source-token assertion for the prior --local --no-checkout sequence. The stale assertion stopped the gate before either release build."
			, scope: "Name the actual storage-lifetime contract and require --local --dissociate --no-checkout in the one current release-gate source assertion; preserve the immutable historical verifier at its original milestone; change no product source, artifact, support observation, proof, package contract, public citation or prior receipt."
			, localValidation: {
				releaseAuthorization: { passed: 24, failed: 0 }
				, scopedLint: "passed"
			}
			, refreshedPins: 0
			, liveSourcePaths: liveAudit.cohort
			, liveSourceOccurrences: liveAudit.occurrences
			, remainingMismatches: 0
			, updates, integrationUpdates, additions
		}), { flag: "wx" });
	process.stdout.write("Recorded exact component clone-lifetime contract repair.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
