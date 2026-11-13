#!/usr/bin/env node
/**
 * Record the component clone source-metadata repair.
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
	vo1220ComponentCloneSourceMetadataRepairAddedPaths
	, vo1220ComponentCloneSourceMetadataRepairHistoryPath
	, vo1220ComponentCloneSourceMetadataRepairImplementation
	, vo1220ComponentCloneSourceMetadataRepairImplementationPaths
	, vo1220ComponentCloneSourceMetadataRepairIntegrationPaths
	, vo1220ComponentCloneSourceMetadataRepairPredecessor
} from "../tests/helpers/vo1220-component-clone-source-metadata-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-vo1220-component-clone-source-metadata-repair-source-history.mjs");
assert.equal(existsSync(
	vo1220ComponentCloneSourceMetadataRepairHistoryPath), false);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, vo1220ComponentCloneSourceMetadataRepairImplementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, vo1220ComponentCloneSourceMetadataRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, vo1220ComponentCloneSourceMetadataRepairPredecessor
	, vo1220ComponentCloneSourceMetadataRepairImplementation])
, [...vo1220ComponentCloneSourceMetadataRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...vo1220ComponentCloneSourceMetadataRepairIntegrationPaths])
, [...vo1220ComponentCloneSourceMetadataRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...vo1220ComponentCloneSourceMetadataRepairAddedPaths])
, [...vo1220ComponentCloneSourceMetadataRepairAddedPaths].sort());

const inventory = JSON.parse(await readFile(
	"docs/type-surface.v1.json", "utf8"));
const liveAudit = await auditCurrentSourcePins(inventory);
assert.deepEqual(liveAudit, {
	cohort: 2661, occurrences: 16326, findings: []
});
const updates = [];
for(const path of vo1220ComponentCloneSourceMetadataRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, vo1220ComponentCloneSourceMetadataRepairPredecessor
		, vo1220ComponentCloneSourceMetadataRepairImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-component-clone-source-metadata-"));
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
		, vo1220ComponentCloneSourceMetadataRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...vo1220ComponentCloneSourceMetadataRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, vo1220ComponentCloneSourceMetadataRepairImplementation
	], { input: "Authenticate component clone source-metadata repair\n" })
		.trim();
	const integrationUpdates = [];
	for(const path of vo1220ComponentCloneSourceMetadataRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, vo1220ComponentCloneSourceMetadataRepairImplementation
			, integrationCommit, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of vo1220ComponentCloneSourceMetadataRepairAddedPaths)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(
		vo1220ComponentCloneSourceMetadataRepairHistoryPath, canonicalJson({
			schemaVersion: 1
			, milestone: "vo1220-component-clone-source-metadata-repair-v1"
			, predecessorCommit:
				vo1220ComponentCloneSourceMetadataRepairPredecessor
			, implementationCommit:
				vo1220ComponentCloneSourceMetadataRepairImplementation
			, integrationCommit
			, hostedFailure: {
				run: 43336952561, job: 131602330677
				, workflow: "Downstream package consumers"
				, jobName: "Node and browser npm consumers"
				, failingTest: "locked release dry run reproduces both clean clones and verifies publication evidence"
				, failure: "Release gate changed author files or Git metadata"
			}
			, rootCause: "The component release gate used git clone --local --dissociate. Git first hard-linked the source object database and then copied away from it, so link creation and removal changed source inode ctime and link metadata even though author bytes and release output remained unchanged. The strict release gate correctly rejected that source mutation."
			, repair: "Use git clone --shared --dissociate so the temporary clone borrows source objects through an alternates file and immediately copies them into an independent object database without mutating source inodes. Preserve the existing post-source-deletion ownership test, add an exact source metadata snapshot around preparation, and bind the current clone contract to the shared-and-dissociated form."
			, semantics: {
				releaseOutputChanges: 0, sourceMutationRepairs: 1
				, typeSurfaceChanges: 0, refreshedPins: 0
			}
			, localValidation: {
				cloneOwnership: { tests: 1, passed: 1, failed: 0 }
				, cloneContract: { tests: 1, passed: 1, failed: 0 }
				, exactHostedTest: { tests: 1, passed: 1, failed: 0
					, durationSeconds: 110 }
				, liveSourcePins: { paths: liveAudit.cohort
					, occurrences: liveAudit.occurrences, mismatches: 0 }
				, scopedLint: "passed"
			}
			, updates, integrationUpdates, additions
		}), { flag: "wx" });
	process.stdout.write(
		"Recorded exact component clone source-metadata repair.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
