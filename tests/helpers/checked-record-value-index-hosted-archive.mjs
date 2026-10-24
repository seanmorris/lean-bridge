/**
 * Authenticate and unpack one original GitHub Actions value-index artifact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
	mkdtemp, open, readFile, realpath, readdir, rm, stat, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";

const optionNames = Object.freeze([
	"artifact-json", "artifact-zip", "job-json", "run-json"
]);

/**
 * Refuse implicit or ambiguous hosted inputs.
 *
 * @param args - Command arguments following the script name.
 * @param usage - Exact caller usage message.
 */
export const parseCheckedRecordValueIndexHostedArchiveArgs = (
	args, usage
) => {
	assert.ok(Array.isArray(args) && args.length === optionNames.length * 2
		, usage);
	const selected = {};
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--")
			&& optionNames.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string"
			&& value.length && !value.startsWith("--")
			&& !/[\0\r\n]/u.test(value), usage);
		assert.ok(isAbsolute(value) && resolve(value) === value, usage);
		selected[key] = value;
	}
	assert.deepEqual(Object.keys(selected).sort(), [...optionNames].sort()
		, usage);
	return selected;
};

/**
 * Stream one file identity without loading a hosted archive into memory.
 *
 * @param path - Absolute regular-file path.
 */
export const checkedRecordValueIndexHostedDigest = path => new Promise(
	(resolveDigest, reject) => {
		const hash = createHash("sha256"), stream = createReadStream(path);
		stream.on("data", chunk => hash.update(chunk));
		stream.on("error", reject);
		stream.on("end", () => resolveDigest(hash.digest("hex")));
	}
);

const jsonObject = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.ok(value && typeof value === "object" && !Array.isArray(value)
		, label);
	return value;
};

/**
 * Bind the downloaded ZIP to the original run, job and artifact API records.
 *
 * @param selected - Four absolute paths returned by the argument parser.
 * @param expected - Closed repository/workflow/job/artifact contract.
 */
