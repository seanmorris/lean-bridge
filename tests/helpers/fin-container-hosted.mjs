/**
 * Authenticate hosted native Fin edge, foreign-carrier and late-input acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertFinForeignReport } from "./fin-container-foreign-report.mjs";
import { assertFinLateReport, assertFinLateTap } from "./fin-container-late-report.mjs";
import { assertFinLateWitRecords, assertFinLateWitTap } from "./fin-container-late-wit-report.mjs";
import { finHostedJobs, finHostedRevision, finHostedRoot, finHostedRun, finHostedSelections } from "./fin-container-hosted-selections.mjs";
import { readFinHostedMembers } from "./fin-container-hosted-zip.mjs";

export const finHostedIndexSha256 = "20a16bc7de3c60a87874c8814816a9fd60e9fa2257b082b7d3aee621b3a9d78b";
const steps = {
	"c-family": "Compare relocated C and C++ corpus consumers with fresh Lean"
	, python: "Compare installed Python corpus packages with fresh Lean results"
	, rust: "Compare isolated Cargo corpus consumers with fresh Lean"
	, ruby: "Compare installed Ruby corpus packages with fresh Lean results"
	, dotnet: "Compare installed NuGet corpus packages with fresh Lean results"
	, jvm: "Compare isolated Java and Kotlin corpus consumers with fresh Lean"
	, "php-native": "Compare weak and strict installed Composer callers with fresh Lean"
	, "wit-wasi": "Compare installed WIT packages with the shared Lean corpus"
};
const entryBytes = (members, path) => {
	assert.ok(members.has(path), `Missing original hosted record ${path}`); return members.get(path);
};

/**
 * Name every required original independently of the report's claimed record inventory.
 *
 * @param lane - Fixed hosted consumer lane.
 */
export const finHostedRequiredRecords = lane => {
	assert.ok(finHostedJobs.some(item => item.lane === lane));
	return finHostedSelections.filter(item => item.lane === lane).flatMap(item => {
		const edge = `native-fin-container-edges/edges-${item.edge}.json`;
		const names = ["context.json", ...[0, 1].flatMap(attempt => ["model.json", "package-set-receipt.json", "FinContainers.lean", "lean-bridge.exports.json"].map(path => `author-${attempt}/${path}`))];
		if(lane === "wit-wasi") return [edge, "fin-late-wit-ci/run.tap"
			, ...[...names, "report.json", "installed-receipt.json", "consumer.c", "before.stdout", "relocated.stdout"].map(path => "fin-late-wit-ci/records/" + path)];
		const root = `fin-late-native-ci/${item.label}/`, report = root + `edges-${item.profiles.join("-")}.json`;
		for(const profile of item.profiles)
			for(const suffix of ["source", "receipt.json", "closure.json", "before.stdout", "relocated.stdout", ...profile === "php-native" ? ["strict.stdout"] : []]) names.push(`${profile}.${suffix}`);
		return [edge, root + "run.tap", report, ...names.map(path => report + ".records/" + path)];
	}).sort();
};

/**
 * Require the original successful job at the pinned revision and its matching artifact.
 *
 * @param files - Lane-relative retained metadata, ZIP, log and member inventory.
 * @param lane - Explicit expected consumer job.
 */
export const assertFinHostedJob = (files, lane) => {
	const expected = finHostedJobs.find(item => item.lane === lane); assert.ok(expected);
	const json = path => JSON.parse(entryBytes(files, path));
	const job = json("job.json"), metadata = json("artifact.json"), zip = entryBytes(files, "artifact.zip");
	assert.equal(job.id, expected.jobId); assert.equal(job.run_id, finHostedRun);
	assert.equal(job.head_sha, finHostedRevision); assert.equal(job.name, expected.name);
	assert.equal(job.status, "completed"); assert.equal(job.conclusion, "success");
	const selected = job.steps.filter(step => step.name === steps[lane]);
	assert.equal(selected.length, 1); assert.equal(selected[0].conclusion, "success");
	assert.equal(selected[0].status, "completed");
	assert.equal(metadata.id, expected.artifactId); assert.equal(metadata.expired, false);
	assert.equal(metadata.name, `type-corpus-${lane}-${finHostedRevision}`);
	assert.equal(metadata.workflow_run.id, finHostedRun);
	assert.equal(metadata.workflow_run.head_sha, finHostedRevision);
	assert.equal(metadata.workflow_run.head_branch, "agent/generic-record-arrays-integration-vo1439");
	assert.equal(metadata.digest, "sha256:" + expected.sha256);
	const log = entryBytes(files, "job.log").toString();
	assert.ok(log.includes(finHostedRevision), "Original checkout revision is in the job log");
	for(const selection of finHostedSelections.filter(item => item.lane === lane))
		assert.ok(log.includes(`Fin container raw, public and foreign-carrier measurements verified for ${selection.profiles.join(", ")}.`));
	const members = readFinHostedMembers(zip, metadata);
	const inventory = Object.fromEntries([...members].map(([path, bytes]) => [path, { bytes: bytes.length, sha256: sha256(bytes) }]));
	assert.equal(entryBytes(files, "members.json").toString(), canonicalJson(inventory));
	return members;
};

