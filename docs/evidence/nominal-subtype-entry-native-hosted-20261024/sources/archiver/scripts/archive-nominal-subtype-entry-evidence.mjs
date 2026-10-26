#!/usr/bin/env node
/**
 * Archive one original hosted nominal Subtype entry measurement.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	parseCallbackSubtypeHostedArchiveArgs
} from "../tests/helpers/callback-subtype-hosted-archive.mjs";
import {
	nominalSubtypeEntryHostedLanes
	, writeNominalSubtypeEntryHostedEvidence
} from "../tests/helpers/nominal-subtype-entry-hosted-evidence.mjs";

const repository = fileURLToPath(new URL("..", import.meta.url));
process.chdir(repository);
const usage = `Usage: archive-nominal-subtype-entry-evidence.mjs --lane <${nominalSubtypeEntryHostedLanes.join("|")}> --artifact-zip /absolute/artifact.zip --run-json /absolute/run.json --job-json /absolute/job.json --artifact-json /absolute/artifact.json`;
const args = process.argv.slice(2), laneAt = args.indexOf("--lane");
let lane, selected;
try
{
	assert.ok(laneAt >= 0 && laneAt + 1 < args.length, usage);
	lane = args[laneAt + 1];
	assert.ok(nominalSubtypeEntryHostedLanes.includes(lane), usage);
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
const destination = `docs/evidence/nominal-subtype-entry-${lane}-hosted-${date}`;
const index = await writeNominalSubtypeEntryHostedEvidence({
	lane, selected, destination, archiveCommit
});
const indexBytes = Buffer.from(canonicalJson(index));
process.stdout.write(canonicalJson({
	destination, files: index.files.length + 1
	, bytes: index.files.reduce((sum, file) => sum + file.bytes
		, indexBytes.length)
	, producerCommit: index.producerCommit, archiveCommit
	, hostedRun: {
		runId: index.hostedRun.runId, job: index.hostedRun.job.id
		, artifact: index.hostedRun.artifact.id
	}
	, selections: index.summary.selections.length
	, indexSha256: sha256(indexBytes)
}));
