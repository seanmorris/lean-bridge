#!/usr/bin/env node
/**
 * Record the bounded discard-only Docker log repair and public pins.
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
	vo1220ReleaseDockerLogBoundAddedPaths
	, vo1220ReleaseDockerLogBoundHistoryPath
	, vo1220ReleaseDockerLogBoundImplementation
	, vo1220ReleaseDockerLogBoundImplementationPaths
	, vo1220ReleaseDockerLogBoundIntegrationPaths
	, vo1220ReleaseDockerLogBoundPinPaths
	, vo1220ReleaseDockerLogBoundPinRefresh
	, vo1220ReleaseDockerLogBoundPredecessor
} from "../tests/helpers/vo1220-release-docker-log-bound-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-vo1220-release-docker-log-bound-source-history.mjs");
assert.equal(existsSync(vo1220ReleaseDockerLogBoundHistoryPath), false);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, vo1220ReleaseDockerLogBoundPinRefresh);
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, vo1220ReleaseDockerLogBoundImplementation);
assert.equal(git(["rev-parse", "HEAD^^"]).trim()
	, vo1220ReleaseDockerLogBoundPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, vo1220ReleaseDockerLogBoundPredecessor
	, vo1220ReleaseDockerLogBoundImplementation])
, [...vo1220ReleaseDockerLogBoundImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only"
	, vo1220ReleaseDockerLogBoundImplementation
	, vo1220ReleaseDockerLogBoundPinRefresh])
, [...vo1220ReleaseDockerLogBoundPinPaths]);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...vo1220ReleaseDockerLogBoundIntegrationPaths])
, [...vo1220ReleaseDockerLogBoundIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...vo1220ReleaseDockerLogBoundAddedPaths])
, [...vo1220ReleaseDockerLogBoundAddedPaths].sort());

const inventoryPath = "docs/type-surface.v1.json";
const predecessorInventory = JSON.parse(git(["show"
	, `${vo1220ReleaseDockerLogBoundPredecessor}:${inventoryPath}`]));
const implementationInventory = JSON.parse(git(["show"
	, `${vo1220ReleaseDockerLogBoundImplementation}:${inventoryPath}`]));
const currentInventory = JSON.parse(git(["show"
	, `${vo1220ReleaseDockerLogBoundPinRefresh}:${inventoryPath}`]));
assert.deepEqual(implementationInventory, predecessorInventory);
assert.deepEqual(currentInventory.profiles, predecessorInventory.profiles);
assert.deepEqual(currentInventory.observations, predecessorInventory.observations);
const pinIdentities = {
	"src/build/canonical-build.mjs": {
		previous: "b138fc2f2bd26ed473cf98bb54ba81a14f47a7aa919209e48f9c81314f6d6c06"
		, current: "ddc0e8c14779a66a81324b52ded29a0a26e0c0199868e711aaddfb757fc5dfdf"
		, count: 16
	}
	, "src/build/process-runner.mjs": {
		previous: "173a41bf2009d62c2040cb05d5720bf909907ab0e9a6f56167af751cb51e5b94"
		, current: "8a19507e49834ddb628ae022eeafb3ab696c30de953d779b81f6ad32165e236c"
		, count: 2
	}
};
for(const [path, identity] of Object.entries(pinIdentities))
{
	assert.equal(sha256(git(["show"
		, `${vo1220ReleaseDockerLogBoundImplementation}:${path}`]))
	, identity.current, path);
	const before = predecessorInventory.evidence.flatMap(item => item.files)
		.filter(file => file.path === path);
	const after = currentInventory.evidence.flatMap(item => item.files)
		.filter(file => file.path === path);
	assert.equal(before.length, identity.count, path);
	assert.equal(after.length, identity.count, path);
	assert.deepEqual([...new Set(before.map(file => file.sha256))]
		, [identity.previous], path);
	assert.deepEqual([...new Set(after.map(file => file.sha256))]
		, [identity.current], path);
}
const liveAudit = await auditCurrentSourcePins(currentInventory);
assert.deepEqual(liveAudit, {
	cohort: 2661, occurrences: 16326, findings: []
});

const updates = [];
for(const path of vo1220ReleaseDockerLogBoundImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, vo1220ReleaseDockerLogBoundPredecessor
		, vo1220ReleaseDockerLogBoundImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));
const pinUpdates = [];
for(const path of vo1220ReleaseDockerLogBoundPinPaths)
	pinUpdates.push(await gitSourceHistoryTransition(path
		, vo1220ReleaseDockerLogBoundImplementation
		, vo1220ReleaseDockerLogBoundPinRefresh
		, { maximumEditBytes: 64 * 1024 * 1024 }));
const directory = await mkdtemp(join(tmpdir(), "lean-release-docker-log-"));
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
	temporaryGit(["read-tree", vo1220ReleaseDockerLogBoundPinRefresh]);
	temporaryGit(["add", "--sparse", "--"
		, ...vo1220ReleaseDockerLogBoundIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", vo1220ReleaseDockerLogBoundPinRefresh
	], { input: "Authenticate bounded release Docker logs\n" }).trim();
	const integrationUpdates = [];
	for(const path of vo1220ReleaseDockerLogBoundIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, vo1220ReleaseDockerLogBoundPinRefresh, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of vo1220ReleaseDockerLogBoundAddedPaths)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(vo1220ReleaseDockerLogBoundHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "vo1220-release-docker-log-bound-v1"
		, predecessorCommit: vo1220ReleaseDockerLogBoundPredecessor
		, implementationCommit: vo1220ReleaseDockerLogBoundImplementation
		, pinRefreshCommit: vo1220ReleaseDockerLogBoundPinRefresh
		, integrationCommit
		, failedRun: {
			workflow: 43282516528, job: 131407244760
			, code: "build-output-limit"
			, failure: "Docker exceeded the 32 MiB diagnostic limit"
		}
		, rootCause: "The generic process runner correctly bounded parsed command output, but the release path applied the same kill policy to Docker build and run logs that callers intentionally discard. A normal isolated Nix build exceeded 32 MiB and was killed before semantic release comparison."
		, scope: "Preserve the strict fail-closed output limit for every ordinary or parsed command; give only the two discard-only Docker build/run calls an explicit 1 MiB-per-stream bounded-tail policy; retain observed/truncated diagnostics on failure; refresh the complete 18-pin public citation cohort; change no release artifact, support observation, proof, package contract or immutable prior receipt."
		, boundedCommands: 2, boundedTailBytesPerStream: 1024 * 1024
		, defaultPolicy: "fail", boundedPolicy: "bounded-tail"
		, refreshedPins: 18
		, pinCounts: Object.fromEntries(Object.entries(pinIdentities)
			.map(([path, identity]) => [path, identity.count]))
		, liveSourcePaths: liveAudit.cohort
		, liveSourceOccurrences: liveAudit.occurrences
		, remainingMismatches: 0
		, updates, pinUpdates, integrationUpdates, additions
	}), { flag: "wx" });
	process.stdout.write("Recorded bounded Docker logs and 18 public-pin updates.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
