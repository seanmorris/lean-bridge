#!/usr/bin/env node
/**
 * Record the Docker-visible shared Git object-store repair and public pins.
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
	vo1220ReleaseDockerGitMountAddedPaths
	, vo1220ReleaseDockerGitMountHistoryPath
	, vo1220ReleaseDockerGitMountImplementation
	, vo1220ReleaseDockerGitMountImplementationPaths
	, vo1220ReleaseDockerGitMountIntegrationPaths
	, vo1220ReleaseDockerGitMountPinPaths
	, vo1220ReleaseDockerGitMountPinRefresh
	, vo1220ReleaseDockerGitMountPredecessor
} from "../tests/helpers/vo1220-release-docker-git-mount-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-vo1220-release-docker-git-mount-source-history.mjs");
assert.equal(existsSync(vo1220ReleaseDockerGitMountHistoryPath), false);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, vo1220ReleaseDockerGitMountPinRefresh);
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, vo1220ReleaseDockerGitMountImplementation);
assert.equal(git(["rev-parse", "HEAD^^"]).trim()
	, vo1220ReleaseDockerGitMountPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, vo1220ReleaseDockerGitMountPredecessor
	, vo1220ReleaseDockerGitMountImplementation])
, [...vo1220ReleaseDockerGitMountImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only"
	, vo1220ReleaseDockerGitMountImplementation
	, vo1220ReleaseDockerGitMountPinRefresh])
, [...vo1220ReleaseDockerGitMountPinPaths]);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...vo1220ReleaseDockerGitMountIntegrationPaths])
, [...vo1220ReleaseDockerGitMountIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...vo1220ReleaseDockerGitMountAddedPaths])
, [...vo1220ReleaseDockerGitMountAddedPaths].sort());

const inventoryPath = "docs/type-surface.v1.json";
const predecessorInventory = JSON.parse(git(["show"
	, `${vo1220ReleaseDockerGitMountPredecessor}:${inventoryPath}`]));
const implementationInventory = JSON.parse(git(["show"
	, `${vo1220ReleaseDockerGitMountImplementation}:${inventoryPath}`]));
const currentInventory = JSON.parse(git(["show"
	, `${vo1220ReleaseDockerGitMountPinRefresh}:${inventoryPath}`]));
assert.deepEqual(implementationInventory, predecessorInventory);
assert.deepEqual(currentInventory.profiles, predecessorInventory.profiles);
assert.deepEqual(currentInventory.observations, predecessorInventory.observations);
const identity = {
	previous: "ddc0e8c14779a66a81324b52ded29a0a26e0c0199868e711aaddfb757fc5dfdf"
	, current: "aaf5182db69b9ad1704f2d1f11b9619d3f27f3a67ae8701d0cb27f69246aefaf"
	, count: 16
};
assert.equal(sha256(git(["show"
	, `${vo1220ReleaseDockerGitMountImplementation}:src/build/canonical-build.mjs`]))
, identity.current);
const before = predecessorInventory.evidence.flatMap(item => item.files)
	.filter(file => file.path === "src/build/canonical-build.mjs");
const after = currentInventory.evidence.flatMap(item => item.files)
	.filter(file => file.path === "src/build/canonical-build.mjs");
assert.equal(before.length, identity.count);
assert.equal(after.length, identity.count);
assert.deepEqual([...new Set(before.map(file => file.sha256))]
	, [identity.previous]);
assert.deepEqual([...new Set(after.map(file => file.sha256))]
	, [identity.current]);
const liveAudit = await auditCurrentSourcePins(currentInventory);
assert.deepEqual(liveAudit, {
	cohort: 2661, occurrences: 16326, findings: []
});

const updates = [];
for(const path of vo1220ReleaseDockerGitMountImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, vo1220ReleaseDockerGitMountPredecessor
		, vo1220ReleaseDockerGitMountImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));
const pinUpdates = [];
for(const path of vo1220ReleaseDockerGitMountPinPaths)
	pinUpdates.push(await gitSourceHistoryTransition(path
		, vo1220ReleaseDockerGitMountImplementation
		, vo1220ReleaseDockerGitMountPinRefresh
		, { maximumEditBytes: 64 * 1024 * 1024 }));
const directory = await mkdtemp(join(tmpdir(), "lean-release-docker-git-"));
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
	temporaryGit(["read-tree", vo1220ReleaseDockerGitMountPinRefresh]);
	temporaryGit(["add", "--sparse", "--"
		, ...vo1220ReleaseDockerGitMountIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", vo1220ReleaseDockerGitMountPinRefresh
	], { input: "Authenticate Docker-visible shared Git objects\n" }).trim();
	const integrationUpdates = [];
	for(const path of vo1220ReleaseDockerGitMountIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, vo1220ReleaseDockerGitMountPinRefresh, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of vo1220ReleaseDockerGitMountAddedPaths)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(vo1220ReleaseDockerGitMountHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "vo1220-release-docker-git-mount-v1"
		, predecessorCommit: vo1220ReleaseDockerGitMountPredecessor
		, implementationCommit: vo1220ReleaseDockerGitMountImplementation
		, pinRefreshCommit: vo1220ReleaseDockerGitMountPinRefresh
		, integrationCommit
		, review: {
			pullRequest: 10, comment: 4555023212
			, commit: vo1220ReleaseDockerGitMountPredecessor
			, severity: "high"
		}
		, rootCause: "The storage-safe universal release checkouts use Git alternates, but the Docker backend mounted only the checkout at /workspace/source. The alternates file therefore named an absolute object-store path absent inside the container, so the same committed checkout was readable on the host and incomplete in Docker."
		, scope: "Resolve linked-worktree administration and the complete recursive alternate-object closure; bind only required external directories at the paths encoded by Git; keep every added mount read-only; fail closed on missing, malformed, oversized or Docker-inexpressible closure paths; retain shared-object storage and the strict source mount; refresh the complete sixteen-pin public citation cohort; change no release artifact, support observation, proof, package contract or immutable prior receipt."
		, dockerSourceRoot: "/workspace/source"
		, maximumAlternateDirectories: 64
		, readOnlyExternalMounts: true
		, refreshedPins: identity.count
		, pinCounts: { "src/build/canonical-build.mjs": identity.count }
		, liveSourcePaths: liveAudit.cohort
		, liveSourceOccurrences: liveAudit.occurrences
		, remainingMismatches: 0
		, updates, pinUpdates, integrationUpdates, additions
	}), { flag: "wx" });
	process.stdout.write("Recorded Docker-visible shared Git objects and 16 public-pin updates.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
