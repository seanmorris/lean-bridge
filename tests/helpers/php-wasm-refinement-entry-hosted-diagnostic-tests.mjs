/**
 * Distinguish recoverable original diagnostics from positive matrix evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkPhpWasmEntryHostedDiagnosticArchive, checkPhpWasmEntryHostedDiagnosticIdentity
} from "./php-wasm-refinement-entry-hosted-diagnostic.mjs";
import {
	checkPhpWasmRefinementEntryHostedIdentities, phpWasmRefinementEntryHostedContracts
	, phpWasmRefinementEntryHostedTagPrefix, phpWasmRefinementEntryHostedWorkflow
} from "./php-wasm-refinement-entry-hosted-identities.mjs";

const bytes = Buffer.from("diagnostic container is not a positive ZIP fixture");
const fixture = () => {
	const revision = "a".repeat(40), contract = phpWasmRefinementEntryHostedContracts(revision)[0];
	const run = { id: 10, run_attempt: 2, head_sha: revision
		, head_branch: phpWasmRefinementEntryHostedTagPrefix + revision
		, repository: { id: 1, full_name: "seanmorris/lean-bridge" }
		, head_repository: { id: 1, full_name: "seanmorris/lean-bridge" }
		, path: phpWasmRefinementEntryHostedWorkflow
		, status: "in_progress", conclusion: null, event: "create"
		, html_url: "https://github.com/seanmorris/lean-bridge/actions/runs/10"
		, created_at: "2026-10-25T01:00:00Z", updated_at: "2026-10-25T01:01:00Z" };
	const job = { id: 20, run_id: 10, run_attempt: 2, head_sha: revision
		, head_branch: run.head_branch, name: contract.job, labels: ["ubuntu-24.04"]
		, status: "completed", conclusion: "failure"
		, started_at: "2026-10-25T01:01:00Z", completed_at: "2026-10-25T01:05:00Z"
		, steps: [{ name: contract.steps.at(-1), status: "completed", conclusion: "success" }] };
	const artifact = { id: 30, name: contract.name, expired: false
		, size_in_bytes: bytes.length, digest: "sha256:" + sha256(bytes)
		, created_at: "2026-10-25T01:03:00Z", updated_at: "2026-10-25T01:04:00Z"
		, expires_at: "2026-11-24T01:03:00Z"
		, workflow_run: { id: 10, head_sha: revision, head_branch: run.head_branch
			, repository_id: 1, head_repository_id: 1 } };
	return { run, job, artifact, zip: { bytes: bytes.length, sha256: sha256(bytes) } };
};

test("PHP-Wasm diagnostics preserve live, failed and successful states without promotion", () => {
	for(const status of ["queued", "in_progress", "completed"])
		for(const conclusion of ["success", "failure", "cancelled"])
		{
			const input = fixture(); input.run.status = status;
			input.run.conclusion = status === "completed" ? conclusion : null;
			input.run.updated_at = "2026-10-25T01:06:00Z"; input.job.conclusion = conclusion;
			const original = structuredClone(input);
			const result = checkPhpWasmEntryHostedDiagnosticIdentity(input);
			assert.deepEqual(input, original);
			assert.equal(result.scope, "diagnostic-only"); assert.equal(result.replayedRoutes, 0);
			assert.equal(result.requiredRoutes, 30); assert.equal(result.runStatus, status);
			assert.equal(result.runConclusion, input.run.conclusion);
			assert.equal(result.jobConclusion, conclusion);
			assert.throws(() => checkPhpWasmRefinementEntryHostedIdentities(input.run
				, [{ name: input.artifact.name, job: input.job, artifact: input.artifact, zip: input.zip }]));
		}
});

test("PHP-Wasm diagnostics reject foreign, stale, missing and substituted identities", () => {
	for(const mutation of [
		value => { value.extra = true; }
		, value => { value.run.repository.full_name = "foreign/repo"; }
		, value => { value.run.head_repository.id++; }
		, value => { value.run.head_branch = "master"; }
		, value => { value.run.event = "pull_request"; }
		, value => { value.run.path = ".github/workflows/unrelated.yml"; }
		, value => { value.run.conclusion = "success"; }
		, value => { value.job.run_attempt++; }
		, value => { value.job.run_id++; }
		, value => { value.job.head_sha = "b".repeat(40); }
		, value => { value.job.name = "substituted job"; }
		, value => { value.job.steps = []; }
		, value => { value.job.steps.push(value.job.steps[0]); }
		, value => { value.job.steps[0].conclusion = "failure"; }
		, value => { value.artifact.name = "unrelated"; }
		, value => { value.artifact.expired = true; }
		, value => { value.artifact.workflow_run.repository_id++; }
		, value => { value.artifact.size_in_bytes++; }
		, value => { value.zip.sha256 = "0".repeat(64); }
		, value => { value.artifact.created_at = "2026-10-25T00:59:00Z"; }
		, value => { value.artifact.updated_at = "2026-10-25T01:06:00Z"; }
	]) {
		const input = fixture(); mutation(input);
		assert.throws(() => checkPhpWasmEntryHostedDiagnosticIdentity(input));
	}
});

test("PHP-Wasm diagnostic CLI refuses another checkout before writing evidence", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-entry-diagnostic-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const input = fixture(), args = ["--output", join(root, "must-not-exist")];
	for(const name of ["run", "job", "artifact"])
	{
		const path = join(root, name + ".json"); await writeFile(path, canonicalJson(input[name]));
		args.push("--" + name + "-json", path);
	}
	const zip = join(root, "original.zip"); await writeFile(zip, bytes); args.push("--artifact-zip", zip);
	const result = spawnSync(process.execPath, [resolve("scripts/archive-php-wasm-entry-hosted-diagnostic.mjs"), ...args]
		, { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.equal(result.status, 1); assert.match(result.stderr, /archiver runs in its own checkout/u);
	assert.deepEqual((await readdir(root)).sort(), ["artifact.json", "job.json", "original.zip", "run.json"]);
	assert.deepEqual(await readFile(zip), bytes);
});

test("PHP-Wasm diagnostic checker refuses malformed receipts without changing bytes", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-entry-diagnostic-refusal-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const value of [{}, { schemaVersion: 1, kind: "installed-matrix", identity: { replayedRoutes: 30 } }])
	{
		const original = canonicalJson(value); await writeFile(join(root, "index.json"), original);
		await assert.rejects(checkPhpWasmEntryHostedDiagnosticArchive(root));
		assert.equal(await readFile(join(root, "index.json"), "utf8"), original);
		assert.deepEqual(await readdir(root), ["index.json"]);
	}
});
