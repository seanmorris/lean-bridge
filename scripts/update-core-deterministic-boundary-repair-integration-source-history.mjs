#!/usr/bin/env node
/**
 * Record central registration of the deterministic Core evidence-boundary
 * repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	coreDeterministicBoundaryRepairIntegrationAddedPaths
	, coreDeterministicBoundaryRepairIntegrationBase
	, coreDeterministicBoundaryRepairIntegrationHistoryPath
	, coreDeterministicBoundaryRepairIntegrationImplementation
	, coreDeterministicBoundaryRepairIntegrationPaths
} from "../tests/helpers/core-deterministic-boundary-repair-integration-source-history.mjs";
import {
	coreDeterministicBoundaryRepairHistoryPath
} from "../tests/helpers/core-deterministic-boundary-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 8 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const base = coreDeterministicBoundaryRepairIntegrationBase;
const implementation = coreDeterministicBoundaryRepairIntegrationImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Deterministic Core boundary integration history requires its exact integration implementation");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), base);
assert.deepEqual(names(["diff", "--name-only", base, implementation])
	, [...coreDeterministicBoundaryRepairIntegrationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${coreDeterministicBoundaryRepairIntegrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreDeterministicBoundaryRepairIntegrationAddedPaths])
, [...coreDeterministicBoundaryRepairIntegrationAddedPaths].sort());

const updates = [];
for(const path of coreDeterministicBoundaryRepairIntegrationPaths)
	updates.push(await gitSourceHistoryTransition(path, base, implementation));
const additions = [];
for(const path of coreDeterministicBoundaryRepairIntegrationAddedPaths)
{
	assert.equal(git(["ls-tree", "--name-only", base, "--", path]).trim()
		, "", path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(coreDeterministicBoundaryRepairIntegrationHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "core-deterministic-boundary-repair-integration-v1"
		, baseCommit: base, implementationCommit: implementation
		, baseHistory: {
			path: coreDeterministicBoundaryRepairHistoryPath
			, sha256: sha256(await readFile(
				coreDeterministicBoundaryRepairHistoryPath))
		}
		, scope: "Register the independently authenticated deterministic Core sparse-prefix and exact historical-stop repairs in the reversible Fin source-history hub and one schedulable Core partition. Preserve every runtime behavior, type-surface support claim, observation and retained evidence identity."
		, additions, updates
	}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} integration updates.\n`);
