/**
 * Independently authenticate the retained reviewed callback-Fin browser run.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkReviewedCallbackFinBrowserCi } from "./reviewed-callback-fin-browser-ci.mjs";
import {
	reviewedCallbackFinBrowserHostedEvidenceDirectory
	, reviewedCallbackFinBrowserHostedOriginal
	, reviewedCallbackFinBrowserHostedSources
} from "./reviewed-callback-fin-browser-hosted-archive.mjs";

export const reviewedCallbackFinBrowserHostedIndexPath
	= `${reviewedCallbackFinBrowserHostedEvidenceDirectory}/index.json`;

const exactKeys = (value, keys, label) => {
	assert.ok(value && typeof value === "object" && !Array.isArray(value)
		, label);
	assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), label);
};
const digest = (value, label) => assert.match(
	value, /^[a-f0-9]{64}$/u, label
);

/**
 * Replay every retained observation and byte identity without trusting the
 * archive-producing process.
 *
 * @param index - Parsed retained index.
 * @param read - Read one path relative to the evidence directory.
 */
export const assertReviewedCallbackFinBrowserHostedEvidence = async (
	index, read
) => {
	exactKeys(index, [
		"accepted", "archiveCommit", "checkerCommit", "engines", "files"
		, "hostedRun", "kind", "limitations", "producerCommit", "profiles"
		, "routes", "runtime", "schemaVersion", "selectedSources"
	], "index keys");
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "reviewed-callback-fin-browser-installed-v1");
	for(const name of ["producerCommit", "checkerCommit", "archiveCommit"])
		assert.match(index[name], /^[a-f0-9]{40}$/u, name);
	assert.equal(index.producerCommit, index.checkerCommit);
	assert.deepEqual(index.profiles, [
		"browser-javascript", "browser-react", "browser-worker"
	]);
	assert.deepEqual(index.engines, ["chromium", "firefox", "webkit"]);
	assert.deepEqual(index.routes, ["R1", "R2"]);
	assert.deepEqual(index.runtime, {
		node: "v22.23.3", platform: "linux", arch: "x64"
	});
	assert.equal(index.limitations.length, 5);
	assert.ok(index.limitations.some(value =>
		/copied fields retain their own evidence/u.test(value)));

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
		const bytes = await read(file.path);
		assert.equal(bytes.length, file.bytes, file.path);
		assert.equal(sha256(bytes), file.sha256, file.path);
	}

	const revisions = {
		producer: index.producerCommit, checker: index.checkerCommit
		, archiver: index.archiveCommit
	};
	assert.deepEqual(index.selectedSources
		, reviewedCallbackFinBrowserHostedSources(revisions));
	for(const source of index.selectedSources)
	{
		const retained = await read(
			`sources/${source.role}/${source.path}`);
		assert.deepEqual(retained, reviewedCallbackFinBrowserHostedOriginal(
			source.revision, source.path), `${source.role}/${source.path}`);
	}

	const json = async path => JSON.parse(await read(path));
	const tap = (await read("observations/acceptance.tap")).toString();
	const runtimeBefore = await read("observations/runtime-before.json");
	assert.deepEqual(await read("observations/runtime-after.json")
		, runtimeBefore);
	const checked = checkReviewedCallbackFinBrowserCi({
		producer: index.producerCommit, tap: "observations/acceptance.tap"
		, runtime: "observations/runtime-before.json"
		, r1: "observations/r1.json", r2: "observations/r2.json"
	}, {
		tap, runtime: JSON.parse(runtimeBefore)
		, r1: await json("observations/r1.json")
		, r2: await json("observations/r2.json")
	});
	assert.deepEqual(index.accepted, checked);
	assert.equal((await read("observations/verification.json")).toString()
		, canonicalJson(checked));

	const run = await json("hosted/api/run.json");
	const job = await json("hosted/api/job.json");
	const artifact = await json("hosted/api/artifact.json");
	assert.equal(run.id, index.hostedRun.runId);
	assert.equal(run.head_sha, index.producerCommit);
	assert.equal(run.path, index.hostedRun.workflow);
	assert.deepEqual([run.status, run.conclusion], ["completed", "success"]);
	assert.equal(job.id, index.hostedRun.job.id);
	assert.equal(job.run_id, run.id); assert.equal(job.head_sha, run.head_sha);
	assert.deepEqual([job.status, job.conclusion], ["completed", "success"]);
	assert.equal(artifact.id, index.hostedRun.artifact.id);
	assert.equal(artifact.workflow_run.id, run.id);
	assert.equal(artifact.workflow_run.head_sha, run.head_sha);
	assert.equal(artifact.size_in_bytes, index.hostedRun.artifact.bytes);
	assert.equal(artifact.digest
		, `sha256:${index.hostedRun.artifact.sha256}`);

	let offset = 0;
	const parts = [];
	for(const part of index.hostedRun.artifact.parts)
	{
		exactKeys(part, ["bytes", "offset", "path", "sha256"]
			, part.path);
		assert.equal(part.offset, offset, part.path);
		const bytes = await read(part.path);
		assert.equal(bytes.length, part.bytes, part.path);
		assert.equal(sha256(bytes), part.sha256, part.path);
		parts.push(bytes); offset += bytes.length;
	}
	const original = Buffer.concat(parts);
	assert.equal(original.length, index.hostedRun.artifact.bytes);
	assert.equal(sha256(original), index.hostedRun.artifact.sha256);
	return { checked, original };
};
