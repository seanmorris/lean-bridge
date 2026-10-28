#!/usr/bin/env node
/**
 * Record central registration of the Perl codegen producer replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	perlCodegenProducerReplayIntegrationAddedPaths
	, perlCodegenProducerReplayIntegrationBase
	, perlCodegenProducerReplayIntegrationHistoryPath
	, perlCodegenProducerReplayIntegrationImplementation
	, perlCodegenProducerReplayIntegrationPaths
} from "../tests/helpers/perl-codegen-producer-replay-integration-source-history.mjs";
import {
	perlCodegenProducerReplayHistoryPath
} from "../tests/helpers/perl-codegen-producer-replay-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 8 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const base = perlCodegenProducerReplayIntegrationBase;
const implementation = perlCodegenProducerReplayIntegrationImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Perl codegen producer replay integration history requires its exact integration implementation");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), base);
assert.deepEqual(names(["diff", "--name-only", base, implementation])
	, [...perlCodegenProducerReplayIntegrationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${perlCodegenProducerReplayIntegrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...perlCodegenProducerReplayIntegrationAddedPaths])
, [...perlCodegenProducerReplayIntegrationAddedPaths].sort());

const updates = [];
for(const path of perlCodegenProducerReplayIntegrationPaths)
	updates.push(await gitSourceHistoryTransition(path, base, implementation));
const additions = [];
for(const path of perlCodegenProducerReplayIntegrationAddedPaths)
{
	assert.equal(git(["ls-tree", "--name-only", base, "--", path]).trim()
		, "", path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(perlCodegenProducerReplayIntegrationHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "perl-codegen-producer-replay-integration-v1"
	, baseCommit: base, implementationCommit: implementation
	, baseHistory: {
		path: perlCodegenProducerReplayHistoryPath
		, sha256: sha256(await readFile(perlCodegenProducerReplayHistoryPath))
	}
	, scope: "Register the independently authenticated Perl codegen producer replay newest-first in the reversible Fin source-history hub and checked-JavaScript partition 10. Preserve all runtime behavior, type-surface claims, observations and evidence identities."
	, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} integration updates.\n`);
