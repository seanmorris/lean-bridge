#!/usr/bin/env node
/**
 * Record central registration of the Perl callback Fin milestone-read history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	callbackFinPerlMilestoneReadIntegrationAddedPaths
	, callbackFinPerlMilestoneReadIntegrationBase
	, callbackFinPerlMilestoneReadIntegrationHistoryPath
	, callbackFinPerlMilestoneReadIntegrationImplementation
	, callbackFinPerlMilestoneReadIntegrationPaths
} from "../tests/helpers/callback-fin-perl-milestone-read-integration-source-history.mjs";
import {
	callbackFinPerlMilestoneReadHistoryPath
} from "../tests/helpers/callback-fin-perl-milestone-read-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 8 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const base = callbackFinPerlMilestoneReadIntegrationBase;
const implementation = callbackFinPerlMilestoneReadIntegrationImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Perl callback Fin milestone-read integration history requires its exact integration implementation");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), base);
assert.deepEqual(names(["diff", "--name-only", base, implementation])
	, [...callbackFinPerlMilestoneReadIntegrationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${callbackFinPerlMilestoneReadIntegrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...callbackFinPerlMilestoneReadIntegrationAddedPaths])
, [...callbackFinPerlMilestoneReadIntegrationAddedPaths].sort());

const updates = [];
for(const path of callbackFinPerlMilestoneReadIntegrationPaths)
	updates.push(await gitSourceHistoryTransition(path, base, implementation));
const additions = [];
for(const path of callbackFinPerlMilestoneReadIntegrationAddedPaths)
{
	assert.equal(git(["ls-tree", "--name-only", base, "--", path]).trim()
		, "", path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(callbackFinPerlMilestoneReadIntegrationHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "callback-fin-perl-milestone-read-integration-v1"
	, baseCommit: base, implementationCommit: implementation
	, baseHistory: {
		path: callbackFinPerlMilestoneReadHistoryPath
		, sha256: sha256(await readFile(callbackFinPerlMilestoneReadHistoryPath))
	}
	, scope: "Register the independently authenticated Perl callback Fin milestone-read history newest-first in the reversible Fin source-history hub and checked-JavaScript partition 10. Preserve all runtime behavior, type-surface claims, observations and evidence identities."
	, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} integration updates.\n`);
