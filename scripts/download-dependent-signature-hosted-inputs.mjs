#!/usr/bin/env node
/**
 * Download the original hosted inputs for all dependent-signature lanes.
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
	assertDependentSignatureHostedReceiptSteps
	, assertDependentSignatureHostedSteps
	, dependentSignatureHostedInputs
	, dependentSignatureHostedLanes
	, dependentSignatureHostedProducer
	, dependentSignatureHostedReceipt
	, dependentSignatureHostedRunId
	, inspectDependentSignatureHostedReceipt
	, inspectDependentSignatureHostedArtifact
} from "../tests/helpers/dependent-signature-hosted-archive.mjs";
import {
	dependentSignatureFocusedWorkflow
} from "../tests/helpers/dependent-signature-matrix-receipt.mjs";

const usage = "Usage: download-dependent-signature-hosted-inputs.mjs --output /absolute/hosted-input";
assert.deepEqual(process.argv.slice(2, 3), ["--output"], usage);
assert.equal(process.argv.length, 4, usage);
const output = process.argv[3];
assert.ok(typeof output === "string" && !/[\0\r\n]/u.test(output)
	&& isAbsolute(output) && resolve(output) === output, usage);
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
const collection = async key => {
	const items = [];
	let total = null, page = 1;
	while(true)
	{
		const value = object(api(
			`${repository}/actions/runs/${dependentSignatureHostedRunId}/${key}?per_page=100&page=${page}`
		), `${key} API page ${page}`);
		assert.ok(Number.isSafeInteger(value.total_count)
			&& value.total_count >= 0);
		assert.ok(Array.isArray(value[key]) && value[key].length <= 100);
		if(total === null) total = value.total_count;
		else assert.equal(value.total_count, total, `${key} total changed`);
		items.push(...value[key]);
		assert.ok(items.length <= total, `${key} exceeded total_count`);
		if(items.length === total) break;
		assert.equal(value[key].length, 100, `${key} ended early`);
		page += 1;
	}
	assert.equal(new Set(items.map(item => item.id)).size, items.length
		, `${key} identities must be unique`);
	return items;
};
const stream = (endpoint, path) => new Promise((accept, reject) => {
	const child = spawn("gh", ["api", endpoint], {
		stdio: ["ignore", "pipe", "pipe"]
	});
	const destination = createWriteStream(path, { flags: "wx" });
	let stderr = "", childDone = false, outputDone = false, settled = false;
	const fail = error => {
		if(settled) return;
		settled = true;
		reject(error);
	};
	const finish = () => {
		if(settled || !childDone || !outputDone) return;
		settled = true;
		accept();
	};
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", chunk => { stderr += chunk; });
	child.once("error", fail);
	destination.once("error", fail);
	destination.once("close", () => { outputDone = true; finish(); });
	child.stdout.pipe(destination);
	child.once("close", (code, signal) => {
		if(code === 0)
		{
			childDone = true;
			finish();
		}
		else fail(new Error(
			`GitHub download failed: ${code}/${signal} ${stderr}`
		));
	});
});

const runBytes = api(
	`${repository}/actions/runs/${dependentSignatureHostedRunId}`);
const run = object(runBytes, `run ${dependentSignatureHostedRunId}`);
assert.equal(run.id, dependentSignatureHostedRunId);
assert.equal(run.head_sha, dependentSignatureHostedProducer);
assert.equal(run.status, "completed");
assert.equal(run.conclusion, "success");
assert.equal(run.path, dependentSignatureFocusedWorkflow);
assert.equal(run.repository?.full_name, "seanmorris/lean-bridge");
assert.equal(run.head_repository?.full_name, "seanmorris/lean-bridge");

let complete = false;
await mkdir(output);
try
{
	const [jobs, artifacts] = await Promise.all([
		collection("jobs"), collection("artifacts")
	]);
	const selected = [...dependentSignatureHostedLanes
		, dependentSignatureHostedReceipt];
	for(const item of selected)
	{
		const matchingJobs = jobs.filter(job => job.name === item.jobName);
		assert.equal(matchingJobs.length, 1, item.jobName);
		const job = matchingJobs[0];
		assert.equal(job.run_id, dependentSignatureHostedRunId);
		assert.equal(job.head_sha, dependentSignatureHostedProducer);
		assert.equal(job.status, "completed");
		assert.equal(job.conclusion, "success");
		const artifactName
			= `${item.artifactPrefix}-${dependentSignatureHostedProducer}`;
		const matchingArtifacts = artifacts.filter(item =>
			item.name === artifactName);
		assert.equal(matchingArtifacts.length, 1, artifactName);
		const artifact = matchingArtifacts[0];
		assert.equal(artifact.expired, false);
		assert.equal(artifact.workflow_run?.id, dependentSignatureHostedRunId);
		assert.equal(artifact.workflow_run?.head_sha
			, dependentSignatureHostedProducer);

		const root = join(output, item.id);
		await mkdir(root);
		const jobBytes = api(`${repository}/actions/jobs/${job.id}`);
		const artifactBytes = api(
			`${repository}/actions/artifacts/${artifact.id}`);
		assert.equal(object(jobBytes, "job API record").id, job.id);
		assert.equal(object(artifactBytes, "artifact API record").id
			, artifact.id);
		await writeFile(join(root, "run.json"), runBytes, { flag: "wx" });
		await writeFile(join(root, "job.json"), jobBytes, { flag: "wx" });
		await writeFile(join(root, "artifact.json"), artifactBytes
			, { flag: "wx" });
		await stream(`${repository}/actions/jobs/${job.id}/logs`
			, join(root, "job.log"));
		const zip = join(root, "artifact.zip");
		await stream(`${repository}/actions/artifacts/${artifact.id}/zip`, zip);
		const metadata = object(await readFile(join(root, "artifact.json"))
			, "artifact API record");
		assert.equal((await stat(zip)).size, metadata.size_in_bytes);
		assert.equal(metadata.digest, `sha256:${await digestFile(zip)}`);
		const inputs = dependentSignatureHostedInputs(output, item);
		if(item === dependentSignatureHostedReceipt)
		{
			const captured = await inspectDependentSignatureHostedReceipt(inputs);
			assertDependentSignatureHostedReceiptSteps(captured.api.job.bytes);
		}
		else
		{
			const captured = await inspectDependentSignatureHostedArtifact(
				inputs, item);
			assertDependentSignatureHostedSteps(item, captured.api.job.bytes);
		}
	}

	complete = true;
	process.stdout.write(JSON.stringify({
		output, producerCommit: dependentSignatureHostedProducer
		, runId: dependentSignatureHostedRunId
		, lanes: dependentSignatureHostedLanes.length, profiles: 17, cells: 34
		, reports: 44, artifacts: selected.length
	}, null, 2) + "\n");
}
finally
{
	if(!complete) await rm(output, { recursive: true });
}
