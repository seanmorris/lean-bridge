/**
 * Authenticate the two hosted reviewed Fin Wasm-entry legs and select the
 * exact producer, checker and archiver sources retained with them.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, posix, resolve } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	checkedRecordValueIndexHostedDigest
} from "./checked-record-value-index-hosted-archive.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";

export const reviewedFinWasmEntryHostedEvidenceDirectory
	= "docs/evidence/reviewed-fin-wasm-entry-hosted-20261028";
export const reviewedFinWasmEntryHostedModes = Object.freeze([
	"original", "probe"
]);

const sourceEntries = Object.freeze({
	producer: Object.freeze([
		".github/workflows/consumer-matrix.yml"
		, "tests/reviewed-fin-wasm-entry.test.mjs"
		, "tests/helpers/reviewed-fin-wasm-entry-producer.mjs"
		, "tests/helpers/reviewed-fin-wasm-entry.mjs"
		, "tests/helpers/reviewed-fin-wasm-source-entry.mjs"
		, "tests/helpers/reviewed-fin-wasm-fixture.mjs"
		, "tests/helpers/reviewed-fin-wasm-install.mjs"
		, "tests/helpers/reviewed-fin-wasm-browser.mjs"
		, "tests/helpers/reviewed-fin-wasm-typescript.mjs"
		, "tests/fixtures/onboarding/reviewed-fin-wasm/ReviewedFin.lean"
		, "tests/fixtures/reviewed-fin-wasm/javascript.mjs"
	])
	, checker: Object.freeze([
		"scripts/check-reviewed-fin-wasm-entry-run.mjs"
		, "tests/helpers/reviewed-fin-wasm-entry-ci.mjs"
		, "tests/helpers/reviewed-fin-wasm-entry-producer.mjs"
		, "tests/helpers/reviewed-fin-wasm-entry.mjs"
		, "src/capsule/node.mjs"
	])
	, archiver: Object.freeze([
		"scripts/archive-reviewed-fin-wasm-entry-hosted.mjs"
		, "tests/helpers/reviewed-fin-wasm-entry-hosted-archive.mjs"
		, "tests/helpers/reviewed-fin-wasm-entry-hosted-evidence.mjs"
		, "tests/helpers/checked-record-value-index-hosted-archive.mjs"
		, "tests/helpers/reviewed-fin-wasm-entry-ci.mjs"
		, "tests/helpers/reviewed-fin-wasm-entry-producer.mjs"
		, "src/build/native-artifacts.mjs"
		, "src/capsule/node.mjs"
	])
});

const sourceCache = new Map();

const original = (revision, path) => {
	const key = `${revision}:${path}`;
	if(!sourceCache.has(key)) sourceCache.set(key, execFileSync(
		"git", ["show", key], { maxBuffer: 256 * 1024 ** 2 }
	));
	return sourceCache.get(key);
};

const closure = (revision, entries) => {
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		const bytes = original(revision, path);
		paths.add(path);
		if(!/\.[cm]?js$/u.test(path)) return;
		for(const specifier of moduleSpecifiers(bytes.toString(), path))
		{
			const joined = posix.normalize(posix.join(
				posix.dirname(path), specifier));
			visit(extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const entry of entries) visit(entry);
	return [...paths].sort();
};

const jsonObject = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.ok(value && typeof value === "object" && !Array.isArray(value)
		, label);
	return value;
};

/**
 * Parse the one closed hosted-input directory.
 *
 * @param args - Command arguments after the script name.
 */
export const parseReviewedFinWasmEntryHostedArchiveArgs = args => {
	const usage = "Usage: archive-reviewed-fin-wasm-entry-hosted.mjs --input-root /absolute/hosted-input";
	assert.deepEqual(Array.isArray(args) ? args.length : null, 2, usage);
	assert.equal(args[0], "--input-root", usage);
	assert.ok(typeof args[1] === "string" && args[1].length > 0
		&& !/[\0\r\n]/u.test(args[1]) && isAbsolute(args[1])
		&& resolve(args[1]) === args[1], usage);
	return args[1];
};

/**
 * Select the five canonical inputs retained for one matrix leg.
 *
 * @param root - Canonical hosted-input directory.
 * @param mode - Closed original/probe leg.
 */
export const reviewedFinWasmEntryHostedInputs = (root, mode) => {
	assert.ok(reviewedFinWasmEntryHostedModes.includes(mode));
	const prefix = `${root}/${mode}`;
	return {
		"artifact-zip": `${prefix}/artifact.zip`
		, "run-json": `${root}/run.json`
		, "job-json": `${prefix}/job.json`
		, "artifact-json": `${prefix}/artifact.json`
		, "job-log": `${prefix}/job.log`
	};
};

/**
 * Bind one original ZIP and job log to the exact successful Downstream run.
 *
 * @param selected - Five canonical absolute paths.
 * @param mode - Closed original/probe leg.
 */
