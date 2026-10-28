#!/usr/bin/env node
/**
 * Record integration of the local Core hub-order repair history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	coreHubOrderMergedIntegrationAddedPaths
	, coreHubOrderMergedIntegrationBase
	, coreHubOrderMergedIntegrationHistoryPath
	, coreHubOrderMergedIntegrationImplementation
	, coreHubOrderMergedIntegrationPaths
	, reverseCoreHubOrderMergedIntegrationUpdate
} from "../tests/helpers/core-hub-order-merged-integration-source-history.mjs";
import { coreHubOrderMergedHistoryPath } from "../tests/helpers/core-hub-order-merged-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const base = coreHubOrderMergedIntegrationBase;
const implementation = coreHubOrderMergedIntegrationImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), base);
assert.deepEqual(names(["diff", "--name-only", base, implementation])
	, [...coreHubOrderMergedIntegrationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${coreHubOrderMergedIntegrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []);
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreHubOrderMergedIntegrationAddedPaths])
, [...coreHubOrderMergedIntegrationAddedPaths].sort());

const updates = [];
for(const path of coreHubOrderMergedIntegrationPaths)
{
	const update = await gitSourceHistoryTransition(path, base, implementation);
	assert.equal(reverseCoreHubOrderMergedIntegrationUpdate(
		git(["show", `${implementation}:${path}`]), update)
	, git(["show", `${base}:${path}`]), path);
	updates.push(update);
}
const additions = [];
for(const path of coreHubOrderMergedIntegrationAddedPaths)
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
await writeFile(coreHubOrderMergedIntegrationHistoryPath, canonicalJson({
	schemaVersion: 1, milestone: "core-hub-order-merged-integration-v1"
	, baseCommit: base, implementationCommit: implementation
	, baseHistory: { path: coreHubOrderMergedHistoryPath
		, sha256: sha256(await readFile(coreHubOrderMergedHistoryPath)) }
	, scope: "Register the authenticated local Core hub-order join newest-first in the reversible Fin history hub and checked-JavaScript partition 10."
	, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} integration transitions.\n`);
