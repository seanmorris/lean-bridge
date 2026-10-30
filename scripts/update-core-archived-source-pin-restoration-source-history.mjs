#!/usr/bin/env node
/**
 * Record restoration of immutable archived source snapshot pins.
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
	coreArchivedSourcePinRestorationBaseline
	, coreArchivedSourcePinRestorationCount
	, coreArchivedSourcePinRestorationHistoryAdditions
	, coreArchivedSourcePinRestorationHistoryPath
	, coreArchivedSourcePinRestorationImplementation
	, coreArchivedSourcePinRestorationImplementationPaths
	, coreArchivedSourcePinRestorationIntegrationPaths
	, coreArchivedSourcePinRestorationPredecessor
	, coreArchivedSourcePinRestorationTransitions
} from "../tests/helpers/core-archived-source-pin-restoration-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-core-archived-source-pin-restoration-source-history.mjs");
assert.equal(existsSync(coreArchivedSourcePinRestorationHistoryPath), false
	, `${coreArchivedSourcePinRestorationHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, coreArchivedSourcePinRestorationImplementation);
assert.equal(git(["rev-parse"
	, `${coreArchivedSourcePinRestorationImplementation}^`]).trim()
, coreArchivedSourcePinRestorationPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, coreArchivedSourcePinRestorationPredecessor
	, coreArchivedSourcePinRestorationImplementation, "--"])
, [...coreArchivedSourcePinRestorationImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, coreArchivedSourcePinRestorationPredecessor
	, coreArchivedSourcePinRestorationImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${coreArchivedSourcePinRestorationImplementation}:${
		coreArchivedSourcePinRestorationHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...coreArchivedSourcePinRestorationIntegrationPaths])
, [...coreArchivedSourcePinRestorationIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreArchivedSourcePinRestorationHistoryAdditions])
, [...coreArchivedSourcePinRestorationHistoryAdditions].sort());

const inventoryPath = coreArchivedSourcePinRestorationImplementationPaths[0];
const before = git(["show"
	, `${coreArchivedSourcePinRestorationPredecessor}:${inventoryPath}`]);
const after = git(["show"
	, `${coreArchivedSourcePinRestorationImplementation}:${inventoryPath}`]);
let restored = after;
for(const transition of coreArchivedSourcePinRestorationTransitions)
{
	assert.equal(sha256(await readFile(transition.path))
		, transition.liveSha256, transition.path);
	assert.equal(restored.split(transition.archivedSha256).length - 1
		, transition.archivedCount, transition.path);
	assert.equal(restored.split(transition.liveSha256).length - 1
		, transition.liveCount, transition.path);
	restored = restored.replaceAll(transition.archivedSha256
		, transition.liveSha256);
}
assert.equal(restored, before);
assert.equal(coreArchivedSourcePinRestorationTransitions
	.reduce((sum, item) => sum + item.archivedCount, 0)
, coreArchivedSourcePinRestorationCount);
const afterDocument = JSON.parse(after);
const baselineDocument = JSON.parse(git(["show"
	, `${coreArchivedSourcePinRestorationBaseline}:${inventoryPath}`]));
assert.deepEqual(afterDocument.profiles, baselineDocument.profiles);
assert.deepEqual(afterDocument.observations, baselineDocument.observations);

const updates = [];
for(const path of coreArchivedSourcePinRestorationImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, coreArchivedSourcePinRestorationPredecessor
		, coreArchivedSourcePinRestorationImplementation
		, { maximumEditBytes: 128 * 1024 * 1024 }));
const directory = await mkdtemp(join(
	tmpdir(), "lean-core-archived-source-pin-restoration-"));
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
	temporaryGit(["read-tree", coreArchivedSourcePinRestorationImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...coreArchivedSourcePinRestorationIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", coreArchivedSourcePinRestorationImplementation
	], { input: "Authenticate immutable archived source pin restoration\n" })
		.trim();
	const integrationUpdates = [];
	for(const path of coreArchivedSourcePinRestorationIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, coreArchivedSourcePinRestorationImplementation, integrationCommit
			, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of coreArchivedSourcePinRestorationHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(coreArchivedSourcePinRestorationHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "core-archived-source-pin-restoration-v1"
		, predecessorCommit: coreArchivedSourcePinRestorationPredecessor
		, implementationCommit: coreArchivedSourcePinRestorationImplementation
		, baselineCommit: coreArchivedSourcePinRestorationBaseline
		, failedRun: 41072790104, failedJob: 124123412234
		, scope: "Correct the digest-only current-source repair after exact-head Core proved that retained archive snapshots intentionally share two historical digests. Keep 18 live JVM-compiler and six live PHP-Wasm-fixture citations current while restoring 474 and 616 archived citations to their immutable original bytes. Preserve the other 176 correctly advanced live citations, every profile, support observation, stage and evidence identity, and register the exact reversible correction."
		, pinTransitions: coreArchivedSourcePinRestorationTransitions
		, updates, integrationUpdates, historyAdditions
		, restoredPins: coreArchivedSourcePinRestorationCount
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} restoration transition, `
		+ `${integrationUpdates.length} registrations and `
		+ `${coreArchivedSourcePinRestorationCount} archived pins.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
