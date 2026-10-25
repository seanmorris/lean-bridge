/**
 * Preserve one original failed, partial or successful producer as diagnostic
 * evidence. This path cannot grant complete-matrix or installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { copyFile, lstat, mkdir, readFile, realpath, statfs, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkedRecordValueIndexHostedDigest } from "./checked-record-value-index-hosted-archive.mjs";
import {
	phpWasmRefinementEntryHostedContracts, phpWasmRefinementEntryHostedTagPrefix
	, phpWasmRefinementEntryHostedWorkflow
} from "./php-wasm-refinement-entry-hosted-identities.mjs";
import {
	assertPhpWasmEntryReplayCheckout, checkPhpWasmEntryReplaySourceSnapshot
	, writePhpWasmEntryReplaySourceSnapshot
} from "./php-wasm-refinement-entry-hosted-replay.mjs";
import {
	checkPhpWasmEntryHostedArtifactBytes, checkPhpWasmEntryStoredIndex
	, inspectPhpWasmEntryStoredZip, retainPhpWasmEntryHostedArtifact
} from "./php-wasm-refinement-entry-hosted-storage.mjs";

const repository = "seanmorris/lean-bridge";
const sourceRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const exact = (value, keys) => {
	assert.ok(value && typeof value === "object" && !Array.isArray(value));
	assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
};
const positive = value => assert.ok(Number.isSafeInteger(value) && value > 0);
const instant = value => {
	assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u);
	const parsed = Date.parse(value); assert.ok(Number.isFinite(parsed));
	assert.equal(new Date(parsed).toISOString(), value.replace("Z", ".000Z"));
	return parsed;
};
const state = value => {
	assert.ok(["queued", "in_progress", "completed"].includes(value.status));
	if(value.status === "completed")
		assert.ok(["success", "failure", "cancelled", "timed_out", "action_required"
			, "neutral", "skipped", "stale"].includes(value.conclusion));
	else assert.equal(value.conclusion, null);
};
const canonical = async path => {
	assert.ok(typeof path === "string" && isAbsolute(path) && resolve(path) === path);
	assert.equal(await realpath(path), path);
};
const readJson = async (path, limit = 2 * 1024 ** 2) => {
	await canonical(path); const information = await lstat(path);
	assert.ok(information.isFile() && information.size > 0 && information.size <= limit);
	const bytes = await readFile(path); assert.equal(bytes.length, information.size);
	const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	return { bytes, value, receipt: { bytes: bytes.length, sha256: sha256(bytes) } };
};

/**
 * Bind a single original artifact to its actual workflow, job and attempt while
 * preserving observed failures and incomplete state. Never relabel it success.
 *
 * @param records - Original parsed API records and measured original ZIP identity.
 */
