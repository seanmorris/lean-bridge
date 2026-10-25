#!/usr/bin/env node
/**
 * Archive one authenticated owned checked-record hosted artifact.
 *
 * The output directory is named for the lane and the hosted run's UTC
 * creation date. Archiving refuses a dirty checkout, a checker that differs
 * from the archiver revision, and any run whose original package bytes,
 * report, TAP or API records fail independent replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../src/capsule/node.mjs";
import { parseCallbackSubtypeHostedArchiveArgs } from "../tests/helpers/callback-subtype-hosted-archive.mjs";
import { ownedCheckedRecordHostedLaneNames } from "../tests/helpers/owned-checked-record-hosted-contracts.mjs";
import { writeOwnedCheckedRecordHostedEvidence } from "../tests/helpers/owned-checked-record-hosted-evidence.mjs";
import {
	ownedCheckedRecordEvidenceSources, ownedCheckedRecordHostedOriginal
} from "../tests/helpers/owned-checked-record-hosted-evidence-sources.mjs";

const repository = fileURLToPath(new URL("..", import.meta.url));
process.chdir(repository);

const usage = `Usage: archive-owned-checked-record-evidence.mjs --lane <${ownedCheckedRecordHostedLaneNames.join("|")}> --artifact-zip /absolute/artifact.zip --run-json /absolute/run.json --job-json /absolute/job.json --artifact-json /absolute/artifact.json`;
const args = process.argv.slice(2), laneAt = args.indexOf("--lane");
let lane, selected;
try
{
	assert.ok(laneAt >= 0 && laneAt + 1 < args.length, usage);
	lane = args[laneAt + 1];
	assert.ok(ownedCheckedRecordHostedLaneNames.includes(lane), usage);
	const archiveArgs = [...args]; archiveArgs.splice(laneAt, 2);
	selected = parseCallbackSubtypeHostedArchiveArgs(archiveArgs, usage);
}
catch(error)
{
	process.stderr.write(`${error.message}\n`); process.exit(2);
}

const status = execFileSync("git", ["-C", repository, "status"
	, "--porcelain=v1", "--untracked-files=all", "--", "."], { encoding: "utf8" });
assert.equal(status, ""
	, "Archive generation requires a clean tracked and untracked source tree");
const archiveCommit = execFileSync("git", ["-C", repository, "rev-parse"
	, "HEAD"], { encoding: "utf8" }).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const run = JSON.parse(await readFile(selected["run-json"], "utf8"));
assert.match(run.created_at, /^\d{4}-\d{2}-\d{2}T/u);
const date = run.created_at.slice(0, 10).replaceAll("-", "");
for(const source of ownedCheckedRecordEvidenceSources(lane, {
	producer: archiveCommit, consumer: archiveCommit
	, checker: archiveCommit, archiver: archiveCommit
}).filter(item => ["checker", "archiver"].includes(item.role)))
	assert.deepEqual(await readFile(source.path)
		, ownedCheckedRecordHostedOriginal(archiveCommit, source.path)
		, `Current checker differs from the archiver revision: ${source.path}`);
const destination = `docs/evidence/owned-checked-record-${lane}-hosted-${date}`;
const index = await writeOwnedCheckedRecordHostedEvidence({
	lane, selected, destination, archiveCommit
});
process.stdout.write(canonicalJson({
	destination, files: index.files.length + 1
	, bytes: index.files.reduce((sum, file) => sum + file.bytes, 0)
	, producerCommit: index.producerCommit, archiveCommit
	, hostedRun: { runId: index.hostedRun.runId, job: index.hostedRun.job.id
		, artifact: index.hostedRun.artifact.id }
	, routes: index.accepted.routes.map(route => ({ route: route.route
		, archives: route.archives, archiveBytes: route.archiveBytes }))
}));
