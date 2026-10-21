/**
 * Common byte, source, route and GitHub-record verifier for immutable hosted
 * zero-payload checked-record archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	zeroPayloadHostedOriginal
} from "./zero-payload-checked-record-hosted-evidence-sources.mjs";

const safePath = path => typeof path === "string" && path.length > 0
	&& !path.startsWith("/") && !path.includes("\\")
	&& posix.normalize(path) === path
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), label);
	return value;
};

/**
 * Authenticate one retained hosted archive without trusting its own index.
 *
 * @param contract - Closed archive identity and host-specific replay hooks.
 * @param read - Repository-relative archive byte reader.
 */
export const checkZeroPayloadHostedEvidenceArchive = async (
	contract, read
) => {
	const indexBytes = Buffer.from(await read(`${contract.evidence}/index.json`));
	assert.equal(sha256(indexBytes), contract.indexSha256);
	const index = json(indexBytes, "index.json"), files = new Map();
	assert.deepEqual(Object.keys(index).sort(), [...contract.indexKeys].sort());
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, contract.kind);
	assert.equal(index.producerCommit, contract.revisions.producer);
	assert.equal(index.consumerCommit, contract.revisions.consumer);
	assert.equal(index.checkerCommit, contract.revisions.checker);
	assert.equal(index.archiveCommit, contract.revisions.archiver);
	const limitationCount = contract.limitationCount ?? 6;
	assert.ok(Number.isSafeInteger(limitationCount) && limitationCount > 0);
	assert.ok(Array.isArray(index.limitations)
		&& index.limitations.length === limitationCount
		&& index.limitations.every(item => typeof item === "string" && item));
	await contract.verifyIndex(index);
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
			`${contract.evidence}/${entry.path}`));
		assert.equal(value.length, entry.bytes, entry.path);
		assert.equal(sha256(value), entry.sha256, entry.path);
		files.set(entry.path, value);
	}
	const get = path => {
		const value = files.get(path);
		assert.ok(Buffer.isBuffer(value), path);
		return value;
	};
	assert.deepEqual(index.selectedSources, contract.sources);
	const expectedPaths = [], expectedMembers = [];
	for(const source of index.selectedSources)
	{
		const path = `sources/${source.role}/${source.path}`;
		expectedPaths.push(path);
		assert.deepEqual(get(path), zeroPayloadHostedOriginal(
			source.revision, source.path), path);
	}
	assert.deepEqual(index.runs.map(run => run.route), contract.routes);
	const accepted = [];
	for(const run of index.runs)
	{
		const prefix = `${run.route}/records/`, records = new Map();
		for(const [path, value] of files)
			if(path.startsWith(prefix))
				records.set(path.slice(prefix.length), value);
		const originalRead = async path => {
			assert.ok(records.has(path), path);
			return records.get(path);
		};
		const tap = get(`${run.route}/run.tap`)
			, verification = get(`${run.route}/verification.json`);
		accepted.push(await contract.verifyRun({
			index, run, records, read: originalRead, tap, verification
		}));
		expectedPaths.push(`${run.route}/run.tap`
			, `${run.route}/verification.json`
			, ...[...records.keys()].map(path => prefix + path));
		expectedMembers.push(
			`${contract.artifactRoot}/${run.route}/run.tap`
			, `${contract.artifactRoot}/${run.route}/verification.json`
			, ...[...records.keys()].map(path =>
				`${contract.artifactRoot}/${run.route}/records/${run.route}/${path}`)
		);
	}
	assert.deepEqual(Object.keys(index.hostedRun).sort(), [
		"apiRecords", "artifact", "createdAt", "event", "job", "repository"
		, "runAttempt", "runId", "updatedAt", "url", "workflow"
	].sort());
	assert.equal(index.hostedRun.repository, "seanmorris/lean-bridge");
	assert.equal(index.hostedRun.workflow, contract.workflow);
	assert.equal(index.hostedRun.runId, contract.runId);
	assert.equal(index.hostedRun.job.id, contract.jobId);
	assert.equal(index.hostedRun.artifact.id, contract.artifactId);
	assert.equal(index.hostedRun.artifact.bytes, contract.artifactBytes);
	assert.equal(index.hostedRun.artifact.sha256, contract.artifactSha256);
	assert.equal(index.hostedRun.artifact.apiDigest
		, `sha256:${contract.artifactSha256}`);
	assert.ok(index.hostedRun.artifact.members.every(safePath));
	assert.equal(index.hostedRun.artifact.members.length
		, new Set(index.hostedRun.artifact.members).size);
	assert.deepEqual(index.hostedRun.artifact.members.toSorted(), [
		...expectedMembers, contract.artifactToolchainLog
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
	assert.equal(archiveBytes, contract.artifactBytes);
	assert.equal(archiveHash.digest("hex"), contract.artifactSha256);
	const api = {};
	for(const [name, detail] of Object.entries(index.hostedRun.apiRecords))
	{
		const path = `hosted/api/${name}.json`, value = get(path);
		assert.deepEqual(Object.keys(detail).sort(), ["bytes", "sha256"]);
		assert.equal(value.length, detail.bytes, path);
		assert.equal(sha256(value), detail.sha256, path);
		api[name] = JSON.parse(value); expectedPaths.push(path);
	}
	assert.equal(api.run.id, contract.runId);
	assert.equal(api.run.head_sha, contract.revisions.producer);
	assert.equal(api.run.repository.full_name, index.hostedRun.repository);
	assert.equal(api.run.path, contract.workflow);
	assert.equal(api.run.event, index.hostedRun.event);
	assert.equal(api.run.run_attempt, index.hostedRun.runAttempt);
	assert.equal(api.run.status, "completed");
	assert.equal(api.run.conclusion, "success");
	assert.equal(api.run.created_at, index.hostedRun.createdAt);
	assert.equal(api.run.updated_at, index.hostedRun.updatedAt);
	assert.equal(api.run.html_url, index.hostedRun.url);
	assert.equal(api.job.id, contract.jobId);
	assert.equal(api.job.run_id, contract.runId);
	assert.equal(api.job.run_attempt, index.hostedRun.runAttempt);
	assert.equal(api.job.head_sha, contract.revisions.producer);
	assert.equal(api.job.name, index.hostedRun.job.name);
	assert.deepEqual(api.job.labels, index.hostedRun.job.labels);
	assert.equal(api.job.runner_group_name, index.hostedRun.job.runnerGroup);
	assert.equal(api.job.runner_name, index.hostedRun.job.runnerName);
	assert.equal(api.job.started_at, index.hostedRun.job.startedAt);
	assert.equal(api.job.completed_at, index.hostedRun.job.completedAt);
	assert.equal(api.job.status, "completed");
	assert.equal(api.job.conclusion, "success");
	assert.equal(api.artifact.id, contract.artifactId);
	assert.equal(api.artifact.name, index.hostedRun.artifact.name);
	assert.equal(api.artifact.size_in_bytes, archiveBytes);
	assert.equal(api.artifact.digest, `sha256:${contract.artifactSha256}`);
	assert.equal(api.artifact.created_at, index.hostedRun.artifact.createdAt);
	assert.equal(api.artifact.expires_at, index.hostedRun.artifact.expiresAt);
	assert.equal(api.artifact.workflow_run.id, contract.runId);
	assert.equal(api.artifact.workflow_run.head_sha, contract.revisions.producer);
	expectedPaths.push("hosted/logs/toolchain.log");
	assert.ok(get("hosted/logs/toolchain.log").length > 0);
	assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
	return { index, accepted, files: index.files, hostedRun: index.hostedRun };
};
