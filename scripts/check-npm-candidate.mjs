#!/usr/bin/env node
/** @file Reinstall an exact release candidate's hosted owned-record npm shard, without rebuilding Lean. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {mkdir, readFile, realpath, rm, writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {join, resolve} from "node:path";
import {promisify} from "node:util";
import {canonicalJson} from "../src/capsule/node.mjs";
import {extractCallbackSubtypeHostedArtifact, inspectCallbackSubtypeHostedArtifact} from "../tests/helpers/callback-subtype-hosted-archive.mjs";
import {checkNpmCandidateConsumer} from "../tests/helpers/npm-candidate-consumer.mjs";
import {ownedCheckedRecordHostedLanes} from "../tests/helpers/owned-checked-record-hosted-contracts.mjs";
import {assertOwnedCheckedRecordHostedSteps, ownedCheckedRecordHostedWorkflowContract} from "../tests/helpers/owned-checked-record-hosted-evidence.mjs";
import {replayOwnedCheckedRecordHostedOutput} from "../tests/helpers/owned-checked-record-hosted-output.mjs";
import {assertNpmCandidateArtifact, assertNpmCandidateRun} from "./lib/npm-candidate-origin.mjs";

const [commit,id,output,...extra] = process.argv.slice(2);
assert.ok(/^[a-f0-9]{40}$/u.test(commit ?? "") && /^[1-9]\d*$/u.test(id ?? "")
	&& output && extra.length === 0, "Usage: check-npm-candidate.mjs <full candidate SHA> <Actions run ID> <new output directory>");
const exec = promisify(execFile), require = createRequire(import.meta.url);
const api = async (path, maxBuffer = 4 << 20) => (await exec("gh",["api","--hostname","github.com","repos/seanmorris/lean-bridge/actions/"+path],
	{encoding: "buffer", maxBuffer, timeout: 300_000})).stdout;
const lane = ownedCheckedRecordHostedLanes.javascript;
const runBytes = await api("runs/"+id), run = JSON.parse(runBytes);
assertNpmCandidateRun(run,id,commit);
const [jobs, artifacts] = await Promise.all([
	api("runs/"+id+"/attempts/"+run.run_attempt+"/jobs?per_page=100")
	, api("runs/"+id+"/artifacts?per_page=100")
]);
const jobList = JSON.parse(jobs), artifactList = JSON.parse(artifacts);
assert.equal(jobList.total_count,jobList.jobs.length);
assert.equal(artifactList.total_count,artifactList.artifacts.length);
const only = matches => { assert.equal(matches.length,1,"Expected exactly one matching GitHub record"); return matches[0]; };
const jobId = only(jobList.jobs.filter(j=>j.name===lane.job)).id;
const artifactId = only(artifactList.artifacts.filter(a=>a.name===lane.prefix+"-"+commit)).id;
const [jobBytes,artifactBytes] = await Promise.all([api("jobs/"+jobId),api("artifacts/"+artifactId)]);
const job = JSON.parse(jobBytes), artifact = JSON.parse(artifactBytes);
assert.equal(job.id,jobId); assert.equal(artifact.id,artifactId);
assertNpmCandidateArtifact(run,job,artifact);
const destination = resolve(output); await mkdir(destination);
const root = await realpath(destination);
const selected = {};
for(const [name,bytes] of [["run",runBytes],["job",jobBytes],["artifact",artifactBytes]])
{
	selected[name+"-json"] = join(root,name+".json");
	await writeFile(selected[name+"-json"],bytes,{flag: "wx"});
}
selected["artifact-zip"] = join(root,"artifact.zip");
await writeFile(selected["artifact-zip"],await api("artifacts/"+artifact.id+"/zip",artifact.size_in_bytes+1),{flag: "wx"});
const hosted = await inspectCallbackSubtypeHostedArtifact(selected,ownedCheckedRecordHostedWorkflowContract(lane,run));
assert.equal(hosted.revision,commit); assertOwnedCheckedRecordHostedSteps(lane,jobBytes);
const extracted = await extractCallbackSubtypeHostedArtifact(selected["artifact-zip"]);
try
{
	const packageRoot = join(extracted.root,lane.packaging);
	const report = JSON.parse(await readFile(join(packageRoot,lane.report)));
	assert.equal(report.schemaVersion,2,"Require the two independent author builds, not a historical v1 report");
	const producer = await replayOwnedCheckedRecordHostedOutput("javascript",extracted.root,commit);
	const consumers = [];
	for(const row of producer.routes) consumers.push(await checkNpmCandidateConsumer(join(packageRoot,"evidence",row.route,"handoff"),row));
	const receipt = {
		schemaVersion: 1, scope: "npm-owned-checked-records", candidate: commit
		, hosted: hosted.hostedRun, producer, consumers
		, node: process.version
		, typescript: require("typescript/package.json").version
	};
	await writeFile(join(root,"acceptance.json"),canonicalJson(receipt),{flag: "wx"});
	console.log("Passed: "+consumers.length+" independently rebuilt package sets and eight emitted TypeScript clients. "+join(root,"acceptance.json"));
}
finally
{
	await rm(extracted.root,{recursive: true,force: true});
}
