#!/usr/bin/env node
/**
 * Record central registration of the native Fin callback-role history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	nativeFinCallbackRoleIntegrationAddedPaths
	, nativeFinCallbackRoleIntegrationBase
	, nativeFinCallbackRoleIntegrationHistoryPath
	, nativeFinCallbackRoleIntegrationImplementation
	, nativeFinCallbackRoleIntegrationPaths
} from "../tests/helpers/native-fin-callback-role-integration-source-history.mjs";
import {
	nativeFinCallbackRoleHistoryPath
} from "../tests/helpers/native-fin-callback-role-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 8 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const base = nativeFinCallbackRoleIntegrationBase;
const implementation = nativeFinCallbackRoleIntegrationImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "native Fin callback-role integration history requires its exact integration implementation");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), base);
assert.deepEqual(names(["diff", "--name-only", base, implementation])
	, [...nativeFinCallbackRoleIntegrationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${nativeFinCallbackRoleIntegrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...nativeFinCallbackRoleIntegrationAddedPaths])
, [...nativeFinCallbackRoleIntegrationAddedPaths].sort());

const updates = [];
for(const path of nativeFinCallbackRoleIntegrationPaths)
	updates.push(await gitSourceHistoryTransition(path, base, implementation));
const additions = [];
for(const path of nativeFinCallbackRoleIntegrationAddedPaths)
{
	assert.equal(git(["ls-tree", "--name-only", base, "--", path]).trim()
		, "", path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(nativeFinCallbackRoleIntegrationHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "native-fin-callback-role-integration-v1"
	, baseCommit: base, implementationCommit: implementation
	, baseHistory: {
		path: nativeFinCallbackRoleHistoryPath
		, sha256: sha256(await readFile(nativeFinCallbackRoleHistoryPath))
	}
	, scope: "Register the independently authenticated native Fin callback-role history newest-first in the reversible Fin source-history hub and checked-JavaScript partition 10. Preserve all runtime behavior, type-surface claims, observations and evidence identities."
	, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} integration updates.\n`);
