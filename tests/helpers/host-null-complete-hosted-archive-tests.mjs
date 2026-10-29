/**
 * Refuse malformed, mixed-producer and stale complete HostNull selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	hostNullCompleteCells, hostNullCompleteHostedInputs
	, hostNullCompleteFocusedWorkflow
	, hostNullCompleteHostedLanes, hostNullCompleteHostedOriginal
	, hostNullCompleteLaneContract
	, hostNullCompleteHostedSourcePath, hostNullCompleteHostedSources
	, hostNullCompletePositions
	, hostNullCompleteProfiles, hostNullCompleteRoutes
	, hostNullCompleteWorkflow, inspectHostNullCompleteHostedArtifacts
	, parseHostNullCompleteHostedArchiveArgs
	, readHostNullCompleteGitHubCollection
} from "./host-null-complete-hosted-archive.mjs";

const revision = "a".repeat(40);
const run = Object.freeze({
	id: 71, status: "completed", conclusion: "failure", head_sha: revision
	, path: hostNullCompleteWorkflow, run_attempt: 2, event: "push"
	, head_branch: "codex/vo2190-host-null-systems"
	, html_url: "https://example.invalid/run/71"
	, created_at: "2026-10-29T00:00:00Z"
	, updated_at: "2026-10-29T01:00:00Z"
	, repository: { full_name: "seanmorris/lean-bridge" }
	, head_repository: { full_name: "seanmorris/lean-bridge" }
});

const makeInputs = async (
	mutate = () => {}, workflow = hostNullCompleteWorkflow
) => {
	const root = await mkdtemp(join(tmpdir(), "lean-host-null-complete-"));
	const records = hostNullCompleteHostedLanes.map((selectedLane, index) => {
		const zip = Buffer.from(`host-null-${selectedLane.id}\n`);
		const selectedRun = structuredClone(run);
		selectedRun.path = workflow;
		selectedRun.event = workflow === hostNullCompleteFocusedWorkflow
			? "workflow_dispatch" : "push";
		const contract = hostNullCompleteLaneContract(selectedLane, workflow);
		return {
			lane: selectedLane, zip, run: selectedRun
			, job: {
				id: workflow === hostNullCompleteFocusedWorkflow
					&& selectedLane.id === "php-wasm" ? 101 : 100 + index
				, run_id: run.id, head_sha: revision
				, status: "completed", conclusion: "success"
				, name: contract.jobName, labels: ["ubuntu-24.04"]
				, runner_name: "hosted", runner_group_name: "GitHub Actions"
				, started_at: "2026-10-29T00:10:00Z"
				, completed_at: "2026-10-29T00:20:00Z"
			}
			, artifact: {
				id: 200 + index
				, name: `${selectedLane.artifactPrefix}-${revision}`
				, expired: false, size_in_bytes: zip.length
				, digest: `sha256:${sha256(zip)}`
				, workflow_run: { id: run.id, head_sha: revision }
				, created_at: "2026-10-29T00:21:00Z"
				, expires_at: "2026-11-28T00:21:00Z"
			}
		};
	}
	);
	mutate(records);
	for(const record of records)
	{
		const paths = hostNullCompleteHostedInputs(root, record.lane);
		await mkdir(join(root, record.lane.id));
		await writeFile(paths["artifact-zip"], record.zip);
		await writeFile(paths["run-json"], canonicalJson(record.run));
		await writeFile(paths["job-json"], canonicalJson(record.job));
		await writeFile(paths["artifact-json"], canonicalJson(record.artifact));
	}
	return root;
};

test("complete HostNull policy partitions exactly 170 cells", () => {
	assert.deepEqual(hostNullCompleteRoutes, ["ordinary", "reviewed"]);
	assert.deepEqual(hostNullCompletePositions, [
		"parameter", "result", "field", "callback-parameter", "callback-result"
	]);
	assert.equal(hostNullCompleteHostedLanes.length, 7);
	assert.equal(hostNullCompleteProfiles.length, 17);
	assert.equal(new Set(hostNullCompleteProfiles).size, 17);
	assert.equal(hostNullCompleteCells.length, 170);
	assert.equal(new Set(hostNullCompleteCells.map(cell =>
		`${cell.route}:${cell.profile}:${cell.position}`)).size, 170);
});

test("complete HostNull input selection is explicit and canonical", () => {
	const root = "/tmp/host-null-complete-input";
	assert.equal(parseHostNullCompleteHostedArchiveArgs([
		"--input-root", root
	]), root);
	assert.deepEqual(hostNullCompleteHostedInputs(
		root, hostNullCompleteHostedLanes[0]), {
		"artifact-zip": `${root}/javascript-browser/artifact.zip`
		, "run-json": `${root}/javascript-browser/run.json`
		, "job-json": `${root}/javascript-browser/job.json`
		, "artifact-json": `${root}/javascript-browser/artifact.json`}
	);
	for(const args of [[], ["--input-root", "relative"]
		, ["--other", root], ["--input-root", `${root}/../other`]])
		assert.throws(() => parseHostNullCompleteHostedArchiveArgs(args));
});

test("complete HostNull GitHub collections cannot truncate or drift", async () => {
	const values = Array.from({ length: 137 }, (_, index) => ({ id: index + 1 }));
	const pages = [];
	const selected = await readHostNullCompleteGitHubCollection("jobs", page => {
		pages.push(page);
		return {
			total_count: values.length
			, jobs: values.slice((page - 1) * 100, page * 100)
		};
	});
	assert.deepEqual(pages, [1, 2]);
	assert.deepEqual(selected, values);
	await assert.rejects(readHostNullCompleteGitHubCollection(
		"jobs", page => ({ total_count: 101
			, jobs: page === 1
			? values.slice(0, 99) : values.slice(99, 101) }))
	);
	await assert.rejects(readHostNullCompleteGitHubCollection(
		"artifacts", page => ({ total_count: 101
			, artifacts: page === 1
			? values.slice(0, 100) : [{ id: 100 }] }))
	);
	await assert.rejects(readHostNullCompleteGitHubCollection(
		"jobs", page => ({ total_count: page === 1 ? 101 : 102
			, jobs: page === 1 ? values.slice(0, 100) : values.slice(100, 101) }))
	);
});

test("complete HostNull selection accepts seven successful jobs from one failed run", async t => {
	const root = await makeInputs();
	t.after(() => rm(root, { recursive: true, force: true }));
	const selected = await inspectHostNullCompleteHostedArtifacts(root, revision);
	assert.equal(selected.schemaVersion, 1);
	assert.equal(selected.producerCommit, revision);
	assert.equal(selected.runId, run.id);
	assert.equal(selected.captures.length, 7);
	assert.deepEqual(selected.cells, hostNullCompleteCells);
});

test("focused HostNull selection accepts seven artifacts from six exact jobs"
	, async t => {
	const root = await makeInputs(() => {}, hostNullCompleteFocusedWorkflow);
	t.after(() => rm(root, { recursive: true, force: true }));
	const selected = await inspectHostNullCompleteHostedArtifacts(root, revision);
	assert.equal(selected.captures.length, 7);
	assert.equal(new Set(selected.captures.map(capture =>
		capture.hostedRun.job.id)).size, 6);
	assert.ok(selected.captures.every(capture =>
		capture.hostedRun.workflow === hostNullCompleteFocusedWorkflow));
	}
);

test("complete HostNull selection rejects malformed and mixed identities", async t => {
	const mutations = [
		records => { records[1].artifact.workflow_run.head_sha = "b".repeat(40); }
		, records => { records[2].artifact.name = `host-null-php-wasm-${"b".repeat(40)}`; }
		, records => { records[3].run.id += 1; records[3].job.run_id += 1; records[3].artifact.workflow_run.id += 1; }
		, records => { records[4].job.id = records[3].job.id; }
		, records => { records[5].artifact.id = records[4].artifact.id; }
		, records => { records[6].job.conclusion = "failure"; }
	];
	for(const mutate of mutations)
	{
		const root = await makeInputs(mutate);
		t.after(() => rm(root, { recursive: true, force: true }));
		await assert.rejects(inspectHostNullCompleteHostedArtifacts(root));
	}
	const root = await makeInputs();
	t.after(() => rm(root, { recursive: true, force: true }));
	await assert.rejects(inspectHostNullCompleteHostedArtifacts(
		root, "b".repeat(40)));
});

test("complete HostNull replay retains a closed immutable source inventory", () => {
	const head = execFileSync("git", ["rev-parse", "HEAD"], {
		encoding: "utf8"
	}).trim();
	const sources = hostNullCompleteHostedSources({
		producer: head, checker: head, archiver: head
	});
	assert.ok(sources.length > 100);
	assert.equal(new Set(sources.map(source =>
		`${source.role}:${source.path}`)).size, sources.length);
	for(const role of ["producer", "checker", "archiver"])
		assert.ok(sources.some(source => source.role === role));
	for(const source of sources)
	{
		assert.equal(source.revision, head);
		assert.ok(hostNullCompleteHostedOriginal(
			source.revision, source.path).length > 0, source.path);
		assert.equal(hostNullCompleteHostedSourcePath(source)
			, `sources/${source.role}/${source.path}`);
	}
	assert.throws(() => hostNullCompleteHostedSourcePath({
		role: "unknown", revision: head, path: "package.json"
	}));
});
