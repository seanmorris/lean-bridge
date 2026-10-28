#!/usr/bin/env node
/**
 * Record the bounded downstream checkout and live-pin sequence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	downstreamReporterSparseCheckoutAddedPaths
	, downstreamReporterSparseCheckoutHistoryPath
	, downstreamReporterSparseCheckoutImplementation
	, downstreamReporterSparseCheckoutImplementationPaths
	, downstreamReporterSparseCheckoutIntegrationPaths
	, downstreamReporterSparseCheckoutPinPaths
	, downstreamReporterSparseCheckoutPinRepair
	, downstreamReporterSparseCheckoutPredecessor
} from "../tests/helpers/downstream-reporter-sparse-checkout-source-history.mjs";
import {
	gitSourceHistoryTransition
} from "../tests/helpers/source-history-stream.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const integration = git(["rev-parse", "HEAD"]).trim();
assert.equal(git(["rev-parse", `${integration}^`]).trim()
	, downstreamReporterSparseCheckoutPinRepair);
assert.deepEqual(names(["diff", "--name-only"
	, downstreamReporterSparseCheckoutPredecessor
	, downstreamReporterSparseCheckoutImplementation])
, [...downstreamReporterSparseCheckoutImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only"
	, downstreamReporterSparseCheckoutImplementation
	, downstreamReporterSparseCheckoutPinRepair])
, [...downstreamReporterSparseCheckoutPinPaths].sort());
assert.deepEqual(names(["diff", "--name-only"
	, downstreamReporterSparseCheckoutPinRepair, integration])
, [...downstreamReporterSparseCheckoutAddedPaths
	, ...downstreamReporterSparseCheckoutIntegrationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${integration}:${downstreamReporterSparseCheckoutHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");

const transitions = async (paths, previous, current) => {
	const updates = [];
	for(const path of paths) updates.push(await gitSourceHistoryTransition(
		path, previous, current, { maximumEditBytes: 16 * 1024 * 1024 }
	));
	return updates;
};
const updates = await transitions(
	downstreamReporterSparseCheckoutImplementationPaths
	, downstreamReporterSparseCheckoutPredecessor
	, downstreamReporterSparseCheckoutImplementation
);
const pinUpdates = await transitions(
	downstreamReporterSparseCheckoutPinPaths
	, downstreamReporterSparseCheckoutImplementation
	, downstreamReporterSparseCheckoutPinRepair
);
const integrationUpdates = await transitions(
	downstreamReporterSparseCheckoutIntegrationPaths
	, downstreamReporterSparseCheckoutPinRepair, integration
);
const additions = [];
for(const path of downstreamReporterSparseCheckoutAddedPaths)
{
	assert.equal(git(["ls-tree", "--name-only"
		, downstreamReporterSparseCheckoutPredecessor, "--", path]).trim()
	, "", path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(downstreamReporterSparseCheckoutHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "downstream-reporter-sparse-checkout-source-v1"
	, predecessorCommit: downstreamReporterSparseCheckoutPredecessor
	, implementationCommit: downstreamReporterSparseCheckoutImplementation
	, pinRepairCommit: downstreamReporterSparseCheckoutPinRepair
	, integrationCommit: integration
	, scope: "Preserve the reviewed-IR gate's complete retained-evidence authentication under a 60-minute budget, restrict only the PHP-Wasm observation reporter to its exact three-file executable closure, and retain fail-closed observations plus all 117 live source pins."
	, livePinRefreshes: 117
	, additions, updates, pinUpdates, integrationUpdates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} implementation, `
	+ `${pinUpdates.length} pin and ${integrationUpdates.length} integration updates.\n`);
