/**
 * Bind all original API records and ZIP identities for one complete PHP-Wasm
 * entry matrix. This gate does not establish installed or mathematical results;
 * every original ZIP must still be extracted and its records independently
 * replayed by the existing thirty-route verifier.
 *
 * @file
 */
import assert from "node:assert/strict";
import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { checkedRecordValueIndexHostedDigest } from "./checked-record-value-index-hosted-archive.mjs";
import { phpWasmRefinementEntryArtifactNames } from "./php-wasm-refinement-entry-hosted-summary.mjs";
import {
	phpWasmRefinementEntryMatrix, phpWasmRefinementEntryMatrixLocation
} from "./php-wasm-refinement-entry-matrix.mjs";

export const phpWasmRefinementEntryHostedWorkflow
	= ".github/workflows/php-wasm-refinement-entry-promotion.yml";
export const phpWasmRefinementEntryHostedTagPrefix = "ci/php-wasm-refinement-entry/";
const repository = "seanmorris/lean-bridge";
const kinds = Object.freeze({
	copied: Object.freeze({ label: "graph", probe: "graph probe" })
	, owned: Object.freeze({ label: "owned", probe: "owned probe" })
	, indexed: Object.freeze({ label: "copied", probe: "copied probe" })
	, callback: Object.freeze({ label: "synchronous", probe: "callback probes" })
});
const object = (value, label) => assert.ok(value && typeof value === "object"
	&& !Array.isArray(value), label);
const exact = (value, keys, label) => {
	object(value, label); assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), label);
};
const positive = (value, label) => assert.ok(Number.isSafeInteger(value) && value > 0, label);
const timestamp = (value, label) => {
	assert.equal(typeof value, "string", label);
	assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u, label);
	const parsed = Date.parse(value); assert.ok(Number.isFinite(parsed), label);
	assert.equal(new Date(parsed).toISOString(), value.replace("Z", ".000Z"), label);
	return parsed;
};

/**
 * Exact producer and aggregate artifact/job/step identities, in matrix order.
 *
 * @param producerCommit - Full common Git source revision.
 */
export const phpWasmRefinementEntryHostedContracts = producerCommit => {
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const contracts = phpWasmRefinementEntryArtifactNames(producerCommit).map(name => {
		const cells = phpWasmRefinementEntryMatrix.filter(cell =>
			phpWasmRefinementEntryMatrixLocation(cell, producerCommit).artifact === name);
		const { kind, family, route } = cells[0], definition = kinds[kind];
		assert.ok(cells.every(cell => cell.kind === kind && cell.family === family));
		const callback = kind === "callback";
		const selection = callback ? family : `${family} ${route}`;
		return Object.freeze({
			name, kind, cells: Object.freeze(cells.map(cell => cell.id))
			, job: `Produce ${kind} refinement entry artifacts / ${selection} ${definition.label} entries`
			, steps: Object.freeze([
				"Check out the exact revision and evidence history", "Install Node.js"
				, "Install dependencies without lifecycle scripts"
				, callback ? "Check the callback observer before provisioning the runtime"
					: "Check the observer before provisioning the runtime"
				, "Build the pinned PHP-Wasm runtime inputs"
				, `Reproduce, install and execute the selected ${definition.probe}`
				, callback ? "Preserve original and partial callback-entry records"
					: "Preserve original and partial compiler-input records"
			])
			, enforcement: `Enforce ${callback ? "callback" : definition.label} entry production`
		});
	});
	assert.equal(contracts.length, 27);
	contracts.push(Object.freeze({
		name: `complete-php-wasm-refinement-entry-promotion-${producerCommit}`
		, kind: "aggregate", cells: Object.freeze([])
		, job: "Authenticate all 30 refinement entry routes"
		, steps: Object.freeze([
			"Check out the exact producer revision and evidence history"
			, "Install Node.js"
			, "Install verifier dependencies without lifecycle scripts"
			, "Download the exact current-run producer artifacts"
			, "Recheck every retained record and close the route matrix"
			, "Preserve the complete promotion result or verifier diagnostics"
		])
		, enforcement: "Enforce complete route promotion"
	}));
	return Object.freeze(contracts);
};

