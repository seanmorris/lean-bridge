#!/usr/bin/env node
/**
 * Record central registration of the inherited checked-record lane memory bound.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	inheritedCheckedRecordLaneMemoryIntegrationAddedPaths
	, inheritedCheckedRecordLaneMemoryIntegrationBase
	, inheritedCheckedRecordLaneMemoryIntegrationHistoryPath
	, inheritedCheckedRecordLaneMemoryIntegrationImplementation
	, inheritedCheckedRecordLaneMemoryIntegrationPaths
} from "../tests/helpers/inherited-checked-record-lane-memory-integration-source-history.mjs";
import {
	inheritedCheckedRecordLaneMemoryHistoryPath
} from "../tests/helpers/inherited-checked-record-lane-memory-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 8 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const base = inheritedCheckedRecordLaneMemoryIntegrationBase;
const implementation = inheritedCheckedRecordLaneMemoryIntegrationImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "inherited checked-record lane memory integration history requires its exact integration implementation");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), base);
assert.deepEqual(names(["diff", "--name-only", base, implementation])
	, [...inheritedCheckedRecordLaneMemoryIntegrationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${inheritedCheckedRecordLaneMemoryIntegrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...inheritedCheckedRecordLaneMemoryIntegrationAddedPaths])
, [...inheritedCheckedRecordLaneMemoryIntegrationAddedPaths].sort());

const updates = [];
for(const path of inheritedCheckedRecordLaneMemoryIntegrationPaths)
	updates.push(await gitSourceHistoryTransition(path, base, implementation));
const additions = [];
for(const path of inheritedCheckedRecordLaneMemoryIntegrationAddedPaths)
{
	assert.equal(git(["ls-tree", "--name-only", base, "--", path]).trim()
		, "", path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(inheritedCheckedRecordLaneMemoryIntegrationHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "inherited-checked-record-lane-memory-integration-v1"
	, baseCommit: base, implementationCommit: implementation
	, baseHistory: {
		path: inheritedCheckedRecordLaneMemoryHistoryPath
		, sha256: sha256(await readFile(inheritedCheckedRecordLaneMemoryHistoryPath))
	}
	, scope: "Register the independently authenticated inherited checked-record lane memory bound newest-first in the reversible Fin source-history hub and checked-JavaScript partition 10. Preserve all runtime behavior, type-surface claims, observations and evidence identities."
	, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} integration updates.\n`);
