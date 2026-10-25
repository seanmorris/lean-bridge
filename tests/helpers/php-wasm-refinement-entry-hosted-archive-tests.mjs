/**
 * Check archive shape, summary comparison and pre-execution refusals. Synthetic
 * index/summary fixtures do not stand in for installed thirty-route acceptance.
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
	archivePhpWasmEntryHostedMatrix, checkPhpWasmEntryHostedArchive
	, checkPhpWasmEntryHostedArchiveIndex, comparePhpWasmEntryHostedReplay
} from "./php-wasm-refinement-entry-hosted-archive.mjs";
import {
	phpWasmRefinementEntryHostedContracts, phpWasmRefinementEntryHostedTagPrefix
	, phpWasmRefinementEntryHostedWorkflow
} from "./php-wasm-refinement-entry-hosted-identities.mjs";

const producerCommit = "a".repeat(40), archiverCommit = "b".repeat(40);
const digest = "c".repeat(64), contracts = phpWasmRefinementEntryHostedContracts(producerCommit);
const identity = () => ({ bytes: 1, sha256: digest });
const fixture = () => ({
	schemaVersion: 1, kind: "php-wasm-refinement-entry-hosted-archive-v1"
	, scope: "separate-instrumented-probe", producerCommit, archiverCommit
	, identity: { scope: "synthetic-structural-fixture-not-acceptance" }
	, run: identity(), replay: identity()
	, artifacts: contracts.map((contract, position) => ({
		name: contract.name
		, directory: `artifacts/${String(position).padStart(4, "0")}`
		, job: identity(), artifact: identity(), index: identity()
		, storage: { schemaVersion: 1, scope: "original-zip-and-output-bytes-only"
			, files: 1, zip: identity(), outputBytes: 1 }
	}))
	, sources: ["producer", "archiver"].map(role => ({
		role
		, snapshot: {
			revision: role === "producer" ? producerCommit : archiverCommit
			, files: [{ path: "src/structural-fixture-only.mjs" }], zip: identity()
		}
		, parts: [{ path: `sources/${role}/0000.part`, offset: 0, bytes: 1, sha256: digest }]
	}))
});
const summary = () => ({
	schemaVersion: 1, kind: "php-wasm-refinement-entry-hosted-v1", producerCommit
	, verification: { verifierCommit: producerCommit, sourcePathsClean: true
		, sourcePaths: ["src", "tests", "scripts"]
		, sourcePathClosure: "tracked-and-untracked-nonignored"
		, verifierNodeVersion: "22.23.2", verifierNodeMajor: 22 }
	, artifacts: contracts.slice(0, -1).map(item => ({ name: item.name, files: 1, cells: item.cells.length, tapSha256: digest }))
	, matrix: {
		schemaVersion: 1, scope: "separate-instrumented-probe", producerCommit
		, cells: 30, artifacts: 27, workflows: 4, records: 600
		, executions: 360, calls: 120, controls: 12
	}
});

test("PHP-Wasm complete archive indexes close all artifact and source slots", () => {
	const index = fixture(); assert.equal(checkPhpWasmEntryHostedArchiveIndex(index), true);
	assert.equal(index.artifacts.length, 28);
	for(const mutation of [
		value => { value.extra = true; }
		, value => { value.scope = "diagnostic-only"; }
		, value => { value.scope = "unmodified-installed-package"; }
		, value => { value.producerCommit = "short"; }
		, value => { value.artifacts.pop(); }
		, value => { value.artifacts.reverse(); }
		, value => { value.artifacts[1] = value.artifacts[0]; }
		, value => { value.artifacts[0].directory = "../../outside"; }
		, value => { value.artifacts[0].storage.scope = "installed-acceptance"; }
		, value => { value.artifacts[0].index.sha256 = "forged"; }
		, value => { value.artifacts[0].job.bytes = 3 * 1024 ** 2; }
		, value => { value.sources.reverse(); }
		, value => { value.sources[1] = value.sources[0]; }
		, value => { value.sources[0].snapshot.revision = archiverCommit; }
		, value => { value.sources[0].snapshot.files = []; }
		, value => { value.sources[0].parts[0].path = "../../source.part"; }
		, value => { value.sources[0].parts[0].offset++; }
		, value => { value.sources[0].parts[0].bytes++; }
		, value => { value.sources[0].parts[0].sha256 = "forged"; }
		, value => { value.sources[0].parts = []; }
	]) {
		const altered = structuredClone(index); mutation(altered);
		assert.throws(() => checkPhpWasmEntryHostedArchiveIndex(altered));
	}
});

test("PHP-Wasm complete archive source ranges are contiguous and Git-safe", () => {
	const index = fixture(), source = index.sources[0], size = 64 * 1024 ** 2;
	source.snapshot.zip.bytes = size + 1;
	source.parts = [{ path: "sources/producer/0000.part", offset: 0, bytes: size, sha256: digest }
		, { path: "sources/producer/0001.part", offset: size, bytes: 1, sha256: digest }];
	assert.equal(checkPhpWasmEntryHostedArchiveIndex(index), true);
	source.parts[1].offset--; assert.throws(() => checkPhpWasmEntryHostedArchiveIndex(index));
	source.parts[1].offset++; source.parts.reverse();
	assert.throws(() => checkPhpWasmEntryHostedArchiveIndex(index));
});

test("PHP-Wasm complete archive comparison preserves every field except validated Node versions", () => {
	const original = summary(), replayed = structuredClone(original);
	replayed.verification.verifierNodeVersion = "22.24.0";
	const previous = structuredClone(original), current = structuredClone(replayed);
	const result = comparePhpWasmEntryHostedReplay(original, replayed);
	assert.equal(result.scope, "summary-comparison-only");
	assert.equal(result.recordedNodeVersion, "22.23.2"); assert.equal(result.replayNodeVersion, "22.24.0");
	assert.deepEqual(original, previous); assert.deepEqual(replayed, current);
	for(const mutation of [
		value => { value.verification.verifierNodeVersion = "24.0.0"; }
		, value => { value.verification.verifierNodeVersion = "22.fake"; }
		, value => { value.verification.sourcePathsClean = false; }
		, value => { value.verification.sourcePaths.pop(); }
		, value => { value.verification.verifierCommit = archiverCommit; }
		, value => { value.verification.sourcePathClosure = "unverified"; }
		, value => { value.verification.extra = true; }
		, value => { value.matrix.calls++; }
		, value => { value.matrix.executions--; }
		, value => { value.matrix.scope = "installed"; }
		, value => { value.artifacts[0].files++; }
		, value => { value.artifacts[0].tapSha256 = "d".repeat(64); }
		, value => { value.artifacts.reverse(); }
		, value => { value.artifacts.pop(); }
		, value => { value.extra = true; }
	]) {
		const altered = structuredClone(original); mutation(altered);
		assert.throws(() => comparePhpWasmEntryHostedReplay(altered, replayed));
	}
});

test("PHP-Wasm complete archive refuses a saved success without original APIs", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-entry-matrix-no-bypass-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const index = fixture(), saved = canonicalJson(summary());
	index.replay = { bytes: Buffer.byteLength(saved), sha256: sha256(saved) };
	await writeFile(join(root, "index.json"), canonicalJson(index));
	await writeFile(join(root, "replay.json"), saved);
	await assert.rejects(checkPhpWasmEntryHostedArchive(root, root), error =>
		error.code === "ENOENT" && error.path.endsWith("/api/run.json"));
	assert.deepEqual((await readdir(root)).sort(), ["index.json", "replay.json"]);
	assert.equal(await readFile(join(root, "replay.json"), "utf8"), saved);
});

test("PHP-Wasm complete archive refuses live or failed runs before creating evidence", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-entry-matrix-live-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const runJson = join(root, "run.json"), destination = join(root, "not-created");
	for(const [status, conclusion] of [["in_progress", null], ["completed", "failure"]])
	{
		const run = {
			id: 10, run_attempt: 1, head_sha: producerCommit, status, conclusion
			, repository: { id: 1, full_name: "seanmorris/lean-bridge" }
			, head_repository: { id: 1, full_name: "seanmorris/lean-bridge" }
			, path: phpWasmRefinementEntryHostedWorkflow, event: "create"
			, head_branch: phpWasmRefinementEntryHostedTagPrefix + producerCommit };
		const bytes = canonicalJson(run); await writeFile(runJson, bytes);
		await assert.rejects(archivePhpWasmEntryHostedMatrix({ runJson, artifacts: [] }, destination, root)
			, /aggregate run must be terminal|partial\/failed runs/u);
		assert.deepEqual(await readdir(root), ["run.json"]);
		assert.equal(await readFile(runJson, "utf8"), bytes);
	}
});

test("PHP-Wasm complete archive CLIs expose no skipped replay or checker override", () => {
	for(const name of ["archive-php-wasm-refinement-entry-hosted.mjs", "check-php-wasm-refinement-entry-hosted-archive.mjs"])
	{
		const result = spawnSync(process.execPath, [resolve("scripts", name), "--skip-verification", "true"]
			, { encoding: "utf8", timeout: 15_000 });
		assert.equal(result.status, 1); assert.match(result.stderr, /Usage:/u);
	}
});
