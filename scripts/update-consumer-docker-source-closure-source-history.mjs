#!/usr/bin/env node
/**
 * Record the bounded Docker consumer source-closure repair.
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
	consumerDockerSourceClosureHistoryAdditions
	, consumerDockerSourceClosureHistoryPath
	, consumerDockerSourceClosureImplementation
	, consumerDockerSourceClosureImplementationAdditions
	, consumerDockerSourceClosureImplementationPaths
	, consumerDockerSourceClosureIntegrationPaths
	, consumerDockerSourceClosurePredecessor
} from "../tests/helpers/consumer-docker-source-closure-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-consumer-docker-source-closure-source-history.mjs");
assert.equal(existsSync(consumerDockerSourceClosureHistoryPath), false
	, consumerDockerSourceClosureHistoryPath + " already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, consumerDockerSourceClosureImplementation);
assert.equal(git(["rev-parse"
	, consumerDockerSourceClosureImplementation + "^"]).trim()
, consumerDockerSourceClosurePredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, consumerDockerSourceClosurePredecessor
	, consumerDockerSourceClosureImplementation, "--"])
, [...consumerDockerSourceClosureImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, consumerDockerSourceClosurePredecessor
	, consumerDockerSourceClosureImplementation, "--"])
, [...consumerDockerSourceClosureImplementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, consumerDockerSourceClosureImplementation + ":"
		+ consumerDockerSourceClosureHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...consumerDockerSourceClosureIntegrationPaths])
, [...consumerDockerSourceClosureIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...consumerDockerSourceClosureHistoryAdditions])
, [...consumerDockerSourceClosureHistoryAdditions].sort());

const inventoryPath = "docs/type-surface.v1.json";
const before = git(["show"
	, consumerDockerSourceClosurePredecessor + ":" + inventoryPath]);
const after = git(["show"
	, consumerDockerSourceClosureImplementation + ":" + inventoryPath]);
const currentSourcePins = [];
let restored = after;
for(const path of [
	".github/workflows/consumer-matrix.yml", "tests/documentation.test.mjs"
]) {
	const previous = sha256(git(["show"
		, consumerDockerSourceClosurePredecessor + ":" + path]));
	const current = sha256(git(["show"
		, consumerDockerSourceClosureImplementation + ":" + path]));
	const count = after.split(current).length - 1;
	assert.ok(count > 0, path);
	assert.equal(after.includes(previous), false, path);
	restored = restored.replaceAll(current, previous);
	currentSourcePins.push({ path, count, previous, current });
}
assert.equal(restored, before);
const refreshedCitationCount = currentSourcePins
	.reduce((total, pin) => total + pin.count, 0);
assert.equal(refreshedCitationCount, 117);
const inventory = JSON.parse(after);
const typeSurfaceCounts = Object.fromEntries([
	"evidence", "observations", "paths", "positions", "profiles", "stages"
].map(key => [key, inventory[key].length]));

const workflow = await readFile(
	".github/workflows/consumer-matrix.yml", "utf8");
const starts = [...workflow.matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)]
	.map(match => ({ id: match[1], index: match.index }));
const jobs = starts.map((start, index) => [start.id
	, workflow.slice(start.index, starts[index + 1]?.index ?? workflow.length)]);
const dockerJobs = jobs.filter(([id]) => id === "docker-engine");
assert.equal(dockerJobs.length, 1);
const dockerJob = dockerJobs[0][1];
const mismatches = [];
const check = (label, passed) => {
	if(!passed) mismatches.push(label);
};
check("shallow checkout", /^ {10}fetch-depth: 1$/mu.test(dockerJob));
check("no full checkout", !/^ {10}fetch-depth: 0$/mu.test(dockerJob));
check("Git shallow guard"
	, /git rev-parse --is-shallow-repository/u.test(dockerJob));
check("one-commit guard", /git rev-list --count HEAD/u.test(dockerJob));
check("no toolchain cache", !/actions\/cache|\.toolchains/u.test(dockerJob));
check("no duplicate bootstrap", !/npm run bootstrap/u.test(dockerJob));
for(const command of [
	"npm ci --ignore-scripts", "npm run build:builder-image"
	, "npm run test:builder-ownership", "npm run test:consumer:docker-ci"
]) check(command, dockerJob.includes(command));
assert.deepEqual(mismatches, []);

const updates = [];
for(const path of consumerDockerSourceClosureImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, consumerDockerSourceClosurePredecessor
		, consumerDockerSourceClosureImplementation
		, { maximumEditBytes: 128 * 1024 * 1024 }));
const implementationAdditions = [];
for(const path of consumerDockerSourceClosureImplementationAdditions)
	implementationAdditions.push({ path
		, sha256: sha256(git(["show"
			, consumerDockerSourceClosureImplementation + ":" + path])) });
const directory = await mkdtemp(join(
	tmpdir(), "lean-consumer-docker-source-closure-"));
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
	temporaryGit(["read-tree", consumerDockerSourceClosureImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...consumerDockerSourceClosureIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", consumerDockerSourceClosureImplementation
	], { input: "Authenticate Docker consumer source closure\n" }).trim();
	const integrationUpdates = [];
	for(const path of consumerDockerSourceClosureIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, consumerDockerSourceClosureImplementation, integrationCommit
			, { maximumEditBytes: 128 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of consumerDockerSourceClosureHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(consumerDockerSourceClosureHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "consumer-docker-source-closure-source-v1"
		, predecessorCommit: consumerDockerSourceClosurePredecessor
		, implementationCommit: consumerDockerSourceClosureImplementation
		, failedRun: { workflow: 41189690848, job: 124506591222 }
		, priorFailedRun: { workflow: 41170510578, job: 124447261275 }
		, phpWasmFailedRun: {
			workflow: 41189690848, job: 124506591191
			, failedAt: "2026-10-31T10:56:45Z"
			, failedStep: "Verify callback-result owners and installed packages"
			, error: "retained producer tree unavailable in shallow checkout"
		}
		, failure: "hosted runner ENOSPC"
		, failedAt: "2026-10-31T10:40:39Z"
		, failedStep: "Execute the clean consumer through Docker"
		, localInventory: {
			tests: 870, passed: 866, failed: 4
			, failedTests: [
				"Core/PHP CI input repair refreshes all 93 live citations"
				, "dependent Fin compiler repair refreshes exactly four live citations"
				, "final Core test repair closes all nine registrations and 102 pins"
				, "proof evidence audit binds 102 exact cells and preserves 102 gaps"
			]
		}
		, checkoutDepth: 1
		, removedUnusedToolchainBootstrap: true
		, phpWasmProducerFetch: {
			producer: "39a82da8a81730db7d576b706011f20ea4a29892"
			, sourceMapFiles: 17, importClosureFiles: 114
			, fetchedClosureFiles: 122, maxRequiredBlobBytes: 70669
			, filterBlobLimitBytes: 131072
		}
		, scope: "Bound the Docker consumer source closure after two exact hosted-runner ENOSPC failures. Check out one commit, prove that closure in CI, and omit the redundant compiler-toolchain cache and bootstrap while retaining the same Nix/Docker builder, ownership and clean-consumer commands. Restore the PHP-Wasm callback replay's exact retained producer through a negotiation-free, depth-one, 128 KiB-filtered fetch that covers all 122 required source-map and import-closure files without restoring full history. Inventory all 870 tests in the containing Core partition before repair; replace all four stale present-versus-historical comparisons with exact immutable-milestone reconstruction. Refresh exactly 117 source citations; preserve every type-surface observation, evidence identity and exact #1220 cell/stage contract."
		, refreshedCitationCount, currentSourcePins
		, semanticChanges: 0, typeSurfaceCounts, updates
		, implementationAdditions, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write("Recorded " + updates.length
		+ " implementation transitions, " + integrationUpdates.length
		+ " integration transitions and 117 pins.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
