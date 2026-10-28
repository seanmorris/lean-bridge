#!/usr/bin/env node
/**
 * Record central registration of the Core shard-5 repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	coreShardFiveRepairIntegrationAddedPaths
	, coreShardFiveRepairIntegrationBase
	, coreShardFiveRepairIntegrationHistoryPath
	, coreShardFiveRepairIntegrationImplementation
	, coreShardFiveRepairIntegrationPaths
} from "../tests/helpers/core-shard-five-repair-integration-source-history.mjs";
import {
	coreShardFiveRepairHistoryPath
} from "../tests/helpers/core-shard-five-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 8 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const base = coreShardFiveRepairIntegrationBase;
const implementation = coreShardFiveRepairIntegrationImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Core shard-5 integration history requires its exact integration implementation");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), base);
assert.deepEqual(names(["diff", "--name-only", base, implementation])
	, [...coreShardFiveRepairIntegrationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${coreShardFiveRepairIntegrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreShardFiveRepairIntegrationAddedPaths])
, [...coreShardFiveRepairIntegrationAddedPaths].sort());

const updates = [];
for(const path of coreShardFiveRepairIntegrationPaths)
	updates.push(await gitSourceHistoryTransition(path, base, implementation));
const additions = [];
for(const path of coreShardFiveRepairIntegrationAddedPaths)
{
	assert.equal(git(["ls-tree", "--name-only", base, "--", path]).trim()
		, "", path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(coreShardFiveRepairIntegrationHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "core-shard-five-repair-integration-v1"
	, baseCommit: base, implementationCommit: implementation
	, baseHistory: {
		path: coreShardFiveRepairHistoryPath
		, sha256: sha256(await readFile(coreShardFiveRepairHistoryPath))
	}
	, scope: "Register the independently authenticated Core shard-5 promotion-prefix and receipt-mode repairs in the reversible Fin source-history hub and one schedulable Core partition. Preserve all runtime behavior, type-surface claims, observations and evidence identities."
	, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} integration updates.\n`);