const checkRun = run => {
	object(run, "run API record"); positive(run.id, "run id");
	positive(run.run_attempt, "run attempt");
	assert.equal(run.repository?.full_name, repository);
	assert.equal(run.head_repository?.full_name, repository);
	positive(run.repository.id, "repository id");
	assert.equal(run.head_repository.id, run.repository.id);
	assert.match(run.head_sha, /^[a-f0-9]{40}$/u);
	assert.equal(run.path, phpWasmRefinementEntryHostedWorkflow);
	assert.equal(run.status, "completed", "aggregate run must be terminal");
	assert.equal(run.conclusion, "success", "partial/failed runs cannot establish matrix acceptance");
	assert.ok(["create", "schedule", "workflow_dispatch"].includes(run.event));
	assert.ok(typeof run.head_branch === "string" && run.head_branch.length > 0);
	if(run.event === "create")
		assert.equal(run.head_branch, phpWasmRefinementEntryHostedTagPrefix + run.head_sha);
	assert.equal(run.html_url, `https://github.com/${repository}/actions/runs/${run.id}`);
	assert.ok(timestamp(run.created_at, "run creation") <= timestamp(run.updated_at, "run update"));
};

const checkJob = (run, contract, job) => {
	object(job, "job API record"); positive(job.id, "job id");
	assert.equal(job.run_id, run.id); assert.equal(job.run_attempt, run.run_attempt);
	assert.equal(job.head_sha, run.head_sha); assert.equal(job.head_branch, run.head_branch);
	assert.equal(job.name, contract.job); assert.equal(job.status, "completed");
	assert.equal(job.conclusion, "success");
	assert.ok(Array.isArray(job.labels) && job.labels.includes("ubuntu-24.04"));
	const start = timestamp(job.started_at, "job start"), end = timestamp(job.completed_at, "job end");
	assert.ok(start <= end && start >= timestamp(run.created_at, "run creation")
		&& end <= timestamp(run.updated_at, "run update"), "job belongs to the run time window");
	assert.ok(Array.isArray(job.steps) && job.steps.length > 0);
	let number = 0;
	for(const step of job.steps)
	{
		object(step, "job step"); positive(step.number, "step number");
		assert.ok(step.number > number, "job steps are ordered and unique"); number = step.number;
		assert.equal(step.status, "completed");
		assert.ok(["success", "skipped"].includes(step.conclusion), step.name);
	}
	number = 0;
	for(const name of [...contract.steps, contract.enforcement])
	{
		const selected = job.steps.filter(step => step.name === name);
		assert.equal(selected.length, 1, `exact required step: ${name}`);
		const step = selected[0]; assert.ok(step.number > number, `step order: ${name}`);
		assert.equal(step.conclusion, name === contract.enforcement ? "skipped" : "success", name);
		number = step.number;
	}
};

/**
 * Authenticate a complete ordered API/ZIP-identity set, not its saved results.
 * Original failure/partial records must be preserved separately and are never
 * relabeled successful or admitted through this positive identity gate.
 *
 * @param run - Original parsed GitHub run API record.
 * @param captures - Exact ordered parsed jobs/artifacts and measured ZIP digests.
 */
