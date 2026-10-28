#!/usr/bin/env node
/**
 * Record the Core native-specialization sparse-evidence manifest repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	coreNativeEvidenceManifestAddedPaths
	, coreNativeEvidenceManifestHistoryPath
	, coreNativeEvidenceManifestImplementation
	, coreNativeEvidenceManifestPaths
	, coreNativeEvidenceManifestPredecessor
	, reverseCoreNativeEvidenceManifestUpdate
} from "../tests/helpers/core-native-evidence-manifest-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 32 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = coreNativeEvidenceManifestPredecessor;
const implementation = coreNativeEvidenceManifestImplementation;
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.equal(spawnSync("git", ["merge-base", "--is-ancestor", implementation
	, "HEAD"], { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...coreNativeEvidenceManifestPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `HEAD:${coreNativeEvidenceManifestHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []);
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreNativeEvidenceManifestAddedPaths])
, [...coreNativeEvidenceManifestAddedPaths].sort());

const updates = [];
for(const path of coreNativeEvidenceManifestPaths)
{
	const update = await gitSourceHistoryTransition(
		path, predecessor, implementation);
	const current = git(["show", `${implementation}:${path}`]);
	const previous = git(["show", `${predecessor}:${path}`]);
	assert.equal(reverseCoreNativeEvidenceManifestUpdate(current, update)
		, previous, path);
	updates.push(update);
}
const additions = [];
for(const path of coreNativeEvidenceManifestAddedPaths)
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
await writeFile(coreNativeEvidenceManifestHistoryPath, canonicalJson({
	schemaVersion: 1, milestone: "core-native-evidence-manifest-source-v1"
	, predecessorCommit: predecessor, implementationCommit: implementation
	, scope: "Retain the generic-record Array archive whenever the native-specialization inventory closure runs in a sparse Core shard. The closure already authenticates that archive; this transition adds its exact dynamic prefix and a planner regression without changing evidence, observations or support claims."
	, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} manifest transitions.\n`);
