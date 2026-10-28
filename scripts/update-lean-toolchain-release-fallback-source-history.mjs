#!/usr/bin/env node
/**
 * Record the checksummed Lean release fallback as reversible source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	leanToolchainReleaseFallbackAddedPaths
	, leanToolchainReleaseFallbackHistoryPath
	, leanToolchainReleaseFallbackImplementation
	, leanToolchainReleaseFallbackImplementationPaths
	, leanToolchainReleaseFallbackIntegrationPaths
	, leanToolchainReleaseFallbackPredecessor
} from "../tests/helpers/lean-toolchain-release-fallback-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 64 * 1024 ** 2 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const integration = git(["rev-parse", "HEAD"]).trim();
assert.equal(git(["rev-parse"
	, `${leanToolchainReleaseFallbackImplementation}^`]).trim()
, leanToolchainReleaseFallbackPredecessor);
assert.equal(git(["rev-parse", `${integration}^`]).trim()
	, leanToolchainReleaseFallbackImplementation);
assert.deepEqual(names(["diff", "--name-only"
	, leanToolchainReleaseFallbackPredecessor
	, leanToolchainReleaseFallbackImplementation])
, [...leanToolchainReleaseFallbackImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only"
	, leanToolchainReleaseFallbackImplementation, integration])
, [...leanToolchainReleaseFallbackAddedPaths
	, ...leanToolchainReleaseFallbackIntegrationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, leanToolchainReleaseFallbackHistoryPath]).trim(), "");
assert.equal(git(["status", "--short"]).trim(), "");

const updates = [];
for(const path of leanToolchainReleaseFallbackImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, leanToolchainReleaseFallbackPredecessor
		, leanToolchainReleaseFallbackImplementation));
const integrationUpdates = [];
for(const path of leanToolchainReleaseFallbackIntegrationPaths)
	integrationUpdates.push(await gitSourceHistoryTransition(path
		, leanToolchainReleaseFallbackImplementation, integration));
const additions = leanToolchainReleaseFallbackAddedPaths.map(path => ({
	path, currentSha256: sha256(git(["show", `${integration}:${path}`]))
}));
await writeFile(leanToolchainReleaseFallbackHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "lean-toolchain-release-fallback-source-v1"
	, predecessorCommit: leanToolchainReleaseFallbackPredecessor
	, implementationCommit: leanToolchainReleaseFallbackImplementation
	, integrationCommit: integration
	, scope: "After two bounded elan attempts, download the identical Lean 4.32.2 Linux release from Lean's official GitHub release, authenticate the published SHA-256 digest and compiler commit, extract through a private staging directory, and refuse an unexpected destination. Preserve the primary elan path, exact compiler identity, every runtime/API/type-surface byte, and all existing acceptance behavior. Add a focused source contract; claim no installed consumer result from this source change alone."
	, additions, updates, integrationUpdates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} implementation and `
	+ `${integrationUpdates.length} integration updates.\n`);
