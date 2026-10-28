/**
 * Keep hosted reviewed-Fin evidence scoped to its successful jobs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	inspectReviewedFinWasmEntryHostedArtifact
} from "./helpers/reviewed-fin-wasm-entry-hosted-archive.mjs";

const revision = "1".repeat(40);

const fixture = async root => {
	const zip = Buffer.from("authenticated hosted artifact\n");
	const run = {
		id: 4242, status: "completed", conclusion: "success"
		, head_sha: revision, path: ".github/workflows/consumer-matrix.yml"
		, repository: { full_name: "seanmorris/lean-bridge" }
		, head_repository: { full_name: "seanmorris/lean-bridge" }
		, event: "push", run_attempt: 3
		, html_url: "https://github.com/seanmorris/lean-bridge/actions/runs/4242"
		, created_at: "2026-10-28T00:00:00Z"
		, updated_at: "2026-10-28T00:05:00Z"
	};
	const job = {
		id: 4343, run_id: run.id, head_sha: revision
		, status: "completed", conclusion: "success"
		, name: "Reviewed Fin Wasm entry (original)"
		, labels: ["ubuntu-24.04"], runner_name: "GitHub Actions 1"
		, runner_group_name: "GitHub Actions"
		, started_at: "2026-10-28T00:01:00Z"
		, completed_at: "2026-10-28T00:04:00Z"
	};
	const artifact = {
		id: 4444, name: `reviewed-fin-wasm-entry-original-${revision}-3`
		, expired: false, size_in_bytes: zip.length
		, digest: `sha256:${sha256(zip)}`
		, workflow_run: { id: run.id, head_sha: revision }
		, created_at: "2026-10-28T00:04:00Z"
		, expires_at: "2026-11-27T00:04:00Z"
	};
	const paths = {
		"run-json": join(root, "run.json")
		, "job-json": join(root, "job.json")
		, "artifact-json": join(root, "artifact.json")
		, "artifact-zip": join(root, "artifact.zip")
		, "job-log": join(root, "job.log")
	};
	await Promise.all([
		writeFile(paths["run-json"], canonicalJson(run))
		, writeFile(paths["job-json"], canonicalJson(job))
		, writeFile(paths["artifact-json"], canonicalJson(artifact))
		, writeFile(paths["artifact-zip"], zip)
		, writeFile(paths["job-log"], "successful field job\n")
	]);
	return { artifact, job, paths, run };
};

test("reviewed Fin hosted evidence accepts only a successful selected job"
	, async t => {
		const root = await mkdtemp(join(tmpdir(), "lean-reviewed-fin-run-"));
		t.after(() => rm(root, { recursive: true }));
		const value = await fixture(root);
		for(const conclusion of ["success", "failure", "cancelled"])
		{
			await writeFile(value.paths["run-json"], canonicalJson({
				...value.run, conclusion
			}));
			const accepted = await inspectReviewedFinWasmEntryHostedArtifact(
				value.paths, "original");
			assert.equal(accepted.hostedRun.runConclusion, conclusion);
		}

		for(const run of [
			{ ...value.run, status: "in_progress", conclusion: null }
			, { ...value.run, conclusion: "neutral" }
		]) {
			await writeFile(value.paths["run-json"], canonicalJson(run));
			await assert.rejects(inspectReviewedFinWasmEntryHostedArtifact(
				value.paths, "original"));
		}

		await writeFile(value.paths["run-json"], canonicalJson(value.run));
		await writeFile(value.paths["job-json"], canonicalJson({
			...value.job, conclusion: "failure"
		}));
		await assert.rejects(inspectReviewedFinWasmEntryHostedArtifact(
			value.paths, "original"));
		assert.deepEqual(await readFile(value.paths["artifact-zip"])
			, Buffer.from("authenticated hosted artifact\n"));
	}
);
