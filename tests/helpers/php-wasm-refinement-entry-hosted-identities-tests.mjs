/**
 * Reject partial or substituted hosted identities before archive replay.
 * The small ZIP fixture is intentionally empty: identity acceptance must never
 * be confused with the independent installed-record verification still needed.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	checkPhpWasmRefinementEntryHostedIdentities
	, inspectPhpWasmRefinementEntryHostedIdentities
	, phpWasmRefinementEntryHostedContracts, phpWasmRefinementEntryHostedTagPrefix
	, phpWasmRefinementEntryHostedWorkflow
} from "./php-wasm-refinement-entry-hosted-identities.mjs";

const commit = "a".repeat(40);
const zipBytes = Buffer.from("504b0506000000000000000000000000000000000000", "hex");
const contracts = phpWasmRefinementEntryHostedContracts(commit);
const fixture = () => {
	const run = {
		id: 10, run_attempt: 2, head_sha: commit
		, head_branch: phpWasmRefinementEntryHostedTagPrefix + commit
		, repository: { id: 1, full_name: "seanmorris/lean-bridge" }
		, head_repository: { id: 1, full_name: "seanmorris/lean-bridge" }
		, path: phpWasmRefinementEntryHostedWorkflow, status: "completed"
		, conclusion: "success", event: "create"
		, html_url: "https://github.com/seanmorris/lean-bridge/actions/runs/10"
		, created_at: "2026-10-25T01:00:00Z", updated_at: "2026-10-25T02:00:00Z"
	};
	const captures = contracts.map((contract, index) => {
		const aggregate = contract.kind === "aggregate";
		const uploaded = aggregate ? "2026-10-25T01:07:00Z" : "2026-10-25T01:03:00Z";
		return {
			name: contract.name
			, job: {
				id: 100 + index, run_id: run.id, run_attempt: run.run_attempt
				, head_sha: commit, head_branch: run.head_branch, name: contract.job
				, status: "completed", conclusion: "success", labels: ["ubuntu-24.04"]
				, started_at: aggregate ? "2026-10-25T01:06:00Z" : "2026-10-25T01:01:00Z"
				, completed_at: aggregate ? "2026-10-25T01:08:00Z" : "2026-10-25T01:05:00Z"
				, steps: [...contract.steps, contract.enforcement].map((name, number) => ({
					name, number: number + 1, status: "completed"
					, conclusion: name === contract.enforcement ? "skipped" : "success"
				}))
			}
			, artifact: {
				id: 1000 + index, name: contract.name, expired: false
				, size_in_bytes: zipBytes.length, digest: `sha256:${sha256(zipBytes)}`
				, created_at: uploaded, updated_at: uploaded
				, expires_at: "2026-11-24T01:03:00Z"
				, workflow_run: { id: run.id, head_sha: commit, head_branch: run.head_branch
					, repository_id: 1, head_repository_id: 1 }
			}
			, zip: { bytes: zipBytes.length, sha256: sha256(zipBytes) }
		};
	});
	return { run, captures };
};
const reject = change => {
	const value = fixture(); change(value);
	assert.throws(() => checkPhpWasmRefinementEntryHostedIdentities(value.run, value.captures));
};

test("PHP-Wasm hosted identities bind the actual reusable job and artifact topology", async () => {
	assert.equal(contracts.length, 28);
	assert.equal(new Set(contracts.map(item => item.name)).size, 28);
	assert.equal(new Set(contracts.map(item => item.job)).size, 28);
	assert.equal(contracts.flatMap(item => item.cells).length, 30);
	assert.equal(contracts.filter(item => item.kind === "callback").length, 3);
	assert.ok(contracts.filter(item => item.kind === "callback").every(item => item.cells.length === 2));
	assert.equal(contracts[0].job, "Produce copied refinement entry artifacts / nominal-full ordinary graph entries");
	assert.equal(contracts.at(-1).job, "Authenticate all 30 refinement entry routes");
	assert.equal(contracts.at(-1).name, `complete-php-wasm-refinement-entry-promotion-${commit}`);
	const aggregate = await readFile(phpWasmRefinementEntryHostedWorkflow, "utf8");
	for(const contract of contracts)
	{
		const workflow = contract.kind === "aggregate" ? aggregate : await readFile(
			`.github/workflows/php-wasm-${contract.kind === "copied" ? "" : contract.kind + "-"}${contract.kind === "callback" ? "" : "refinement-"}entry.yml`, "utf8");
		for(const name of [...contract.steps, contract.enforcement])
			assert.ok(workflow.includes(`      - name: ${name}\n`), name);
		if(contract.kind !== "aggregate")
			assert.ok(aggregate.includes(`    name: Produce ${contract.kind} refinement entry artifacts\n`));
	}
	assert.ok(aggregate.includes('    - cron: "17 5 1 * *"'));
	assert.ok(aggregate.includes("  create:\n") && aggregate.includes("  workflow_dispatch:\n"));
});

test("PHP-Wasm hosted identities accept manual, scheduled and exact-tag runs without claiming replay", () => {
	for(const event of ["create", "workflow_dispatch", "schedule"])
	{
		const { run, captures } = fixture(); run.event = event;
		const original = structuredClone({ run, captures });
		const result = checkPhpWasmRefinementEntryHostedIdentities(run, captures);
		assert.deepEqual(result, {
			schemaVersion: 1, kind: "php-wasm-refinement-entry-hosted-identities-v1"
			, scope: "api-and-zip-identity-only", producerCommit: commit
			, runId: 10, runAttempt: 2, event
			, producerArtifacts: 27, aggregateArtifacts: 1
			, zipBytes: zipBytes.length * 28, requiredRoutes: 30, replayedRoutes: 0
		});
		assert.deepEqual({ run, captures }, original);
	}
});

test("PHP-Wasm hosted identities refuse incomplete, foreign and wrongly dispatched runs", () => {
	for(const change of [
		value => { value.run.status = "in_progress"; }
		, value => { value.run.conclusion = "failure"; }
		, value => { value.run.conclusion = "cancelled"; }
		, value => { value.run.repository.full_name = "fork/lean-bridge"; }
		, value => { value.run.head_repository.id = 2; }
		, value => { value.run.head_repository.full_name = "fork/lean-bridge"; }
		, value => { value.run.path = ".github/workflows/php-wasm-refinement-entry.yml"; }
		, value => { value.run.event = "push"; }
		, value => { value.run.event = "pull_request"; }
		, value => { value.run.head_branch = "ci/php-wasm-refinement-entry/wrong"; }
		, value => { delete value.run.run_attempt; }
		, value => { value.run.head_sha = "short"; }
		, value => { value.run.html_url += "/other"; }
		, value => { value.run.created_at = "2026-02-30T01:00:00Z"; }
		, value => { value.run.updated_at = value.run.created_at; }
	]) reject(change);
});

test("PHP-Wasm hosted identities reject missing, duplicate, reordered and wrong-attempt jobs", () => {
	for(const change of [
		value => { value.captures.pop(); }
		, value => { value.captures.push(value.captures[0]); }
		, value => { value.captures[1] = value.captures[0]; }
		, value => { value.captures.reverse(); }
		, value => { value.captures[1].job.id = value.captures[0].job.id; }
		, value => { value.captures[0].job.run_id++; }
		, value => { value.captures[0].job.run_attempt--; }
		, value => { value.captures[0].job.head_sha = "b".repeat(40); }
		, value => { value.captures[0].job.head_branch = "master"; }
		, value => { value.captures[0].job.name += " other"; }
		, value => { value.captures[0].job.status = "in_progress"; }
		, value => { value.captures[0].job.conclusion = "failure"; }
		, value => { value.captures[0].job.labels = ["self-hosted"]; }
		, value => { value.captures[0].job.steps.splice(-2, 1); }
		, value => { value.captures[0].job.steps.splice(-3, 1); }
		, value => { value.captures[0].job.steps.at(-1).conclusion = "success"; }
		, value => { value.captures[0].job.steps[3].conclusion = "skipped"; }
		, value => { value.captures[0].job.steps[1].number = 1; }
		, value => { value.captures[0].job.steps[1].name = value.captures[0].job.steps[0].name; }
		, value => { value.captures[0].job.steps[1].status = "in_progress"; }
		, value => { value.captures.at(-1).job.steps.at(-2).conclusion = "skipped"; }
		, value => { value.captures.at(-1).job.started_at = "2026-10-25T01:02:00Z"; }
	]) reject(change);
});

test("PHP-Wasm hosted identities bind ZIP bytes and artifact lifetime to each original job", () => {
	for(const change of [
		value => { value.captures[1].artifact.id = value.captures[0].artifact.id; }
		, value => { value.captures[0].artifact.name += "-other"; }
		, value => { value.captures[0].artifact.expired = true; }
		, value => { value.captures[0].artifact.workflow_run.id++; }
		, value => { value.captures[0].artifact.workflow_run.head_sha = "b".repeat(40); }
		, value => { value.captures[0].artifact.workflow_run.head_branch = "master"; }
		, value => { value.captures[0].artifact.workflow_run.repository_id++; }
		, value => { value.captures[0].artifact.workflow_run.head_repository_id++; }
		, value => { value.captures[0].zip.bytes++; }
		, value => { value.captures[0].zip.sha256 = "0".repeat(64); }
		, value => { value.captures[0].artifact.digest = null; }
		, value => { value.captures[0].artifact.created_at = "2026-10-25T00:59:00Z"; }
		, value => { value.captures[0].artifact.updated_at = "2026-10-25T01:06:00Z"; }
		, value => { value.captures[0].artifact.expires_at = value.captures[0].artifact.created_at; }
		, value => { value.captures[0].accepted = true; }
	]) reject(change);
});

test("PHP-Wasm hosted identity inspection preserves raw API bytes and measures every ZIP", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-entry-identities-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { run, captures } = fixture();
	const originals = new Map();
	const put = async (name, bytes) => {
		const path = join(root, name); originals.set(path, bytes);
		await writeFile(path, bytes, { flag: "wx" }); return path;
	};
	const json = value => Buffer.from(JSON.stringify(value, null, 3) + "\n\n");
	const selection = { runJson: await put("run.json", json(run)), artifacts: [] };
	for(const [index, capture] of captures.entries())
		selection.artifacts.push({
			name: capture.name
			, jobJson: await put(`${index}-job.json`, json(capture.job))
			, artifactJson: await put(`${index}-artifact.json`, json(capture.artifact))
			, artifactZip: await put(`${index}-artifact.zip`, zipBytes)
		});
	const names = await readdir(root);
	const result = await inspectPhpWasmRefinementEntryHostedIdentities(selection);
	assert.equal(result.identity.replayedRoutes, 0);
	assert.deepEqual(result.run.bytes, originals.get(selection.runJson));
	assert.equal(result.run.sha256, sha256(result.run.bytes));
	for(const [index, item] of result.artifacts.entries())
	{
		assert.deepEqual(item.zip, captures[index].zip);
		for(const key of ["job", "artifact"])
		{
			assert.deepEqual(item[key].bytes, originals.get(selection.artifacts[index][`${key}Json`]));
			assert.equal(item[key].sha256, sha256(item[key].bytes));
		}
	}
	assert.deepEqual(await readdir(root), names, "inspection writes nothing");
	for(const [path, bytes] of originals) assert.deepEqual(await readFile(path), bytes);
	await writeFile(selection.artifacts[0].artifactZip, Buffer.alloc(zipBytes.length));
	await assert.rejects(inspectPhpWasmRefinementEntryHostedIdentities(selection));
	await writeFile(selection.artifacts[0].artifactZip, zipBytes);
	const link = join(root, "run-link.json"); await symlink(selection.runJson, link);
	await assert.rejects(inspectPhpWasmRefinementEntryHostedIdentities({ ...selection, runJson: link }));
	await assert.rejects(inspectPhpWasmRefinementEntryHostedIdentities({ ...selection, accepted: true }));
	await writeFile(selection.runJson, Buffer.from([0xff]));
	await assert.rejects(inspectPhpWasmRefinementEntryHostedIdentities(selection));
});
