#!/usr/bin/env node
/**
 * Archive one authenticated owned-Subtype hosted artifact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	parseCallbackSubtypeHostedArchiveArgs
} from "../tests/helpers/callback-subtype-hosted-archive.mjs";
import {
	ownedSubtypeHostedLaneNames
} from "../tests/helpers/owned-subtype-hosted-contracts.mjs";
import {
	writeOwnedSubtypeHostedEvidence
} from "../tests/helpers/owned-subtype-hosted-evidence.mjs";
import {
	ownedSubtypeEvidenceSources, ownedSubtypeHostedOriginal
} from "../tests/helpers/owned-subtype-hosted-evidence-sources.mjs";

const repository = fileURLToPath(new URL("..", import.meta.url));
process.chdir(repository);
const usage = `Usage: archive-owned-subtype-evidence.mjs --lane <${ownedSubtypeHostedLaneNames.join("|")}> --artifact-zip /absolute/artifact.zip --run-json /absolute/run.json --job-json /absolute/job.json --artifact-json /absolute/artifact.json`;
const args = process.argv.slice(2), laneAt = args.indexOf("--lane");
let lane, selected;
try
{
	assert.ok(laneAt >= 0 && laneAt + 1 < args.length, usage);
	lane = args[laneAt + 1];
	assert.ok(ownedSubtypeHostedLaneNames.includes(lane), usage);
	const archiveArgs = [...args]; archiveArgs.splice(laneAt, 2);
	selected = parseCallbackSubtypeHostedArchiveArgs(archiveArgs, usage);
}
catch(error)
{
	process.stderr.write(`${error.message}\n`); process.exit(2);
}
const status = execFileSync("git", ["-C", repository, "status"
	, "--porcelain=v1", "--untracked-files=all", "--", "."]
, { encoding: "utf8" });
assert.equal(status, ""
	, "Archive generation requires a clean tracked and untracked source tree");
const archiveCommit = execFileSync("git", ["-C", repository, "rev-parse"
	, "HEAD"], { encoding: "utf8" }).trim();
const run = JSON.parse(await readFile(selected["run-json"], "utf8"));
assert.match(run.created_at, /^\d{4}-\d{2}-\d{2}T/u);
const date = run.created_at.slice(0, 10).replaceAll("-", "");
for(const source of ownedSubtypeEvidenceSources(lane, {
	producer: archiveCommit, consumer: archiveCommit
	, checker: archiveCommit, archiver: archiveCommit
}).filter(item => ["checker", "archiver"].includes(item.role)))
	assert.deepEqual(await readFile(source.path)
		, ownedSubtypeHostedOriginal(archiveCommit, source.path)
		, `Current checker differs from the archiver revision: ${source.path}`);
const destination = `docs/evidence/owned-subtype-${lane}-hosted-${date}`;
const index = await writeOwnedSubtypeHostedEvidence({
	lane, selected, destination, archiveCommit
});
process.stdout.write(canonicalJson({
	destination, files: index.files.length + 1
	, bytes: index.files.reduce((sum, file) => sum + file.bytes, 0)
	, producerCommit: index.producerCommit, archiveCommit
	, hostedRun: { runId: index.hostedRun.runId, job: index.hostedRun.job.id
		, artifact: index.hostedRun.artifact.id }
	, routes: index.accepted.accepted.retainedPackages.routes
}));
