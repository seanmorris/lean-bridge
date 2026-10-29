/**
 * Refuse malformed or mixed complete optional-parameter hosted inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	assertOptionalParameterHostedSteps, inspectOptionalParameterHostedArtifact
	, inspectOptionalParameterHostedReceipt, optionalParameterHostedInputs
	, optionalParameterHostedLanes, optionalParameterHostedProducer
	, optionalParameterHostedReceipt, optionalParameterHostedRunId
	, optionalParameterHostedWorkflow, parseOptionalParameterHostedArchiveArgs
	, validateOptionalParameterHostedReceipt
} from "./optional-parameter-hosted-archive.mjs";
import {
	optionalParameterFocusedWorkflow, optionalParameterMatrixCases
	, optionalParameterMatrixLanes, optionalParameterMatrixRoutes
} from "./optional-parameter-matrix.mjs";
import {
	buildOptionalParameterMatrixReceipt, optionalParameterMatrixResultPath
} from "./optional-parameter-matrix-receipt.mjs";

const result = (lane, route) => {
	const metrics = lane.key === "npm"
		? { checks: 27, rejections: 7, executions: 2, browserProfiles: 3 }
		: lane.key === "native"
			? { checks: 43, rejections: 4, executions: 4 }
			: lane.key === "php"
				? { checks: 46, rejections: 44, executions: 16 }
				: lane.key === "managed-jvm"
					? { checks: 46, executions: 4 }
					: { checks: 23, executions: 2 };
	return {
		lane: lane.key, route: route.reportRoute
		, producerCommit: optionalParameterHostedProducer
		, profiles: [...lane.profiles], cases: optionalParameterMatrixCases
		, ...metrics
	};
};

const makeInputs = async (selected, mutate = () => {}) => {
	const root = await mkdtemp(join(tmpdir(), "lean-optional-hosted-"));
	const zip = Buffer.from(`optional-${selected.key}\n`);
	const run = {
		id: optionalParameterHostedRunId, status: "completed"
		, conclusion: "success", head_sha: optionalParameterHostedProducer
		, path: optionalParameterHostedWorkflow, run_attempt: 1
		, event: "workflow_dispatch", head_branch: "optional"
		, html_url: "https://example.invalid/run"
		, created_at: "2026-10-29T00:00:00Z"
		, updated_at: "2026-10-29T01:00:00Z"
		, repository: { full_name: "seanmorris/lean-bridge" }
		, head_repository: { full_name: "seanmorris/lean-bridge" }
	};
	const steps = selected === optionalParameterHostedReceipt ? [] : [
		{ number: 10, name: selected.acceptance, conclusion: "success" }
		, { number: 11, name: selected.upload, conclusion: "success" }
		, { number: 12, name: selected.enforce, conclusion: "skipped" }
	];
	const job = {
		id: 81, run_id: run.id, head_sha: run.head_sha
		, status: "completed", conclusion: "success", name: selected.job
		, labels: ["ubuntu-24.04"], runner_name: "hosted"
		, runner_group_name: "GitHub Actions", steps
		, started_at: "2026-10-29T00:10:00Z"
		, completed_at: "2026-10-29T00:20:00Z"
	};
	const artifact = {
		id: 91, name: `${selected.artifactPrefix}-${run.head_sha}`
		, expired: false, size_in_bytes: zip.length
		, digest: `sha256:${sha256(zip)}`
		, workflow_run: { id: run.id, head_sha: run.head_sha }
		, created_at: "2026-10-29T00:21:00Z"
		, expires_at: "2026-11-28T00:21:00Z"
	};
	mutate({ run, job, artifact });
	const paths = optionalParameterHostedInputs(root, selected);
	await mkdir(join(root, selected.key));
	await writeFile(paths["artifact-zip"], zip);
	await writeFile(paths["run-json"], canonicalJson(run));
	await writeFile(paths["job-json"], canonicalJson(job));
	await writeFile(paths["artifact-json"], canonicalJson(artifact));
	await writeFile(paths["job-log"], "hosted log\n");
	return root;
};

test("optional hosted policy partitions ten lanes and seventeen profiles", () => {
	assert.equal(optionalParameterHostedLanes.length, 10);
	const profiles = optionalParameterHostedLanes.flatMap(lane => lane.profiles);
	assert.equal(profiles.length, 17);
	assert.equal(new Set(profiles).size, 17);
	assert.equal(optionalParameterMatrixRoutes.length, 2);
});

test("optional hosted input selection is explicit and canonical", () => {
	const root = "/tmp/optional-parameter-hosted-input";
	assert.equal(parseOptionalParameterHostedArchiveArgs([
		"--input-root", root
	]), root);
	assert.equal(optionalParameterHostedInputs(
		root, optionalParameterHostedLanes[0]
	)["artifact-zip"], `${root}/npm/artifact.zip`);
	assert.equal(optionalParameterHostedInputs(
		root, optionalParameterHostedReceipt
	)["artifact-zip"], `${root}/matrix/artifact.zip`);
	for(const args of [[], ["--input-root", "relative"]
		, ["--other", root], ["--input-root", `${root}/../other`]])
		assert.throws(() => parseOptionalParameterHostedArchiveArgs(args));
});

test("optional lane and aggregate identities bind to one exact run", async t => {
	const lane = optionalParameterHostedLanes[0];
	const laneRoot = await makeInputs(lane);
	t.after(() => rm(laneRoot, { recursive: true, force: true }));
	const captured = await inspectOptionalParameterHostedArtifact(
		optionalParameterHostedInputs(laneRoot, lane), lane);
	assert.equal(captured.revision, optionalParameterHostedProducer);
	assertOptionalParameterHostedSteps(lane, captured.api.job.bytes);
	const receiptRoot = await makeInputs(optionalParameterHostedReceipt);
	t.after(() => rm(receiptRoot, { recursive: true, force: true }));
	const receipt = await inspectOptionalParameterHostedReceipt(
		optionalParameterHostedInputs(receiptRoot, optionalParameterHostedReceipt));
	assert.equal(receipt.hostedRun.runId, optionalParameterHostedRunId);
});

test("optional hosted selection rejects drifted producer identity", async t => {
	const lane = optionalParameterHostedLanes[0];
	const root = await makeInputs(lane, ({ artifact }) => {
		artifact.workflow_run.head_sha = "b".repeat(40);
	});
	t.after(() => rm(root, { recursive: true, force: true }));
	await assert.rejects(inspectOptionalParameterHostedArtifact(
		optionalParameterHostedInputs(root, lane), lane));
});

test("optional aggregate receipt equals every independently checked result"
	, async () => {
		const values = new Map(), results = [];
		for(const [index, lane] of optionalParameterHostedLanes.entries())
			for(const route of optionalParameterMatrixRoutes)
			{
				const value = result(lane, route); results.push({ result: value });
				values.set(optionalParameterMatrixResultPath(
					optionalParameterMatrixLanes[index], route
					, optionalParameterHostedProducer
				), Buffer.from(canonicalJson(value)));
			}
		const receipt = await buildOptionalParameterMatrixReceipt(path => {
			assert.ok(values.has(path), path); return values.get(path);
		}, {
			repository: "seanmorris/lean-bridge"
			, workflow: optionalParameterFocusedWorkflow
			, producerCommit: optionalParameterHostedProducer
			, runId: optionalParameterHostedRunId, runAttempt: 1
		});
		assert.equal(validateOptionalParameterHostedReceipt(
			receipt, results), receipt);
		const changed = structuredClone(receipt);
		changed.records[0].result.checks += 1;
		assert.throws(() => validateOptionalParameterHostedReceipt(
			changed, results));
	}
);
