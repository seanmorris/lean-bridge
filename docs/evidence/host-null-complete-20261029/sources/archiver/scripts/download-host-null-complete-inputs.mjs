#!/usr/bin/env node
/**
 * Download the seven original same-run HostNull artifacts and API records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import {
	access, mkdir, readFile, rm, stat, writeFile
} from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import {
	checkedRecordValueIndexHostedDigest as digestFile
} from "../tests/helpers/checked-record-value-index-hosted-archive.mjs";
import {
	hostNullCompleteFocusedWorkflow, hostNullCompleteHostedLanes
	, hostNullCompleteLaneContract, hostNullCompleteWorkflow
	, inspectHostNullCompleteHostedArtifacts
	, readHostNullCompleteGitHubCollection
} from "../tests/helpers/host-null-complete-hosted-archive.mjs";

const usage = "Usage: download-host-null-complete-inputs.mjs --run-id <id> --producer <sha> --output /absolute/hosted-input";
const parseArgs = args => {
	assert.equal(args.length, 6, usage);
	const selected = new Map();
	for(let index = 0; index < args.length; index += 2)
	{
		const key = args[index], value = args[index + 1];
		assert.ok(["--output", "--producer", "--run-id"].includes(key), usage);
		assert.equal(selected.has(key), false, usage);
		assert.ok(value && !value.startsWith("--")
			&& !/[\0\r\n]/u.test(value), usage);
		selected.set(key, value);
	}
	assert.deepEqual([...selected.keys()].sort(), [
		"--output", "--producer", "--run-id"
	]);
	return selected;
};
let options;
try
{ options = parseArgs(process.argv.slice(2)); }
catch(error)
{ process.stderr.write(`${error.message}\n`); process.exit(2); }
const runId = Number(options.get("--run-id"));
assert.ok(Number.isSafeInteger(runId) && runId > 0, usage);
const producer = options.get("--producer");
assert.match(producer, /^[a-f0-9]{40}$/u, usage);
const output = options.get("--output");
assert.ok(isAbsolute(output) && resolve(output) === output, usage);
await assert.rejects(access(output), { code: "ENOENT" });

const repository = "repos/seanmorris/lean-bridge";
const api = endpoint => execFileSync("gh", ["api", endpoint], {
	encoding: "utf8", maxBuffer: 64 * 1024 ** 2
});
const object = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.ok(value && typeof value === "object" && !Array.isArray(value), label);
	return value;
};
const stream = (endpoint, path) => new Promise((accept, reject) => {
	const child = spawn("gh", ["api", endpoint], {
		stdio: ["ignore", "pipe", "pipe"]
	});
	const outputStream = createWriteStream(path, { flags: "wx" });
	let stderr = "", childDone = false, outputDone = false, settled = false;
	const fail = error => {
		if(settled) return;
		settled = true; reject(error);
	};
	const finish = () => {
		if(settled || !childDone || !outputDone) return;
		settled = true; accept();
	};
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", chunk => { stderr += chunk; });
	child.once("error", fail); outputStream.once("error", fail);
	outputStream.once("close", () => { outputDone = true; finish(); });
	child.stdout.pipe(outputStream);
	child.once("close", (code, signal) => {
		if(code === 0)
		{
			childDone = true; finish();
		}
		else fail(new Error(
			`GitHub artifact download failed: ${code}/${signal} ${stderr}`
		));
	});
});

let complete = false;
await mkdir(output);
try
{
	const runBytes = api(`${repository}/actions/runs/${runId}`);
	const run = object(runBytes, "run API record");
	assert.equal(run.id, runId);
	assert.equal(run.head_sha, producer);
	assert.ok([hostNullCompleteWorkflow, hostNullCompleteFocusedWorkflow]
		.includes(run.path));
	assert.equal(run.repository?.full_name, "seanmorris/lean-bridge");
	assert.equal(run.head_repository?.full_name, "seanmorris/lean-bridge");
	assert.equal(run.status, "completed");
	assert.ok(["failure", "success"].includes(run.conclusion));
	const jobs = await readHostNullCompleteGitHubCollection("jobs", page =>
		object(api(`${repository}/actions/runs/${runId}/jobs?per_page=100&page=${page}`)
			, `jobs API page ${page}`));
	const artifacts = await readHostNullCompleteGitHubCollection(
		"artifacts", page => object(api(
			`${repository}/actions/runs/${runId}/artifacts?per_page=100&page=${page}`
		), `artifacts API page ${page}`)
	);
	for(const selectedLane of hostNullCompleteHostedLanes)
	{
		const contract = hostNullCompleteLaneContract(selectedLane, run.path);
		const matches = jobs.filter(job => job.name === contract.jobName);
		assert.equal(matches.length, 1, contract.jobName);
		const job = matches[0];
		assert.equal(job.run_id, runId);
		assert.equal(job.head_sha, producer);
		assert.equal(job.status, "completed");
		assert.equal(job.conclusion, "success");
		const artifactName = `${selectedLane.artifactPrefix}-${producer}`;
		const candidates = artifacts.filter(artifact => artifact.name === artifactName);
		assert.equal(candidates.length, 1, artifactName);
		const artifact = candidates[0];
		assert.equal(artifact.expired, false);
		assert.equal(artifact.workflow_run?.id, runId);
		assert.equal(artifact.workflow_run?.head_sha, producer);
		const laneRoot = join(output, selectedLane.id);
		await mkdir(laneRoot);
		const exactJob = api(`${repository}/actions/jobs/${job.id}`);
		const exactArtifact = api(`${repository}/actions/artifacts/${artifact.id}`);
		assert.equal(object(exactJob, "job API record").id, job.id);
		assert.equal(object(exactArtifact, "artifact API record").id, artifact.id);
		await writeFile(join(laneRoot, "run.json"), runBytes, { flag: "wx" });
		await writeFile(join(laneRoot, "job.json"), exactJob, { flag: "wx" });
		await writeFile(join(laneRoot, "artifact.json"), exactArtifact, { flag: "wx" });
		const zipPath = join(laneRoot, "artifact.zip");
		await stream(`${repository}/actions/artifacts/${artifact.id}/zip`, zipPath);
		const metadata = object(await readFile(
			join(laneRoot, "artifact.json")), "artifact API record");
		const information = await stat(zipPath);
		assert.equal(information.size, metadata.size_in_bytes);
		const digest = await digestFile(zipPath);
		assert.equal(metadata.digest, `sha256:${digest}`);
	}
	const selected = await inspectHostNullCompleteHostedArtifacts(output, producer);
	complete = true;
	process.stdout.write(JSON.stringify({
		output, producerCommit: selected.producerCommit, runId: selected.runId
		, lanes: selected.captures.length, cells: selected.cells.length
	}, null, 2) + "\n");
}
finally
{
	if(!complete) await rm(output, { recursive: true });
}
