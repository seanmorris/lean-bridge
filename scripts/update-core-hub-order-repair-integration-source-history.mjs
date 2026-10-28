#!/usr/bin/env node
/**
 * Record central registration of the Fin hub order repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	coreHubOrderRepairIntegrationAddedPaths
	, coreHubOrderRepairIntegrationBase
	, coreHubOrderRepairIntegrationHistoryPath
	, coreHubOrderRepairIntegrationImplementation
	, coreHubOrderRepairIntegrationPaths
} from "../tests/helpers/core-hub-order-repair-integration-source-history.mjs";
import {
	coreHubOrderRepairHistoryPath
} from "../tests/helpers/core-hub-order-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 8 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const base = coreHubOrderRepairIntegrationBase;
const implementation = coreHubOrderRepairIntegrationImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Fin hub order integration history requires its exact integration implementation");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), base);
assert.deepEqual(names(["diff", "--name-only", base, implementation])
	, [...coreHubOrderRepairIntegrationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${coreHubOrderRepairIntegrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreHubOrderRepairIntegrationAddedPaths])
, [...coreHubOrderRepairIntegrationAddedPaths].sort());

const updates = [];
for(const path of coreHubOrderRepairIntegrationPaths)
	updates.push(await gitSourceHistoryTransition(path, base, implementation));
const additions = [];
for(const path of coreHubOrderRepairIntegrationAddedPaths)
{
	assert.equal(git(["ls-tree", "--name-only", base, "--", path]).trim()
		, "", path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(coreHubOrderRepairIntegrationHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "core-hub-order-repair-integration-v1"
	, baseCommit: base, implementationCommit: implementation
	, baseHistory: {
		path: coreHubOrderRepairHistoryPath
		, sha256: sha256(await readFile(coreHubOrderRepairHistoryPath))
	}
	, scope: "Register the independently authenticated Fin hub order repair newest-first in the reversible Fin source-history hub and checked-JavaScript partition 10. Preserve all runtime behavior, type-surface claims, observations and evidence identities."
	, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} integration updates.\n`);
