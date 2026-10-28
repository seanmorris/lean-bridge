#!/usr/bin/env node
/**
 * Record central registration of the Core historical-contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	coreHistoricalContractRepairIntegrationAddedPaths
	, coreHistoricalContractRepairIntegrationBase
	, coreHistoricalContractRepairIntegrationCommits
	, coreHistoricalContractRepairIntegrationHistoryPath
	, coreHistoricalContractRepairIntegrationImplementation
	, coreHistoricalContractRepairIntegrationPaths
} from "../tests/helpers/core-historical-contract-repair-integration-source-history.mjs";
import {
	coreHistoricalContractRepairHistoryPath
} from "../tests/helpers/core-historical-contract-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 8 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const base = coreHistoricalContractRepairIntegrationBase;
const implementation = coreHistoricalContractRepairIntegrationImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Core historical-contract integration history requires its exact integration implementation");
assert.deepEqual(git(["rev-list", "--reverse", `${base}..${implementation}`])
	.trim().split("\n"), coreHistoricalContractRepairIntegrationCommits);
for(const [index, revision] of coreHistoricalContractRepairIntegrationCommits.entries())
	assert.equal(git(["rev-parse", `${revision}^`]).trim(), index === 0
		? base : coreHistoricalContractRepairIntegrationCommits[index - 1]);
assert.deepEqual(names(["diff", "--name-only", base, implementation])
	, [...coreHistoricalContractRepairIntegrationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${coreHistoricalContractRepairIntegrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreHistoricalContractRepairIntegrationAddedPaths])
, [...coreHistoricalContractRepairIntegrationAddedPaths].sort());

const updates = [];
for(const path of coreHistoricalContractRepairIntegrationPaths)
	updates.push(await gitSourceHistoryTransition(path, base, implementation));
const additions = [];
for(const path of coreHistoricalContractRepairIntegrationAddedPaths)
{
	assert.equal(git(["ls-tree", "--name-only", base, "--", path]).trim()
		, "", path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(coreHistoricalContractRepairIntegrationHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "core-historical-contract-repair-integration-v1"
		, baseCommit: base, implementationCommit: implementation
		, implementationCommits: coreHistoricalContractRepairIntegrationCommits
		, baseHistory: {
			path: coreHistoricalContractRepairHistoryPath
			, sha256: sha256(await readFile(coreHistoricalContractRepairHistoryPath))
		}
		, scope: "Register the independently authenticated Core historical-contract repair newest-first in the reversible Fin source-history hub and checked-JavaScript partition 10. Preserve runtime behavior, type-surface claims, observations and evidence identities."
		, additions, updates
	}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} integration updates.\n`);
