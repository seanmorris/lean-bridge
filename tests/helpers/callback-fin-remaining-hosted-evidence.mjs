/**
 * Independently authenticate retained managed/WIT callback-Fin evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	callbackFinRemainingVerification
} from "./callback-fin-remaining-ci.mjs";
import {
	callbackFinRemainingHostedEvidenceDirectory
	, callbackFinRemainingHostedLanes
	, callbackFinRemainingHostedOriginal
	, callbackFinRemainingHostedSources
} from "./callback-fin-remaining-hosted-archive.mjs";

export const callbackFinRemainingHostedIndexPath
	= `${callbackFinRemainingHostedEvidenceDirectory}/index.json`;

const exactKeys = (value, keys, label) => {
	assert.ok(value && typeof value === "object" && !Array.isArray(value)
		, label);
	assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), label);
};
const digest = (value, label) => assert.match(
	value, /^[a-f0-9]{64}$/u, label
);

/**
 * Validate the closed hosted identity without opening retained bytes.
 *
 * @param index - Parsed retained index.
 */
export const assertCallbackFinRemainingHostedIndex = index => {
	exactKeys(index, [
		"archiveCommit", "checkerCommit", "files", "kind", "lanes"
		, "limitations", "producerCommit", "schemaVersion", "selectedSources"
	], "index keys");
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "callback-fin-remaining-installed-v1");
	for(const name of ["producerCommit", "checkerCommit", "archiveCommit"])
		assert.match(index[name], /^[a-f0-9]{40}$/u, name);
	assert.equal(index.producerCommit, index.checkerCommit);
	assert.equal(index.limitations.length, 5);
	assert.ok(index.limitations.some(value => /does not add Perl/u.test(value)));
	const actualLanes = [], expectedLanes = [];
	for(const { id, profiles } of index.lanes)
		actualLanes.push({ id, profiles });
	for(const lane of callbackFinRemainingHostedLanes)
		expectedLanes.push({ id: lane.id, profiles: [...lane.profiles] });
	assert.deepEqual(actualLanes, expectedLanes);
	const runIds = new Set();
	for(const lane of index.lanes)
	{
		exactKeys(lane, ["accepted", "hostedRun", "id", "profiles"]
			, lane.id);
		exactKeys(lane.hostedRun, [
			"apiRecords", "artifact", "createdAt", "event", "job"
			, "repository", "runAttempt", "runId", "updatedAt", "url"
			, "workflow"
		], `${lane.id} hosted run`);
		assert.equal(lane.hostedRun.repository, "seanmorris/lean-bridge");
		assert.equal(lane.hostedRun.workflow
			, ".github/workflows/callback-checked-record-remaining.yml");
		assert.equal(lane.hostedRun.event, "workflow_dispatch");
		assert.equal(lane.hostedRun.job.name
			, callbackFinRemainingHostedLanes.find(
				item => item.id === lane.id).jobName);
		assert.ok(lane.hostedRun.job.labels.includes("ubuntu-24.04"));
		runIds.add(lane.hostedRun.runId);
		assert.match(lane.hostedRun.artifact.name
			, new RegExp(`^callback-fin-remaining-${lane.id}-[a-f0-9]{40}$`, "u"));
		assert.ok(lane.hostedRun.artifact.parts.length >= 2);
		let offset = 0;
		for(const part of lane.hostedRun.artifact.parts)
		{
			exactKeys(part, ["bytes", "offset", "path", "sha256"]
				, part.path);
			assert.equal(part.offset, offset, part.path);
			assert.ok(Number.isSafeInteger(part.bytes) && part.bytes > 0);
			digest(part.sha256, part.path); offset += part.bytes;
		}
		assert.equal(offset, lane.hostedRun.artifact.bytes);
		digest(lane.hostedRun.artifact.sha256, `${lane.id} artifact`);
		assert.equal(lane.hostedRun.artifact.apiDigest
			, `sha256:${lane.hostedRun.artifact.sha256}`);
	}
	assert.equal(runIds.size, 1);

	assert.equal(new Set(index.files.map(file => file.path)).size
		, index.files.length);
	assert.deepEqual(index.files.map(file => file.path)
		, [...index.files.map(file => file.path)].sort());
	for(const file of index.files)
	{
		exactKeys(file, ["bytes", "path", "sha256"], file.path);
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0
			, file.path);
		digest(file.sha256, file.path);
	}
	const revisions = {
		producer: index.producerCommit, checker: index.checkerCommit
		, archiver: index.archiveCommit
	};
	assert.deepEqual(index.selectedSources
		, callbackFinRemainingHostedSources(revisions));
	return new Map(index.files.map(file => [file.path, file]));
};

/**
 * Replay retained small records and source snapshots. Artifact parts are
 * streamed and unpacked by the caller so the verifier never holds all lanes.
 *
 * @param index - Parsed retained index.
 * @param read - Read one path relative to the evidence directory.
 */
export const assertCallbackFinRemainingHostedEvidence = async (
	index, read
) => {
	const files = assertCallbackFinRemainingHostedIndex(index);
	for(const file of index.files.filter(
		item => !item.path.includes("/artifact.zip.parts/")
	)) {
		const bytes = await read(file.path);
		assert.equal(bytes.length, file.bytes, file.path);
		assert.equal(sha256(bytes), file.sha256, file.path);
	}
	for(const source of index.selectedSources)
	{
		const retained = await read(
			`sources/${source.role}/${source.path}`);
		assert.deepEqual(retained, callbackFinRemainingHostedOriginal(
			source.revision, source.path), `${source.role}/${source.path}`);
	}
	const json = async path => JSON.parse(await read(path));
	const run = await json("hosted/api/run.json");
	assert.deepEqual([run.status, run.conclusion], ["completed", "success"]);
	assert.equal(run.head_sha, index.producerCommit);
	for(const lane of index.lanes)
	{
		const root = `observations/${lane.id}`;
		const tap = (await read(`${root}/acceptance.tap`)).toString();
		const report = await json(`${root}/report.json`);
		const base = callbackFinRemainingVerification(
			index.producerCommit, lane.profiles, tap, report);
		assert.deepEqual(Object.fromEntries(Object.entries(lane.accepted)
			.filter(([key]) => key !== "retainedPackages")), base);
		assert.equal((await read(`${root}/verification.json`)).toString()
			, canonicalJson(lane.accepted));
		const job = await json(`hosted/api/${lane.id}/job.json`);
		const artifact = await json(
			`hosted/api/${lane.id}/artifact.json`);
		assert.equal(job.id, lane.hostedRun.job.id);
		assert.equal(job.run_id, run.id); assert.equal(job.head_sha, run.head_sha);
		assert.deepEqual([job.status, job.conclusion]
			, ["completed", "success"]);
		assert.equal(artifact.id, lane.hostedRun.artifact.id);
		assert.equal(artifact.workflow_run.id, run.id);
		assert.equal(artifact.workflow_run.head_sha, run.head_sha);
		assert.equal(artifact.size_in_bytes, lane.hostedRun.artifact.bytes);
		assert.equal(artifact.digest
			, `sha256:${lane.hostedRun.artifact.sha256}`);
		for(const part of lane.hostedRun.artifact.parts)
			assert.deepEqual(files.get(part.path), {
				path: part.path, bytes: part.bytes, sha256: part.sha256
			});
	}
	return files;
};