/**
 * Verify every mandatory original report and retained late-input record in one hosted lane.
 *
 * @param members - Complete original ZIP member map, never paths in the old installation.
 * @param lane - Independently selected lane.
 */
export const assertFinHostedReports = async (members, lane) => {
	assert.ok(finHostedJobs.some(item => item.lane === lane));
	const expectedRecords = finHostedRequiredRecords(lane);
	for(const path of expectedRecords) entryBytes(members, path);
	const read = async path => entryBytes(members, path), summaries = [], required = new Set();
	const retained = async path => { required.add(path); return read(path); };
	for(const selection of finHostedSelections.filter(item => item.lane === lane))
	{
		const edgePath = `native-fin-container-edges/edges-${selection.edge}.json`;
		const edge = JSON.parse(await retained(edgePath));
		await assertFinForeignReport(edge, selection.profiles, { python: selection.python });
		let late;
		if(lane === "wit-wasi")
		{
			assertFinLateWitTap((await retained("fin-late-wit-ci/run.tap")).toString());
			const { report, files } = await assertFinLateWitRecords(path => retained("fin-late-wit-ci/records/" + path), "2.38");
			late = { checks: [report.checks], records: files.size };
		}
		else
		{
			const prefix = `fin-late-native-ci/${selection.label}/`;
			assertFinLateTap((await retained(prefix + "run.tap")).toString());
			const path = prefix + `edges-${selection.profiles.join("-")}.json`;
			const report = JSON.parse(await retained(path));
			late = await assertFinLateReport(report, selection.profiles, {
				python: selection.python, glibc: "2.38"
				, read: file => retained(path + ".records/" + file)
			});
		}
		summaries.push({ ...selection, glibc: "2.38"
			, edgeChecks: edge.reports.map(item => item.checks)
			, lateChecks: late.checks, lateRecords: late.records
			, publicCalls: edge.reports.map(item => item.dispatch.publicHost.measuredCalls)
			, foreignCalls: edge.reports.map(item => item.foreignCarriers.measuredCalls) });
	}
	assert.deepEqual([...required].sort(), expectedRecords);
	return { summaries, requiredRecords: expectedRecords };
};

/**
 * Authenticate one original archive entry without decoding bytes as text.
 *
 * @param file - Pinned relative path, size and digest from the authenticated index.
 * @param read - Repository-relative original byte reader.
 */
export const authenticateFinHostedFile = async (file, read = readFile) => {
	assert.ok(!file.path.startsWith("/") && !file.path.split("/").some(part => ["", ".", ".."].includes(part)));
	const bytes = await read(`${finHostedRoot}/${file.path}`);
	assert.equal(bytes.length, file.bytes, file.path); assert.equal(sha256(bytes), file.sha256, file.path);
	return bytes;
};

/**
 * Read the immutable archive and authenticate every job, original ZIP and source snapshot.
 *
 * @param read - Repository-relative reader, injectable for corruption controls.
 */
export const readFinHostedArchive = async (read = readFile) => {
	const indexBytes = await read(finHostedRoot + "/index.json");
	assert.equal(sha256(indexBytes), finHostedIndexSha256);
	const index = JSON.parse(indexBytes), files = new Map(), members = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "native-fin-container-hosted-v1");
	assert.equal(index.revision, finHostedRevision); assert.equal(index.runId, finHostedRun);
	assert.deepEqual(index.jobs, finHostedJobs);
	for(const file of index.files)
	{
		assert.ok(!files.has(file.path)); files.set(file.path, await authenticateFinHostedFile(file, read));
		if(file.gitPath)
		{
			assert.equal(file.gitRevision, finHostedRevision);
			assert.equal(file.path, `sources/${file.gitPath}.txt`);
		}
	}
	for(const job of finHostedJobs)
	{
		const prefix = job.lane + "/";
		const originals = new Map([...files].filter(([path]) => path.startsWith(prefix)).map(([path, value]) => [path.slice(prefix.length), value]));
		members.set(job.lane, assertFinHostedJob(originals, job.lane));
	}
	return { index, files, members };
};