export const checkPhpWasmEntryHostedDiagnosticIdentity = records => {
	exact(records, ["run", "job", "artifact", "zip"]);
	const { run, job, artifact, zip } = records;
	positive(run.id); positive(run.run_attempt); state(run); state(job);
	assert.equal(run.repository?.full_name, repository);
	assert.equal(run.head_repository?.full_name, repository);
	positive(run.repository.id); assert.equal(run.repository.id, run.head_repository.id);
	assert.match(run.head_sha, /^[a-f0-9]{40}$/u);
	assert.equal(run.path, phpWasmRefinementEntryHostedWorkflow);
	assert.ok(["schedule", "workflow_dispatch", "create"].includes(run.event));
	assert.ok(typeof run.head_branch === "string" && run.head_branch.length > 0);
	if(run.event === "create") assert.equal(run.head_branch, phpWasmRefinementEntryHostedTagPrefix + run.head_sha);
	assert.equal(run.html_url, `https://github.com/${repository}/actions/runs/${run.id}`);
	assert.ok(instant(run.created_at) <= instant(run.updated_at));
	const contract = phpWasmRefinementEntryHostedContracts(run.head_sha)
		.find(item => item.name === artifact.name);
	assert.ok(contract, "artifact belongs to the exact refinement-entry topology");
	positive(job.id); assert.equal(job.run_id, run.id); assert.equal(job.run_attempt, run.run_attempt);
	assert.equal(job.head_sha, run.head_sha); assert.equal(job.head_branch, run.head_branch);
	assert.equal(job.name, contract.job);
	assert.ok(Array.isArray(job.labels) && job.labels.includes("ubuntu-24.04"));
	assert.ok(Array.isArray(job.steps));
	const upload = job.steps.filter(step => step.name === contract.steps.at(-1));
	assert.equal(upload.length, 1); assert.equal(upload[0].status, "completed");
	assert.equal(upload[0].conclusion, "success", "original artifact upload completed");
	positive(artifact.id); assert.equal(artifact.expired, false);
	assert.equal(artifact.workflow_run?.id, run.id);
	assert.equal(artifact.workflow_run.head_sha, run.head_sha);
	assert.equal(artifact.workflow_run.head_branch, run.head_branch);
	assert.equal(artifact.workflow_run.repository_id, run.repository.id);
	assert.equal(artifact.workflow_run.head_repository_id, run.repository.id);
	exact(zip, ["bytes", "sha256"]); positive(zip.bytes); assert.match(zip.sha256, /^[a-f0-9]{64}$/u);
	assert.equal(artifact.size_in_bytes, zip.bytes); assert.equal(artifact.digest, "sha256:" + zip.sha256);
	assert.ok(instant(job.started_at) >= instant(run.created_at));
	assert.ok(instant(artifact.created_at) >= instant(job.started_at));
	assert.ok(instant(artifact.updated_at) >= instant(artifact.created_at));
	assert.ok(instant(artifact.expires_at) > instant(artifact.updated_at));
	if(job.status === "completed") assert.ok(instant(job.completed_at) >= instant(artifact.updated_at));
	if(run.status === "completed")
	{
		assert.equal(job.status, "completed");
		assert.ok(instant(run.updated_at) >= instant(job.completed_at));
	}
	return { schemaVersion: 1, scope: "diagnostic-only"
		, producerCommit: run.head_sha
		, runId: run.id, runAttempt: run.run_attempt
		, runStatus: run.status, runConclusion: run.conclusion, jobId: job.id
		, jobStatus: job.status, jobConclusion: job.conclusion
		, artifactId: artifact.id, artifactName: artifact.name
		, requiredRoutes: 30, replayedRoutes: 0 };
};

/**
 * Capture raw APIs, original ZIP/output and both source roles in a fresh archive.
 * Write the diagnostic index last; retain incomplete writes for investigation.
 *
 * @param selection - Four canonical input paths, with the same CLI field names.
 * @param destination - Fresh canonical-parent diagnostic directory.
 */
export const archivePhpWasmEntryHostedDiagnostic = async (selection, destination) => {
	exact(selection, ["run-json", "job-json", "artifact-json", "artifact-zip"]);
	const api = {};
	for(const name of ["run", "job", "artifact"]) api[name] = await readJson(selection[name + "-json"]);
	await canonical(selection["artifact-zip"]);
	const zipInformation = await lstat(selection["artifact-zip"]); assert.ok(zipInformation.isFile());
	assert.ok(zipInformation.size > 0 && zipInformation.size <= 128 * 1024 ** 2);
	const zip = { bytes: zipInformation.size, sha256: await checkedRecordValueIndexHostedDigest(selection["artifact-zip"]) };
	const identity = checkPhpWasmEntryHostedDiagnosticIdentity({
		run: api.run.value, job: api.job.value, artifact: api.artifact.value, zip
	});
	assert.equal(process.cwd(), sourceRoot, "diagnostic archiver runs in its own checkout");
	const archiverCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	await assertPhpWasmEntryReplayCheckout(sourceRoot, archiverCommit);
	assert.ok(isAbsolute(destination) && resolve(destination) === destination);
	await canonical(dirname(destination));
	const space = await statfs(dirname(destination));
	assert.ok(space.bavail * space.bsize >= 1280 * 1024 ** 2, "diagnostic capture needs 1.25 GiB free before writing");
	await mkdir(destination); await mkdir(join(destination, "api")); await mkdir(join(destination, "sources"));
	for(const name of ["run", "job", "artifact"])
		await writeFile(join(destination, "api", name + ".json"), api[name].bytes, { flag: "wx" });
	const originalZip = join(destination, "original.zip");
	await copyFile(selection["artifact-zip"], originalZip, constants.COPYFILE_EXCL);
	assert.equal((await lstat(originalZip)).size, zip.bytes);
	assert.equal(await checkedRecordValueIndexHostedDigest(originalZip), zip.sha256);
	// Malformed containers remain available as raw, API-bound diagnostics. Never
	// unpack unsafe entries merely to complete a diagnostic archive.
	let unpackable = true;
	try
	{ await inspectPhpWasmEntryStoredZip(originalZip); }
	catch
	{ unpackable = false; }
	let artifact = null;
	if(unpackable)
	{
		const captured = await retainPhpWasmEntryHostedArtifact(originalZip, join(destination, "artifact"));
		assert.equal(captured.zip.bytes, zip.bytes); assert.equal(captured.zip.sha256, zip.sha256);
		artifact = await checkPhpWasmEntryHostedArtifactBytes(join(destination, "artifact"));
	}
	const sources = [];
	for(const [role, revision] of [["producer", identity.producerCommit], ["archiver", archiverCommit]])
	{
		const path = `sources/${role}.zip`;
		sources.push({ role, path, snapshot: await writePhpWasmEntryReplaySourceSnapshot(revision, join(destination, path)) });
	}
	await assertPhpWasmEntryReplayCheckout(sourceRoot, archiverCommit);
	const index = { schemaVersion: 1, kind: "php-wasm-entry-hosted-diagnostic-v1"
		, identity, archiverCommit, originalZip: zip
		, api: Object.fromEntries(Object.entries(api)
			.map(([name, record]) => [name, record.receipt]))
		, artifact, sources };
	await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
	return checkPhpWasmEntryHostedDiagnosticArchive(destination);
};

