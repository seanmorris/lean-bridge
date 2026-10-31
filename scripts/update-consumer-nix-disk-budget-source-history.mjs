#!/usr/bin/env node
/**
 * Record the complete Consumer Matrix Nix disk-budget repair.
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
	consumerNixDiskBudgetHistoryAdditions
	, consumerNixDiskBudgetHistoryPath
	, consumerNixDiskBudgetImplementation
	, consumerNixDiskBudgetImplementationPaths
	, consumerNixDiskBudgetIntegrationPaths
	, consumerNixDiskBudgetPins
	, consumerNixDiskBudgetPredecessor
} from "../tests/helpers/consumer-nix-disk-budget-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-consumer-nix-disk-budget-source-history.mjs");
assert.equal(existsSync(consumerNixDiskBudgetHistoryPath), false
	, consumerNixDiskBudgetHistoryPath + " already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, consumerNixDiskBudgetImplementation);
assert.equal(git(["rev-parse"
	, consumerNixDiskBudgetImplementation + "^"]).trim()
, consumerNixDiskBudgetPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, consumerNixDiskBudgetPredecessor
	, consumerNixDiskBudgetImplementation, "--"])
, [...consumerNixDiskBudgetImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, consumerNixDiskBudgetPredecessor
	, consumerNixDiskBudgetImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, consumerNixDiskBudgetImplementation + ":"
		+ consumerNixDiskBudgetHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...consumerNixDiskBudgetIntegrationPaths])
, [...consumerNixDiskBudgetIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...consumerNixDiskBudgetHistoryAdditions])
, [...consumerNixDiskBudgetHistoryAdditions].sort());

const inventoryPath = "docs/type-surface.v1.json";
const before = git(["show"
	, consumerNixDiskBudgetPredecessor + ":" + inventoryPath]);
const after = git(["show"
	, consumerNixDiskBudgetImplementation + ":" + inventoryPath]);
let restored = after;
for(const pin of consumerNixDiskBudgetPins)
{
	restored = restored.replaceAll(pin.current, pin.previous);
	assert.equal(after.split(pin.current).length - 1, pin.count);
	assert.equal(after.includes(pin.previous), false);
	assert.equal(sha256(await readFile(pin.path)), pin.current);
}
assert.equal(restored, before);
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
const expectedNixJobs = [
	"nix-cache", "node-consumers", "reviewed-fin-wasm-entry", "browser-consumer"
	, "php-wasm-receivers", "php-wasm-callback-results", "php-consumers"
	, "php-wasm-consumers", "php-wasm-corpus", "php-multi-profile"
	, "native-c-family-values", "native-consumers", "managed-consumers"
	, "owned-jvm-values", "host-null-systems", "owned-wit-receivers"
	, "wasi-consumer", "docker-engine"
];
const nixJobs = jobs.filter(([, body]) =>
	body.includes("cachix/install-nix-action@v31"));
assert.deepEqual(nixJobs.map(([id]) => id), expectedNixJobs);
const cleanup = "Free hosted runner disk before Nix-backed builds";
const command = "sudo rm -rf /usr/share/dotnet /usr/local/lib/android /opt/ghc /usr/local/.ghcup /opt/hostedtoolcache/CodeQL";
for(const [id, body] of nixJobs)
{
	assert.equal(body.split(cleanup).length - 1, id === "nix-cache" ? 0 : 1);
	assert.equal(body.split(command).length - 1, id === "nix-cache" ? 0 : 1);
	if(id === "nix-cache") continue;
	assert.ok(body.indexOf(cleanup) < body.indexOf("Check out the exact revision"));
	assert.ok(body.indexOf(cleanup) < body.indexOf("cachix/install-nix-action@v31"));
}

const updates = [];
for(const path of consumerNixDiskBudgetImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, consumerNixDiskBudgetPredecessor
		, consumerNixDiskBudgetImplementation
		, { maximumEditBytes: 128 * 1024 * 1024 }));
const directory = await mkdtemp(join(tmpdir(), "lean-consumer-nix-disk-budget-"));
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
	temporaryGit(["read-tree", consumerNixDiskBudgetImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...consumerNixDiskBudgetIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", consumerNixDiskBudgetImplementation
	], { input: "Authenticate complete Consumer Matrix disk budget\n" }).trim();
	const integrationUpdates = [];
	for(const path of consumerNixDiskBudgetIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, consumerNixDiskBudgetImplementation, integrationCommit
			, { maximumEditBytes: 128 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of consumerNixDiskBudgetHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(consumerNixDiskBudgetHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "consumer-nix-disk-budget-source-v1"
		, predecessorCommit: consumerNixDiskBudgetPredecessor
		, implementationCommit: consumerNixDiskBudgetImplementation
		, failedRun: { workflow: 41170510578, job: 124447261275 }
		, failure: "hosted runner ENOSPC"
		, failedAt: "2026-10-31T05:36:38Z"
		, failedStep: "Execute the clean consumer through Docker"
		, nixJobs: nixJobs.length
		, diskBudgetedNixJobs: nixJobs.length - 1
		, excludedNixJobs: ["nix-cache"]
		, diskCleanupBeforeCheckout: true
		, scope: "Inventory every current Consumer Matrix job that installs Nix. Reclaim only unused hosted-image toolchains before checkout in all seventeen Nix-backed build jobs, while retaining the sparse signing-only Nix recipe job without cleanup. Aggregate inventory, count, command and ordering mismatches so one stale job cannot hide the rest. Refresh exactly 117 source citations; preserve every type-surface observation and evidence identity."
		, refreshedCitationCount: consumerNixDiskBudgetPins
			.reduce((total, pin) => total + pin.count, 0)
		, semanticChanges: 0, typeSurfaceCounts
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write("Recorded " + updates.length
		+ " implementation transitions, " + integrationUpdates.length
		+ " integration transitions, 17 disk-budgeted Nix jobs and 117 pins.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