export const inspectCheckedRecordValueIndexHostedArtifact = async (
	selected, expected
) => {
	const recordsFailure = Object.hasOwn(expected, "conclusions");
	const scopedCreate = Object.hasOwn(expected, "createTagPrefix");
	assert.deepEqual(Object.keys(expected).sort(), [
		"artifactPrefix", ...recordsFailure ? ["conclusions"] : []
		, ...scopedCreate ? ["createTagPrefix"] : []
		, "jobName", "workflow"
	]);
	if(scopedCreate) assert.match(expected.createTagPrefix, /^ci\/[a-z0-9-]+\/$/u);
	const conclusions = recordsFailure ? expected.conclusions
		: { run: "success", job: "success" };
	assert.deepEqual(Object.keys(conclusions).sort(), ["job", "run"]);
	for(const value of Object.values(conclusions))
		assert.ok(["failure", "success"].includes(value));
	for(const path of Object.values(selected))
		assert.equal(await realpath(path), path, `Non-canonical hosted input: ${path}`);
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
	assert.equal(run.conclusion, conclusions.run);
	assert.match(run.head_sha, /^[a-f0-9]{40}$/u);
	assert.equal(run.path, expected.workflow);
	assert.equal(run.repository?.full_name, "seanmorris/lean-bridge");
	assert.equal(run.head_repository?.full_name, "seanmorris/lean-bridge");
	assert.ok(Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0);
	assert.ok((scopedCreate ? ["create", "workflow_dispatch"]
		: ["push", "workflow_dispatch"]).includes(run.event));
	if(run.event === "create")
		assert.equal(run.head_branch, expected.createTagPrefix + run.head_sha
			, "Scoped producer tag must name its exact commit");
	assert.ok(Number.isSafeInteger(job.id) && job.id > 0);
	assert.equal(job.run_id, run.id);
	assert.equal(job.head_sha, run.head_sha);
	assert.equal(job.status, "completed");
	assert.equal(job.conclusion, conclusions.job);
	assert.equal(job.name, expected.jobName);
	assert.ok(Array.isArray(job.labels) && job.labels.includes("ubuntu-24.04"));
	assert.ok(Number.isSafeInteger(artifact.id) && artifact.id > 0);
	assert.equal(artifact.name, `${expected.artifactPrefix}-${run.head_sha}`);
	assert.equal(artifact.expired, false);
	assert.equal(artifact.workflow_run?.id, run.id);
	assert.equal(artifact.workflow_run?.head_sha, run.head_sha);
	const information = await stat(selected["artifact-zip"]);
	assert.ok(information.isFile() && information.size > 0);
	assert.equal(artifact.size_in_bytes, information.size);
	const artifactSha256 = await checkedRecordValueIndexHostedDigest(
		selected["artifact-zip"]);
	assert.equal(artifact.digest, `sha256:${artifactSha256}`);
	return {
		revision: run.head_sha, api
		, hostedRun: {
			repository: "seanmorris/lean-bridge", workflow: run.path
			, runId: run.id, runAttempt: run.run_attempt, event: run.event
			, ...recordsFailure ? { conclusions } : {}
			, url: run.html_url, createdAt: run.created_at
			, updatedAt: run.updated_at
			, job: {
				id: job.id, name: job.name, labels: job.labels
				, runnerName: job.runner_name, runnerGroup: job.runner_group_name
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
 * Accept one portable, relative ZIP member path and reject traversal or names
 * outside the byte formats emitted by the hosted archive jobs.
 *
 * @param path - Candidate ZIP member path.
 */
export const checkedRecordValueIndexHostedSafeZipPath = path => {
	const value = path.endsWith("/") ? path.slice(0, -1) : path;
	// NuGet retains this literal metadata filename, never a directory or glob.
	return value.length > 0
		&& /^(?:[A-Za-z0-9_$@.+-]+\/)*(?:[A-Za-z0-9_$@.+-]+|\[Content_Types\]\.xml)$/u.test(value)
		&& !path.endsWith("[Content_Types].xml/")
		&& !value.startsWith("/") && value.split("/").every(part =>
		part.length > 0 && part !== "." && part !== "..");
};

/**
 * Extract a path-safe ZIP and prove its regular-file inventory.
 *
 * @param zip - Absolute path to the downloaded artifact ZIP.
 */
export const extractCheckedRecordValueIndexHostedArtifact = async zip => {
	const entries = execFileSync("/usr/bin/unzip", ["-Z1", zip], {
		encoding: "utf8", maxBuffer: 64 * 1024 ** 2
	}).split("\n").filter(Boolean);
	assert.ok(entries.length > 0 && new Set(entries).size === entries.length);
	for(const path of entries)
		assert.ok(checkedRecordValueIndexHostedSafeZipPath(path), path);
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-value-index-hosted-"));
	try
	{
		execFileSync("/usr/bin/unzip", ["-q", zip, "-d", root]);
		const files = entries.filter(path => !path.endsWith("/")).sort();
		assert.deepEqual(await nativeArtifactPaths(root), files
			, "Every extracted byte must come from the authenticated ZIP");
		for(const directory of entries.filter(path => path.endsWith("/")))
			assert.ok(files.some(path => path.startsWith(directory)), directory);
		return { root, entries: Object.freeze(entries) };
	}
	catch(error)
	{
		await rm(root, { recursive: true }); throw error;
	}
};

/**
 * Split an exact ZIP into Git-safe byte ranges without changing its identity.
 *
 * @param source - Original ZIP path.
 * @param stagingRoot - Empty temporary directory owned by the caller.
 * @param maxPartBytes - Maximum retained part size.
 */
export const splitCheckedRecordValueIndexHostedArtifact = async (
	source, stagingRoot, maxPartBytes = 64 * 1024 ** 2
) => {
	assert.ok(Number.isSafeInteger(maxPartBytes) && maxPartBytes > 0);
	assert.deepEqual(await readdir(stagingRoot), []);
	const information = await stat(source);
	assert.ok(information.isFile() && information.size > 0);
	const input = await open(source, "r"), parts = [];
	try
	{
		let offset = 0, index = 0;
		while(offset < information.size)
		{
			const length = Math.min(maxPartBytes, information.size - offset);
			const bytes = Buffer.allocUnsafe(length);
			let filled = 0;
			while(filled < length)
			{
				const result = await input.read(
					bytes, filled, length - filled, offset + filled);
				assert.ok(result.bytesRead > 0, "Unexpected end of artifact ZIP");
				filled += result.bytesRead;
			}
			const name = `${String(index).padStart(4, "0")}.part`;
			const path = join(stagingRoot, name);
			await writeFile(path, bytes, { flag: "wx" });
			parts.push(Object.freeze({
				name, path, offset, bytes: length, sha256: sha256(bytes)
			}));
			offset += length; index += 1;
		}
	}
	finally
	{ await input.close(); }
	assert.equal(parts.reduce((sum, part) => sum + part.bytes, 0)
		, information.size);
	return Object.freeze(parts);
};