export const inspectReviewedFinWasmEntryHostedArtifact = async (
	selected, mode
) => {
	assert.ok(reviewedFinWasmEntryHostedModes.includes(mode));
	assert.deepEqual(Object.keys(selected).sort(), [
		"artifact-json", "artifact-zip", "job-json", "job-log", "run-json"
	]);
	for(const path of Object.values(selected))
		assert.equal(await realpath(path), path, `Non-canonical input: ${path}`);
	const api = {};
	for(const name of ["run", "job", "artifact"])
	{
		const bytes = await readFile(selected[`${name}-json`]);
		api[name] = {
			bytes, value: jsonObject(bytes, `${name} API record`)
			, sha256: sha256(bytes)
		};
	}
	const { run, job, artifact } = Object.fromEntries(Object.entries(api)
		.map(([name, item]) => [name, item.value]));
	assert.ok(Number.isSafeInteger(run.id) && run.id > 0);
	assert.equal(run.status, "completed");
	assert.ok(["cancelled", "failure", "success"].includes(run.conclusion)
		, `Ineligible hosted run conclusion: ${run.conclusion}`);
	assert.match(run.head_sha, /^[a-f0-9]{40}$/u);
	assert.equal(run.path, ".github/workflows/consumer-matrix.yml");
	assert.equal(run.repository?.full_name, "seanmorris/lean-bridge");
	assert.equal(run.head_repository?.full_name, "seanmorris/lean-bridge");
	assert.ok(["push", "workflow_dispatch"].includes(run.event));
	assert.ok(Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0);
	assert.ok(Number.isSafeInteger(job.id) && job.id > 0);
	assert.equal(job.run_id, run.id); assert.equal(job.head_sha, run.head_sha);
	assert.deepEqual([job.status, job.conclusion], ["completed", "success"]);
	assert.equal(job.name, `Reviewed Fin Wasm entry (${mode})`);
	assert.ok(Array.isArray(job.labels) && job.labels.includes("ubuntu-24.04"));
	assert.ok(Number.isSafeInteger(artifact.id) && artifact.id > 0);
	assert.equal(artifact.name
		, `reviewed-fin-wasm-entry-${mode}-${run.head_sha}-${run.run_attempt}`);
	assert.equal(artifact.expired, false);
	assert.equal(artifact.workflow_run?.id, run.id);
	assert.equal(artifact.workflow_run?.head_sha, run.head_sha);
	const information = await stat(selected["artifact-zip"]);
	assert.ok(information.isFile() && information.size > 0);
	assert.equal(artifact.size_in_bytes, information.size);
	const artifactSha256 = await checkedRecordValueIndexHostedDigest(
		selected["artifact-zip"]);
	assert.equal(artifact.digest, `sha256:${artifactSha256}`);
	const log = await stat(selected["job-log"]);
	assert.ok(log.isFile() && log.size > 0);
	return {
		revision: run.head_sha, api
		, hostedRun: {
			repository: "seanmorris/lean-bridge", workflow: run.path
			, runId: run.id, runAttempt: run.run_attempt, event: run.event
			, runConclusion: run.conclusion
			, url: run.html_url, createdAt: run.created_at
			, updatedAt: run.updated_at
			, job: {
				id: job.id, name: job.name, labels: job.labels
				, runnerName: job.runner_name
				, runnerGroup: job.runner_group_name
				, startedAt: job.started_at, completedAt: job.completed_at
			}
			, artifact: {
				id: artifact.id, name: artifact.name, bytes: information.size
				, sha256: artifactSha256, apiDigest: artifact.digest
				, createdAt: artifact.created_at, expiresAt: artifact.expires_at
			}
		}
	};
};

/**
 * Select the closed source snapshot for each evidence-producing role.
 *
 * @param revisions - Exact role-to-commit map.
 */
export const reviewedFinWasmEntryHostedSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort()
		, ["archiver", "checker", "producer"].sort());
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	return Object.entries(sourceEntries).flatMap(
		([role, entries]) => closure(revisions[role], entries).map(path =>
			Object.freeze({ role, path, revision: revisions[role] }))
	);
};

/**
 * Read one exact immutable Git object.
 *
 * @param revision - Exact source commit.
 * @param path - Repository-relative source path.
 */
export const reviewedFinWasmEntryHostedOriginal = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.ok(typeof path === "string" && path.length > 0
		&& !path.startsWith("/") && !path.includes("\\")
		&& path.split("/").every(part => part && part !== "." && part !== ".."));
	return original(revision, path);
};

/**
 * Require the local checker bytes to equal the hosted checker bytes.
 *
 * @param revision - Exact hosted producer/checker commit.
 */
export const assertReviewedFinWasmEntryHostedChecker = async revision => {
	for(const path of closure(revision, sourceEntries.checker))
		assert.deepEqual(await readFile(path)
			, reviewedFinWasmEntryHostedOriginal(revision, path)
			, `Current checker differs from hosted checker: ${path}`);
};
