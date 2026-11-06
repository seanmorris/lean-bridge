#!/usr/bin/env node
/**
 * Record the immutable native Subtype archive-pin restoration.
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
import {
	assertNativeSubtypeArchivePinRestoration
	, nativeSubtypeArchivePinRestorationBehavior as behavior
	, nativeSubtypeArchivePinRestorationDigests as digests
	, nativeSubtypeArchivePinRestorationHistoryAdditions as historyAdditions
	, nativeSubtypeArchivePinRestorationHistoryPath as historyPath
	, nativeSubtypeArchivePinRestorationImplementation as implementation
	, nativeSubtypeArchivePinRestorationImplementationPaths
	as implementationPaths
	, nativeSubtypeArchivePinRestorationIntegrationPaths as integrationPaths
	, nativeSubtypeArchivePinRestorationLivePath as livePath
	, nativeSubtypeArchivePinRestorationPredecessor as predecessor
	, nativeSubtypeArchivePinRestorations as restorations
} from "../tests/helpers/native-subtype-archive-pin-restoration-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const inventoryPath = "docs/type-surface.v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const blob = (commit, path) => git(["show", `${commit}:${path}`]);

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-native-subtype-archive-pin-restoration-source-history.mjs");
assert.equal(existsSync(historyPath), false, "History already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation
	, "--"]), [...implementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${historyPath}`], { stdio: "ignore" }).status, 0);

let inventorySha256;
{
	const previous = blob(predecessor, inventoryPath);
	const current = blob(implementation, inventoryPath);
	assert.deepEqual(assertNativeSubtypeArchivePinRestoration(previous, current)
		, { ...behavior, restorations: { ...restorations } });
	inventorySha256 = { before: sha256(previous), after: sha256(current) };
}
for(const path of Object.keys(restorations))
	assert.equal(sha256(blob(implementation, path)), digests.archive, path);
assert.equal(sha256(blob(implementation, livePath)), digests.live);

const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(new Set(exactSources.map(source => sha256(source))).size, 1);
const exact = JSON.parse(exactSources[0]);
const exactModel = {
	sha256: sha256(exactSources[0])
	, bytes: Buffer.byteLength(exactSources[0])
	, cells: exact.model.length, stageEntries: exact.stageEntries
};
assert.deepEqual(exactModel, {
	sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
	, bytes: 16916757, cells: 1054, stageEntries: 5270
});

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir()
	, "lean-native-subtype-archive-pin-restoration-"));
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
	temporaryGit(["read-tree", implementation]);
	temporaryGit(["add", "--sparse", "--", ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", implementation
	], { input: "Authenticate native Subtype archive-pin restoration\n" })
		.trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of historyAdditions)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "native-subtype-archive-pin-restoration-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			failure: "stale source evidence"
			, runs: [
				{ commit: "d68bae2bd688777b7ae635534da962d2f40de80f"
					, run: 42282677223, job: 128116532126
					, lane: "Type-surface evidence authentication" }
				, { commit: predecessor
					, run: 42285130078, job: 128126678576
					, lane: "Type-surface evidence authentication" }
			]
		}
		, rootCause: "The native Subtype result-projection repair refreshed the tests/helpers/native-subtype-install.mjs pin with a whole-inventory digest replacement. The old digest also pinned seven immutable archived copies of that helper, so 18 archive pin occurrences moved to the new live digest while the archived bytes still hash to the old one. readTypeSurface then refused the inventory with stale source evidence."
		, repair: "Restore exactly the 18 archive pin occurrences on the seven archived paths to the digest of their immutable bytes, keep the 10 live occurrences on the new helper digest, and change no other inventory byte."
		, behavior, restorations, digests, exactModel, inventorySha256
		, changedSupportCells: 0, runtimeSemanticChanges: 0
		, validation: {
			archivePins: {
				paths: 121154, occurrences: 353379
				, before: { mismatches: 7, missing: 0 }
				, after: { mismatches: 0, missing: 0 }
			}
			, currentSourcePins: {
				paths: 2661, occurrences: 16326, findings: 0, rewrites: 0
			}
		}
		, updates, integrationUpdates, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${behavior.restoredArchiveOccurrences} restored `
		+ `pins in ${updates[0].edits.length} inventory edits and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
