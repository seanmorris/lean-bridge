/** @file Exercise trust boundaries without downloading a package or making a network request. */
import assert from "node:assert/strict";
import test from "node:test";
import { assertNpmCandidateArtifact, assertNpmCandidateRun } from "../../scripts/lib/npm-candidate-origin.mjs";
import { ownedCheckedRecordHostedLanes } from "./owned-checked-record-hosted-contracts.mjs";

const sha = "c".repeat(40), repo = {full_name: "seanmorris/lean-bridge"};
const run = {
	id: 42, run_attempt: 2, repository: repo, head_repository: repo
	, path: ".github/workflows/owned-checked-record-npm-browser.yml"
	, status: "completed", conclusion: "success", head_sha: sha
};
const lane = ownedCheckedRecordHostedLanes.javascript;
const job = {
	name: lane.job, run_id: 42, run_attempt: 2, head_sha: sha
	, conclusion: "success", started_at: "2026-01-01T00:00:00Z"
	, completed_at: "2026-01-01T00:30:00Z"
};
const artifact = {
	name: lane.prefix + "-" + sha, workflow_run: {id: 42, head_sha: sha}
	, expired: false, size_in_bytes: 1800, created_at: job.completed_at
};

test("accept the selected successful scoped producer and its upload", () => {
	assertNpmCandidateRun(run, "42", sha);
	assertNpmCandidateArtifact(run, job, artifact);
});
test("reject another candidate, a fork, an unrelated workflow or an unfinished or failed run", () => {
	for(const changes of [
		{head_sha: "d".repeat(40)}, {head_repository: {full_name: "fork/repo"}}
		, {path: lane.workflow}, {status: "in_progress"}, {conclusion: "failure"}
	]) assert.throws(() => assertNpmCandidateRun({...run,...changes}, "42", sha));
});
test("reject stale rerun evidence and artifacts that are unavailable or too large", () => {
	for(const changes of [
		{created_at: "2025-12-31T23:59:59Z"}, {expired: true}
		, {size_in_bytes: 129 * 1024 ** 2}, {workflow_run: {id: 41, head_sha: sha}}
	]) assert.throws(() => assertNpmCandidateArtifact(run, job, {...artifact,...changes}));
	assert.throws(() => assertNpmCandidateArtifact(run, {...job,run_attempt: 1}, artifact));
});