/**
 * Independently reconstruct diagnostic bytes and source closures, preserving the
 * original run/job status. This verifier cannot return positive matrix evidence.
 *
 * @param directory - Canonical retained diagnostic archive.
 */
export const checkPhpWasmEntryHostedDiagnosticArchive = async directory => {
	await canonical(directory); assert.ok((await lstat(directory)).isDirectory());
	const record = await readJson(join(directory, "index.json"), 16 * 1024 ** 2), index = record.value;
	assert.equal(record.bytes.toString(), canonicalJson(index));
	exact(index, ["schemaVersion", "kind", "identity", "archiverCommit", "api", "originalZip", "artifact", "sources"]);
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "php-wasm-entry-hosted-diagnostic-v1");
	assert.match(index.archiverCommit, /^[a-f0-9]{40}$/u);
	exact(index.api, ["run", "job", "artifact"]);
	const api = {};
	for(const name of ["run", "job", "artifact"])
	{
		const original = await readJson(join(directory, "api", name + ".json"));
		assert.deepEqual(index.api[name], original.receipt); api[name] = original.value;
	}
	const originalZip = join(directory, "original.zip"); await canonical(originalZip);
	const information = await lstat(originalZip); assert.ok(information.isFile());
	assert.ok(information.size > 0 && information.size <= 128 * 1024 ** 2);
	const zip = { bytes: information.size, sha256: await checkedRecordValueIndexHostedDigest(originalZip) };
	assert.deepEqual(index.originalZip, zip);
	const identity = checkPhpWasmEntryHostedDiagnosticIdentity({ ...api, zip });
	assert.deepEqual(index.identity, identity);
	const artifactRoot = join(directory, "artifact");
	let artifact = null, artifactPaths = [];
	if(index.artifact === null)
		await assert.rejects(inspectPhpWasmEntryStoredZip(originalZip), "unpackable artifacts must retain their output");
	else
	{
		artifact = await checkPhpWasmEntryHostedArtifactBytes(artifactRoot);
		assert.deepEqual(index.artifact, artifact); assert.deepEqual(artifact.zip, zip);
		const stored = (await readJson(join(artifactRoot, "index.json"), 8 * 1024 ** 2)).value;
		artifactPaths = checkPhpWasmEntryStoredIndex(stored).map(path => "artifact/" + path);
	}
	assert.ok(Array.isArray(index.sources));
	assert.deepEqual(index.sources.map(item => item.role), ["producer", "archiver"]);
	for(const source of index.sources)
	{
		exact(source, ["role", "path", "snapshot"]);
		assert.equal(source.path, `sources/${source.role}.zip`);
		assert.equal(source.snapshot.revision, source.role === "producer" ? identity.producerCommit : index.archiverCommit);
		await checkPhpWasmEntryReplaySourceSnapshot(source.snapshot, join(directory, source.path));
	}
	const paths = ["index.json", "original.zip", "api/run.json", "api/job.json"
		, "api/artifact.json"
		, "sources/producer.zip", "sources/archiver.zip"
		, ...artifactPaths].sort();
	assert.deepEqual(await nativeArtifactPaths(directory), paths, "closed diagnostic archive file set");
	const sourceFiles = index.sources.map(source => ({
		role: source.role, files: source.snapshot.files.length
	}));
	return { ...identity, archiverCommit: index.archiverCommit, files: paths.length
		, zip, outputBytes: artifact?.outputBytes ?? 0
		, extraction: artifact === null ? "not-admitted" : "verified-bytes"
		, sourceFiles };
};
