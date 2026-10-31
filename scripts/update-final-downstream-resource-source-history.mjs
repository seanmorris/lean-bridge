#!/usr/bin/env node
/**
 * Record the final downstream disk and audit-budget repair.
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
	finalDownstreamResourceHistoryAdditions
	, finalDownstreamResourceHistoryPath
	, finalDownstreamResourceImplementation
	, finalDownstreamResourceImplementationPaths
	, finalDownstreamResourceIntegrationPaths
	, finalDownstreamResourcePins
	, finalDownstreamResourcePredecessor
} from "../tests/helpers/final-downstream-resource-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-final-downstream-resource-source-history.mjs");
assert.equal(existsSync(finalDownstreamResourceHistoryPath), false
	, finalDownstreamResourceHistoryPath + " already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, finalDownstreamResourceImplementation);
assert.equal(git(["rev-parse"
	, finalDownstreamResourceImplementation + "^"]).trim()
, finalDownstreamResourcePredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, finalDownstreamResourcePredecessor
	, finalDownstreamResourceImplementation, "--"])
, [...finalDownstreamResourceImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, finalDownstreamResourcePredecessor
	, finalDownstreamResourceImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, finalDownstreamResourceImplementation + ":"
		+ finalDownstreamResourceHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...finalDownstreamResourceIntegrationPaths])
, [...finalDownstreamResourceIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...finalDownstreamResourceHistoryAdditions])
, [...finalDownstreamResourceHistoryAdditions].sort());

const inventoryPath = "docs/type-surface.v1.json";
const before = git(["show"
	, finalDownstreamResourcePredecessor + ":" + inventoryPath]);
const after = git(["show"
	, finalDownstreamResourceImplementation + ":" + inventoryPath]);
let restored = after;
for(const pin of finalDownstreamResourcePins)
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

const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
const job = workflow.match(
	/^ {2}php-multi-profile:\n[^]*?(?=^ {2}[a-z][a-z0-9-]*:\n)/mu)?.[0];
assert.ok(job);
assert.ok(job.indexOf("Free hosted runner disk before PHP-Wasm and Nix builds")
	< job.indexOf("Check out the exact revision"));
assert.match(job
	, /sudo rm -rf \/usr\/share\/dotnet \/usr\/local\/lib\/android \/opt\/ghc \/usr\/local\/\.ghcup \/opt\/hostedtoolcache\/CodeQL/u);
const reviewed = await readFile("tests/type-corpus-reviewed.test.mjs", "utf8");
assert.match(reviewed
	, /real reviewed-IR corpus records analysis and rejection without installed coverage"[\s\S]*timeout: 600_000/u);
assert.equal((reviewed.match(/timeout: 600_000/gu) ?? []).length, 1);

const updates = [];
for(const path of finalDownstreamResourceImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, finalDownstreamResourcePredecessor
		, finalDownstreamResourceImplementation
		, { maximumEditBytes: 128 * 1024 * 1024 }));
const directory = await mkdtemp(join(
	tmpdir(), "lean-final-downstream-resource-"));
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
	temporaryGit(["read-tree", finalDownstreamResourceImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...finalDownstreamResourceIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", finalDownstreamResourceImplementation
	], { input: "Authenticate final downstream resource repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of finalDownstreamResourceIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, finalDownstreamResourceImplementation, integrationCommit
			, { maximumEditBytes: 128 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of finalDownstreamResourceHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(finalDownstreamResourceHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "final-downstream-resource-source-v1"
		, predecessorCommit: finalDownstreamResourcePredecessor
		, implementationCommit: finalDownstreamResourceImplementation
		, failedRun: {
			workflow: 41170510578
			, phpWasmMixedProfileJob: 124447261182
			, reviewedIrAdmissionJob: 124447261198
		}
		, phpWasmFailure: "hosted runner ENOSPC"
		, phpWasmFailedAt: "2026-10-31T05:20:37Z"
		, reviewedIrFailure: "180-second Node test timeout"
		, reviewedIrFailedAt: "2026-10-31T05:26:49Z"
		, reviewedIrHistoricalSuccess: {
			workflow: 40756907807, job: 123063687168
			, durationMilliseconds: 105905.541131
		}
		, diskCleanupBeforeCheckout: true
		, reviewedIrTestTimeoutMilliseconds: 600000
		, reviewedIrJobTimeoutMinutes: 60
		, scope: "Reclaim unused hosted image toolchains before the PHP-Wasm mixed-profile checkout and Nix store expansion. Raise only the intentionally complete reviewed-IR corpus test budget from three to ten minutes while retaining the one-hour job cap and every semantic assertion. Refresh exactly 117 source citations; preserve every type-surface observation and evidence identity."
		, refreshedCitationCount: finalDownstreamResourcePins
			.reduce((total, pin) => total + pin.count, 0)
		, semanticChanges: 0, typeSurfaceCounts
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write("Recorded " + updates.length
		+ " implementation transitions, " + integrationUpdates.length
		+ " integration transitions and 117 pins.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
