#!/usr/bin/env node
/**
 * Record the complete history-hub fixed-point repair.
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
	coreHistoryHubFixedPointHistoryAdditions
	, coreHistoryHubFixedPointHistoryPath
	, coreHistoryHubFixedPointImplementation
	, coreHistoryHubFixedPointImplementationPaths
	, coreHistoryHubFixedPointIntegrationPaths
	, coreHistoryHubFixedPointPredecessor
} from "../tests/helpers/core-history-hub-fixed-point-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-core-history-hub-fixed-point-source-history.mjs");
assert.equal(existsSync(coreHistoryHubFixedPointHistoryPath), false
	, coreHistoryHubFixedPointHistoryPath + " already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, coreHistoryHubFixedPointImplementation);
assert.equal(git(["rev-parse"
	, coreHistoryHubFixedPointImplementation + "^"]).trim()
, coreHistoryHubFixedPointPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, coreHistoryHubFixedPointPredecessor
	, coreHistoryHubFixedPointImplementation, "--"])
, [...coreHistoryHubFixedPointImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, coreHistoryHubFixedPointPredecessor
	, coreHistoryHubFixedPointImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, coreHistoryHubFixedPointImplementation + ":"
		+ coreHistoryHubFixedPointHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...coreHistoryHubFixedPointIntegrationPaths])
, [...coreHistoryHubFixedPointIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreHistoryHubFixedPointHistoryAdditions])
, [...coreHistoryHubFixedPointHistoryAdditions].sort());

const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurfaceBefore = git(["show"
	, coreHistoryHubFixedPointPredecessor + ":" + typeSurfacePath]);
const typeSurfaceAfter = git(["show"
	, coreHistoryHubFixedPointImplementation + ":" + typeSurfacePath]);
assert.equal(typeSurfaceAfter, typeSurfaceBefore);
const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModel = git(["show"
	, coreHistoryHubFixedPointImplementation + ":" + exactModelPath]);
assert.equal(sha256(exactModel)
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
assert.equal(Buffer.byteLength(exactModel), 16916757);
const exact = JSON.parse(exactModel);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const legacyEndpointPattern
	= /const source = (before(?!FinRefinementSource)[A-Za-z0-9_]+Source)\(\s*update\.path\s*,\s*await readFile\(\s*update\.path\s*,\s*"utf8"\s*\)\s*(?:,\s*update\.currentSha256)?\s*\)/gu;
const exactEndpointPattern
	= /const source = beforeFinRefinementSource\(update\.path\s*,\s*await readFile\(update\.path, "utf8"\), update\.currentSha256\);/gu;
let legacyEndpointAdapters = 0;
for(const path of coreHistoryHubFixedPointImplementationPaths)
{
	const source = git(["show"
		, coreHistoryHubFixedPointImplementation + ":" + path]);
	assert.equal([...source.matchAll(legacyEndpointPattern)].length, 0, path);
	legacyEndpointAdapters += [...source.matchAll(exactEndpointPattern)].length;
}
assert.equal(legacyEndpointAdapters, 29);

const updates = [];
for(const path of coreHistoryHubFixedPointImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, coreHistoryHubFixedPointPredecessor
		, coreHistoryHubFixedPointImplementation
		, { maximumEditBytes: 128 * 1024 * 1024 }));
const directory = await mkdtemp(join(
	tmpdir(), "lean-core-history-hub-fixed-point-"));
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
	temporaryGit(["read-tree", coreHistoryHubFixedPointImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...coreHistoryHubFixedPointIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", coreHistoryHubFixedPointImplementation
	], { input: "Authenticate history hub fixed point\n" }).trim();
	const integrationUpdates = [];
	for(const path of coreHistoryHubFixedPointIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, coreHistoryHubFixedPointImplementation, integrationCommit
			, { maximumEditBytes: 128 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of coreHistoryHubFixedPointHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(coreHistoryHubFixedPointHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "core-history-hub-fixed-point-source-v1"
		, predecessorCommit: coreHistoryHubFixedPointPredecessor
		, implementationCommit: coreHistoryHubFixedPointImplementation
		, failedRun: {
			workflow: 41170510578
			, jobs: [124447261222, 124447261242]
		}
		, failures: [
			"Native C-family historical source reconstruction"
			, "PHP-Wasm callback-result historical source reconstruction"
		]
		, scope: "Make the complete history hub re-enter its newest-first normalizer sequence whenever an authenticated pass changes source bytes but has not reached the requested digest. Migrate all 29 legacy endpoint acquisitions to the complete hub and scan every source-history contract so one predecessor-specific adapter cannot hide another. Preserve the exact 1,054-cell, 5,270-stage #1220 model and every product or evidence byte."
		, implementationPaths: coreHistoryHubFixedPointImplementationPaths.length
		, legacyEndpointAdapters, initialAdapters: 26
		, scannerDiscoveredAdapters: 3, fixedPointReentry: true
		, typeSurfaceChanges: 0
		, exactModel: {
			sha256: sha256(exactModel), bytes: Buffer.byteLength(exactModel)
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write("Recorded " + updates.length
		+ " implementation transitions, " + integrationUpdates.length
		+ " integration transitions and 29 complete-hub endpoints.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
