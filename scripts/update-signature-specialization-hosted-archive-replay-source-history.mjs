#!/usr/bin/env node
/**
 * Record the immutable hosted-signature archive and replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	signatureSpecializationHostedArchiveReplayAddedPaths
	, signatureSpecializationHostedArchiveReplayChangedPaths
	, signatureSpecializationHostedArchiveReplayHistoryPath
	, signatureSpecializationHostedArchiveReplayImplementation
	, signatureSpecializationHostedArchiveReplayPredecessor
	, signatureSpecializationHostedArchiveReplayRoot
} from "../tests/helpers/signature-specialization-hosted-archive-replay-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = signatureSpecializationHostedArchiveReplayPredecessor;
const implementation = signatureSpecializationHostedArchiveReplayImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Signature hosted archive history requires its exact implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...signatureSpecializationHostedArchiveReplayChangedPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${signatureSpecializationHostedArchiveReplayHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []);
assert.deepEqual(names([
	"ls-files", "--others", "--exclude-standard", "--"
	, ...signatureSpecializationHostedArchiveReplayAddedPaths
]), [...signatureSpecializationHostedArchiveReplayAddedPaths].sort());

const indexPath = `${signatureSpecializationHostedArchiveReplayRoot}/index.json`;
const indexBytes = Buffer.from(git(["show", `${implementation}:${indexPath}`]));
const index = JSON.parse(indexBytes);
assert.equal(indexBytes.toString(), canonicalJson(index));
const archivePaths = [
	indexPath
	, ...index.files.map(file =>
		`${signatureSpecializationHostedArchiveReplayRoot}/${file.path}`)
].sort();
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation]), archivePaths);
assert.equal(archivePaths.length, 5726);

const updates = [];
for(const path of signatureSpecializationHostedArchiveReplayChangedPaths)
	updates.push(await gitSourceHistoryTransition(
		path, predecessor, implementation));
const additions = [];
for(const path of signatureSpecializationHostedArchiveReplayAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(signatureSpecializationHostedArchiveReplayHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "signature-specialization-hosted-archive-replay-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Commit the fully replayed ten-lane hosted signature archive and make its replay/promotion readers insensitive to canonical JSON object-key order while still requiring the complete exact producer map. The archive index authenticates all 5,725 retained children; no evidence bytes or support cells are rewritten by this layer."
		, archive: {
			path: indexPath, bytes: indexBytes.length
			, sha256: sha256(indexBytes), files: archivePaths.length
		}
		, additions, updates
	}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} source updates, `
	+ `${archivePaths.length} indexed archive files and `
	+ `${additions.length} additions.\n`);
