#!/usr/bin/env node
/**
 * Record local integration of the merged Perl codegen replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	perlCodegenMergedIntegrationAddedPaths, perlCodegenMergedIntegrationBase
	, perlCodegenMergedIntegrationHistoryPath
	, perlCodegenMergedIntegrationImplementation
	, perlCodegenMergedIntegrationPathCommits
	, perlCodegenMergedIntegrationPaths
	, reversePerlCodegenMergedIntegrationUpdate
} from "../tests/helpers/perl-codegen-merged-integration-source-history.mjs";
import { perlCodegenMergedHistoryPath } from "../tests/helpers/perl-codegen-merged-source-history.mjs";
import { perlCodegenProducerReplayIntegrationHistoryPath } from "../tests/helpers/perl-codegen-producer-replay-integration-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const base = perlCodegenMergedIntegrationBase;
const implementation = perlCodegenMergedIntegrationImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(spawnSync("git", ["merge-base", "--is-ancestor", base
	, implementation], { stdio: "ignore" }).status, 0);
assert.deepEqual(git(["log", "--reverse", "--format=%H"
	, `${base}..${implementation}`, "--"
	, ...perlCodegenMergedIntegrationPaths]).trim().split("\n")
, perlCodegenMergedIntegrationPathCommits);
assert.deepEqual(names(["diff", "--name-only", base, implementation, "--"
	, ...perlCodegenMergedIntegrationPaths])
, [...perlCodegenMergedIntegrationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${perlCodegenMergedIntegrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []);
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...perlCodegenMergedIntegrationAddedPaths])
, [...perlCodegenMergedIntegrationAddedPaths].sort());

const updates = [];
for(const path of perlCodegenMergedIntegrationPaths)
{
	const update = await gitSourceHistoryTransition(path, base, implementation);
	const current = git(["show", `${implementation}:${path}`]);
	const previous = git(["show", `${base}:${path}`]);
	assert.equal(reversePerlCodegenMergedIntegrationUpdate(current, update)
		, previous, path);
	updates.push(update);
}
const additions = [];
for(const path of perlCodegenMergedIntegrationAddedPaths)
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
await writeFile(perlCodegenMergedIntegrationHistoryPath, canonicalJson({
	schemaVersion: 1, milestone: "perl-codegen-merged-integration-v1"
	, baseCommit: base, implementationCommit: implementation
	, pathCommits: perlCodegenMergedIntegrationPathCommits
	, histories: [
		{ path: perlCodegenMergedHistoryPath
			, sha256: sha256(await readFile(perlCodegenMergedHistoryPath)) }
		, { path: perlCodegenProducerReplayIntegrationHistoryPath
			, sha256: sha256(await readFile(
				perlCodegenProducerReplayIntegrationHistoryPath)) }
	]
	, scope: "Join the upstream Perl generator-replay integration to the newer Core repair line. Reverse the complete local hub and partition transition to the exact pre-cherry-pick Core state before either independent history chain continues."
	, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} merged integration transitions.\n`);