export const checkPhpWasmRefinementEntryHostedIdentities = (run, captures) => {
	checkRun(run);
	const contracts = phpWasmRefinementEntryHostedContracts(run.head_sha);
	assert.ok(Array.isArray(captures)); assert.equal(captures.length, contracts.length);
	const jobs = new Set(), artifacts = new Set();
	let bytes = 0;
	for(const [index, capture] of captures.entries())
	{
		exact(capture, ["name", "job", "artifact", "zip"], "hosted capture fields");
		const contract = contracts[index], { job, artifact, zip } = capture;
		assert.equal(capture.name, contract.name); checkJob(run, contract, job);
		object(artifact, "artifact API record"); positive(artifact.id, "artifact id");
		assert.ok(!jobs.has(job.id) && !artifacts.has(artifact.id), "unique jobs and artifacts");
		jobs.add(job.id); artifacts.add(artifact.id);
		assert.equal(artifact.name, contract.name); assert.equal(artifact.expired, false);
		assert.equal(artifact.workflow_run?.id, run.id);
		assert.equal(artifact.workflow_run.head_sha, run.head_sha);
		assert.equal(artifact.workflow_run.head_branch, run.head_branch);
		assert.equal(artifact.workflow_run.repository_id, run.repository.id);
		assert.equal(artifact.workflow_run.head_repository_id, run.head_repository.id);
		exact(zip, ["bytes", "sha256"], "measured ZIP identity"); positive(zip.bytes, "ZIP byte count");
		assert.match(zip.sha256, /^[a-f0-9]{64}$/u);
		assert.equal(artifact.size_in_bytes, zip.bytes);
		assert.equal(artifact.digest, `sha256:${zip.sha256}`);
		const created = timestamp(artifact.created_at, "artifact creation");
		const updated = timestamp(artifact.updated_at, "artifact update");
		assert.ok(created >= timestamp(job.started_at, "job start")
			&& created <= updated && updated <= timestamp(job.completed_at, "job end")
		, "artifact must come from the selected job attempt");
		assert.ok(timestamp(artifact.expires_at, "artifact expiry") > updated);
		bytes += zip.bytes; assert.ok(Number.isSafeInteger(bytes));
	}
	const aggregate = captures.at(-1).job;
	for(const capture of captures.slice(0, -1))
		assert.ok(timestamp(capture.job.completed_at, "producer end")
			<= timestamp(aggregate.started_at, "aggregate start"), "aggregate follows every producer");
	return Object.freeze({
		schemaVersion: 1, kind: "php-wasm-refinement-entry-hosted-identities-v1"
		, scope: "api-and-zip-identity-only", producerCommit: run.head_sha
		, runId: run.id, runAttempt: run.run_attempt, event: run.event
		, producerArtifacts: 27, aggregateArtifacts: 1, zipBytes: bytes
		, requiredRoutes: 30, replayedRoutes: 0
	});
};

const canonicalFile = async path => {
	assert.ok(typeof path === "string" && isAbsolute(path) && resolve(path) === path);
	assert.equal(await realpath(path), path, "hosted input must not traverse symlinks");
	const information = await lstat(path); assert.ok(information.isFile(), path);
	return information;
};
const apiRecord = async path => {
	const information = await canonicalFile(path);
	assert.ok(information.size > 0 && information.size <= 2 * 1024 * 1024, "bounded original API record");
	const bytes = await readFile(path); assert.equal(bytes.length, information.size);
	const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	object(value, "API object"); return { bytes, value, sha256: sha256(bytes) };
};

/**
 * Read unmodified API bytes and stream every original ZIP before writing any
 * evidence. This read-only operation offers no injectable verifier or digest.
 *
 * @param selection - Exact absolute input paths, in contract artifact order.
 */
export const inspectPhpWasmRefinementEntryHostedIdentities = async selection => {
	exact(selection, ["runJson", "artifacts"], "identity input selection");
	const run = await apiRecord(selection.runJson); checkRun(run.value);
	const contracts = phpWasmRefinementEntryHostedContracts(run.value.head_sha);
	assert.ok(Array.isArray(selection.artifacts)); assert.equal(selection.artifacts.length, contracts.length);
	const captures = [], original = [];
	for(const [index, selected] of selection.artifacts.entries())
	{
		exact(selected, ["name", "jobJson", "artifactJson", "artifactZip"], "artifact input selection");
		assert.equal(selected.name, contracts[index].name);
		const job = await apiRecord(selected.jobJson), artifact = await apiRecord(selected.artifactJson);
		const information = await canonicalFile(selected.artifactZip);
		const zip = { bytes: information.size
			, sha256: await checkedRecordValueIndexHostedDigest(selected.artifactZip) };
		captures.push({ name: selected.name, job: job.value, artifact: artifact.value, zip });
		original.push({ name: selected.name, job, artifact, zip });
	}
	const identity = checkPhpWasmRefinementEntryHostedIdentities(run.value, captures);
	return { identity, run, artifacts: original };
};
