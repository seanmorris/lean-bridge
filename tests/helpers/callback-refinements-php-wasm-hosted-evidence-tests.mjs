/**
 * Positive replay and destructive controls for the retained callback-
 * refinement PHP-Wasm archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	assertCallbackRefinementsPhpWasmHostedApiBinding
	, assertCallbackRefinementsPhpWasmHostedOutputSet
	, callbackRefinementsPhpWasmHostedApiRecords
	, checkCallbackRefinementsPhpWasmHostedEvidence
	, reconstructCallbackRefinementsPhpWasmHostedArtifact
} from "./callback-refinements-php-wasm-hosted-evidence.mjs";

test("retained callback-refinement PHP-Wasm evidence replays", {
	timeout: 120_000
}, async () => {
	const checked = await checkCallbackRefinementsPhpWasmHostedEvidence();
	assert.equal(checked.index.hostedRun.runId, 39870952379);
	assert.equal(checked.index.hostedRun.job.id, 120144963711);
	assert.equal(checked.index.hostedRun.artifact.id, 12467650836);
	assert.equal(checked.index.accepted.results.length, 4);
});

test("callback-refinement PHP-Wasm evidence binds retained API bytes", () => {
	const api = {
		run: { bytes: Buffer.from("run"), sha256: sha256("run") }
		, job: { bytes: Buffer.from("job"), sha256: sha256("job") }
		, artifact: {
			bytes: Buffer.from("artifact"), sha256: sha256("artifact")
		}
	};
	const hostedRun = {
		repository: "seanmorris/lean-bridge", workflow: "workflow.yml"
		, runId: 11, runAttempt: 1, event: "workflow_dispatch"
		, url: "https://example/run", createdAt: "created", updatedAt: "updated"
		, job: { id: 12, name: "job", labels: ["ubuntu-24.04"]
			, runnerName: "runner", runnerGroup: "group"
			, startedAt: "started", completedAt: "completed" }
		, artifact: { id: 13, name: "artifact", bytes: 8
			, sha256: sha256("artifact")
			, apiDigest: `sha256:${sha256("artifact")}`
			, createdAt: "created", expiresAt: "expires" }
	};
	const index = { hostedRun: {
		...hostedRun, apiRecords: callbackRefinementsPhpWasmHostedApiRecords(api)
		, artifact: { ...hostedRun.artifact, members: [], parts: [{}] }
	} };
	const hosted = { hostedRun, api };
	assert.doesNotThrow(() =>
		assertCallbackRefinementsPhpWasmHostedApiBinding(index, hosted));
	const runTamper = structuredClone(index);
	runTamper.hostedRun.runId++;
	assert.throws(() =>
		assertCallbackRefinementsPhpWasmHostedApiBinding(runTamper, hosted));
	const apiTamper = structuredClone(index);
	apiTamper.hostedRun.apiRecords.job.bytes++;
	assert.throws(() =>
		assertCallbackRefinementsPhpWasmHostedApiBinding(apiTamper, hosted));
});

test("callback-refinement PHP-Wasm evidence closes its output set", () => {
	const index = { files: [
		{ path: "hosted/output/a.txt" }
		, { path: "hosted/output/b/c.txt" }
		, { path: "hosted/api/run.json" }
	] };
	assert.doesNotThrow(() => {
		assertCallbackRefinementsPhpWasmHostedOutputSet(index, [
			"b/c.txt", "a.txt"
		]);
	});
	assert.throws(() => assertCallbackRefinementsPhpWasmHostedOutputSet({
		files: [...index.files, { path: "hosted/output/extra.txt" }]
	}, ["b/c.txt", "a.txt"]));
});

test("callback-refinement PHP-Wasm ZIP reconstruction rejects tampering", async t => {
	const root = await mkdtemp(join(tmpdir(), "callback-refinement-part-test-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const bytes = Buffer.from("authenticated artifact bytes");
	await writeFile(join(root, "0000.part"), bytes);
	const part = {
		path: "0000.part", offset: 0, bytes: bytes.length, sha256: sha256(bytes)
	};
	const output = join(root, "valid.zip");
	assert.equal(await reconstructCallbackRefinementsPhpWasmHostedArtifact(
		root, [part], output), bytes.length);
	assert.deepEqual(await readFile(output), bytes);
	await assert.rejects(reconstructCallbackRefinementsPhpWasmHostedArtifact(
		root, [{ ...part, sha256: "0".repeat(64) }], join(root, "bad.zip")));
});
