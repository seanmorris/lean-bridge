#!/usr/bin/env node
/**
 * Record central registration of the WIT callback frozen closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	witCallbackFrozenClosureIntegrationAddedPaths
	, witCallbackFrozenClosureIntegrationBase
	, witCallbackFrozenClosureIntegrationHistoryPath
	, witCallbackFrozenClosureIntegrationImplementation
	, witCallbackFrozenClosureIntegrationPaths
} from "../tests/helpers/wit-callback-frozen-closure-integration-source-history.mjs";
import { witCallbackFrozenClosureHistoryPath } from "../tests/helpers/wit-callback-frozen-closure-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 8 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const base = witCallbackFrozenClosureIntegrationBase;
const implementation = witCallbackFrozenClosureIntegrationImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "WIT callback closure integration history requires its exact implementation");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), base);
assert.deepEqual(names(["diff", "--name-only", base, implementation])
	, [...witCallbackFrozenClosureIntegrationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${witCallbackFrozenClosureIntegrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...witCallbackFrozenClosureIntegrationAddedPaths])
, [...witCallbackFrozenClosureIntegrationAddedPaths].sort());
const updates = [];
for(const path of witCallbackFrozenClosureIntegrationPaths)
	updates.push(await gitSourceHistoryTransition(path, base, implementation));
const additions = [];
for(const path of witCallbackFrozenClosureIntegrationAddedPaths)
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
await writeFile(witCallbackFrozenClosureIntegrationHistoryPath
	, canonicalJson({
		schemaVersion: 1
		, milestone: "wit-callback-frozen-closure-integration-v1"
		, baseCommit: base, implementationCommit: implementation
		, baseHistory: {
			path: witCallbackFrozenClosureHistoryPath
			, sha256: sha256(await readFile(witCallbackFrozenClosureHistoryPath))
		}
		, scope: "Register the authenticated WIT callback frozen-source closure repair newest-first in the reversible Fin history hub and one schedulable Core partition. Preserve all support claims and evidence identities."
		, additions, updates
	}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} integration updates.\n`);
