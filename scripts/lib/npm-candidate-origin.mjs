/** @file Bind one owned-record package shard to the requested commit and Actions attempt. */
import assert from "node:assert/strict";
import { ownedCheckedRecordHostedLanes } from "../../tests/helpers/owned-checked-record-hosted-contracts.mjs";
import { ownedCheckedRecordNpmWorkflow } from "../../tests/helpers/owned-checked-record-npm-producer.mjs";

const repository = "seanmorris/lean-bridge";
const lane = ownedCheckedRecordHostedLanes.javascript;

/**
 * Refuse other commits, workflows, repositories and non-successful runs.
 *
 * @param run - Original Actions run record.
 * @param id - Run ID requested by the operator.
 * @param commit - Full candidate commit requested by the operator.
 */
export function assertNpmCandidateRun(run, id, commit)
{
	assert.equal(String(run.id), id);
	assert.equal(run.head_sha, commit, "This run did not build the requested candidate");
	assert.equal(run.path, ownedCheckedRecordNpmWorkflow);
	assert.equal(run.repository.full_name, repository);
	assert.equal(run.head_repository.full_name, repository);
	assert.equal(run.status, "completed", "Wait for the original run to finish");
	assert.equal(run.conclusion, "success", "A failed producer cannot qualify this candidate");
}

/**
 * Refuse stale attempts even when a rerun kept the same commit and artifact name.
 *
 * @param run - Verified original run record.
 * @param job - Job selected from that attempt.
 * @param artifact - Metadata for the original uploaded archive.
 */
export function assertNpmCandidateArtifact(run, job, artifact)
{
	assert.equal(job.name, lane.job);
	assert.equal(job.run_id, run.id);
	assert.equal(job.run_attempt, run.run_attempt);
	assert.equal(job.head_sha, run.head_sha);
	assert.equal(job.conclusion, "success");
	assert.equal(artifact.name, lane.prefix + "-" + run.head_sha);
	assert.equal(artifact.expired, false);
	assert.equal(artifact.workflow_run.id, run.id);
	assert.equal(artifact.workflow_run.head_sha, run.head_sha);
	const created = Date.parse(artifact.created_at);
	assert.ok(Date.parse(job.started_at) <= created && created <= Date.parse(job.completed_at)
		, "Artifact is not from this job attempt");
	assert.ok(Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0);
	assert.ok(artifact.size_in_bytes <= 128 * 1024 ** 2, "Inspect unexpected npm shard size before downloading");
}
