/**
 * Authenticate the immutable hosted zero-payload Java/Kotlin archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkZeroPayloadJvmCiRecords
} from "./zero-payload-checked-record-jvm-ci-report.mjs";
import {
	zeroPayloadJvmRoutes, zeroPayloadJvmSelection
} from "./zero-payload-checked-record-jvm-fixture.mjs";
import {
	zeroPayloadHostedOriginal, zeroPayloadJvmEvidenceSources
} from "./zero-payload-checked-record-hosted-evidence-sources.mjs";

export const zeroPayloadJvmEvidence
	= "docs/evidence/zero-payload-checked-record-jvm-20261021";
export const zeroPayloadJvmEvidenceSha256
	= "fb47730801e16e214af7bf824179657f2ed18ac5aaf109732063314dbd41491e";
const revision = "a6173cade3bbe158baa1a5695e3e93e1037359b0";
const revisions = Object.freeze({
	producer: revision, consumer: revision, checker: revision, archiver: revision
});
const runId = 39561655653, jobId = 119094106935
	, artifactId = 12328792684;
const artifactSha256
	= "045affb3211c377105d80eee673e84263ac052c85b7a674b5efc02338ab74252";
const safePath = path => typeof path === "string" && path.length > 0
	&& !path.startsWith("/") && !path.includes("\\")
	&& posix.normalize(path) === path
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), label);
	return value;
};
let cached;

/**
 * Verify every retained byte, source snapshot, TAP stream and route result.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkZeroPayloadJvmEvidence = async (read = readFile) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const indexBytes = Buffer.from(await read(
			`${zeroPayloadJvmEvidence}/index.json`));
		assert.equal(sha256(indexBytes), zeroPayloadJvmEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "consumerCommit", "files"
			, "hostedRun", "kind", "limitations", "producerCommit", "runs"
			, "runtime", "schemaVersion", "selectedSources", "tools"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "zero-payload-checked-record-jvm-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.consumerCommit, revisions.consumer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.deepEqual(index.runtime, {
			arch: "x64", glibc: "2.39", platform: "linux"
		});
		assert.deepEqual(Object.keys(index.tools).sort(), [
			"java", "javac", "kotlinc"
		]);
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 6
			&& index.limitations.every(item => typeof item === "string" && item));
		let previous = "";
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(!previous || previous.localeCompare(entry.path) < 0);
			previous = entry.path;
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(
				`${zeroPayloadJvmEvidence}/${entry.path}`));
			assert.equal(value.length, entry.bytes, entry.path);
			assert.equal(sha256(value), entry.sha256, entry.path);
			files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path);
			assert.ok(Buffer.isBuffer(value), path);
			return value;
		};
		assert.deepEqual(index.selectedSources, zeroPayloadJvmEvidenceSources(revisions));
		const expectedPaths = [], expectedMembers = [];
		for(const source of index.selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(get(path), zeroPayloadHostedOriginal(
				source.revision, source.path), path);
		}
		assert.deepEqual(index.runs.map(run => run.route), zeroPayloadJvmRoutes);
		const accepted = [];
		for(const run of index.runs)
		{
			assert.deepEqual(Object.keys(run).sort(), [
				"accepted", "recordCount", "resultOnly", "reviewed", "route"
				, "tapSha256", "verificationSha256"
			].sort());
			const prefix = `${run.route}/records/`, records = new Map();
			for(const [path, value] of files)
				if(path.startsWith(prefix)) records.set(path.slice(prefix.length), value);
			const originalRead = async path => {
				assert.ok(records.has(path), path);
				return records.get(path);
			};
			const tap = get(`${run.route}/run.tap`)
				, verification = get(`${run.route}/verification.json`);
			const checked = await checkZeroPayloadJvmCiRecords({
				route: run.route, producer: revisions.producer
				, consumer: revisions.consumer, directory: `/archive/${run.route}/records`
				, tap: `/archive/${run.route}/run.tap`, glibc: run.accepted.floor
				, java: index.tools.java.command, javac: index.tools.javac.command
				, kotlinc: index.tools.kotlinc.command
			}, {
				tap: tap.toString(), read: originalRead, runtime: index.runtime
				, tools: index.tools, archiveSha256: run.accepted.archiveSha256
			});
			const selection = zeroPayloadJvmSelection(run.route);
			assert.deepEqual(run, {
				route: run.route, reviewed: selection.reviewed
				, resultOnly: selection.resultOnly, recordCount: records.size
				, accepted: checked, tapSha256: sha256(tap)
				, verificationSha256: sha256(verification)
			});
			assert.equal(verification.toString(), canonicalJson(checked));
			expectedPaths.push(`${run.route}/run.tap`
				, `${run.route}/verification.json`
				, ...[...records.keys()].map(path => prefix + path));
			expectedMembers.push(
				`zero-payload-checked-record-jvm-ci/${run.route}/run.tap`
				, `zero-payload-checked-record-jvm-ci/${run.route}/verification.json`
				, ...[...records.keys()].map(path =>
					`zero-payload-checked-record-jvm-ci/${run.route}/records/${run.route}/${path}`)
			);
			accepted.push(checked);
		}
		assert.deepEqual(Object.keys(index.hostedRun).sort(), [
			"apiRecords", "artifact", "createdAt", "event", "job", "repository"
			, "runAttempt", "runId", "updatedAt", "url", "workflow"
		].sort());
		assert.equal(index.hostedRun.repository, "seanmorris/lean-bridge");
		assert.equal(index.hostedRun.workflow
			, ".github/workflows/zero-payload-checked-record-jvm.yml");
		assert.equal(index.hostedRun.runId, runId);
		assert.equal(index.hostedRun.job.id, jobId);
		assert.equal(index.hostedRun.artifact.id, artifactId);
		assert.equal(index.hostedRun.artifact.bytes, 205775494);
		assert.equal(index.hostedRun.artifact.sha256, artifactSha256);
		assert.equal(index.hostedRun.artifact.apiDigest, `sha256:${artifactSha256}`);
		assert.ok(index.hostedRun.artifact.members.every(safePath));
		assert.equal(index.hostedRun.artifact.members.length
			, new Set(index.hostedRun.artifact.members).size);
		assert.deepEqual(index.hostedRun.artifact.members.toSorted(), [
			...expectedMembers, "zero-payload-checked-record-jvm-toolchain.log"
		].sort());
		const archiveHash = createHash("sha256");
		let archiveBytes = 0;
		for(const part of index.hostedRun.artifact.parts)
		{
			assert.deepEqual(Object.keys(part).sort()
				, ["bytes", "offset", "path", "sha256"]);
			const value = get(part.path);
			assert.equal(value.length, part.bytes, part.path);
			assert.equal(sha256(value), part.sha256, part.path);
			assert.equal(part.offset, archiveBytes, part.path);
			archiveHash.update(value); archiveBytes += value.length;
			expectedPaths.push(part.path);
		}
		assert.equal(archiveBytes, index.hostedRun.artifact.bytes);
		assert.equal(archiveHash.digest("hex"), artifactSha256);
		const api = {};
		for(const [name, detail] of Object.entries(index.hostedRun.apiRecords))
		{
			const path = `hosted/api/${name}.json`, value = get(path);
			assert.deepEqual(Object.keys(detail).sort(), ["bytes", "sha256"]);
			assert.equal(value.length, detail.bytes, path);
			assert.equal(sha256(value), detail.sha256, path);
			api[name] = JSON.parse(value);
			expectedPaths.push(path);
		}
		assert.equal(api.run.id, runId);
		assert.equal(api.run.head_sha, revision);
		assert.equal(api.run.repository.full_name, index.hostedRun.repository);
		assert.equal(api.run.path, index.hostedRun.workflow);
		assert.equal(api.run.event, index.hostedRun.event);
		assert.equal(api.run.run_attempt, index.hostedRun.runAttempt);
		assert.equal(api.run.status, "completed");
		assert.equal(api.run.conclusion, "success");
		assert.equal(api.run.created_at, index.hostedRun.createdAt);
		assert.equal(api.run.updated_at, index.hostedRun.updatedAt);
		assert.equal(api.run.html_url, index.hostedRun.url);
		assert.equal(api.job.id, jobId);
		assert.equal(api.job.run_id, runId);
		assert.equal(api.job.run_attempt, index.hostedRun.runAttempt);
		assert.equal(api.job.head_sha, revision);
		assert.equal(api.job.name, index.hostedRun.job.name);
		assert.deepEqual(api.job.labels, index.hostedRun.job.labels);
		assert.equal(api.job.runner_group_name, index.hostedRun.job.runnerGroup);
		assert.equal(api.job.runner_name, index.hostedRun.job.runnerName);
		assert.equal(api.job.started_at, index.hostedRun.job.startedAt);
		assert.equal(api.job.completed_at, index.hostedRun.job.completedAt);
		assert.equal(api.job.status, "completed");
		assert.equal(api.job.conclusion, "success");
		assert.equal(api.artifact.id, artifactId);
		assert.equal(api.artifact.name, index.hostedRun.artifact.name);
		assert.equal(api.artifact.size_in_bytes, archiveBytes);
		assert.equal(api.artifact.digest, `sha256:${artifactSha256}`);
		assert.equal(api.artifact.created_at, index.hostedRun.artifact.createdAt);
		assert.equal(api.artifact.expires_at, index.hostedRun.artifact.expiresAt);
		assert.equal(api.artifact.workflow_run.id, runId);
		assert.equal(api.artifact.workflow_run.head_sha, revision);
		expectedPaths.push("hosted/logs/toolchain.log");
		assert.ok(get("hosted/logs/toolchain.log").length > 0);
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			...revisions, accepted, runtime: index.runtime, tools: index.tools
			, hostedRun: index.hostedRun, files: index.files
			, supportPromoted: false, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached = checking;
	return checking;
};
