/**
 * Authenticate and independently replay the complete proof-erasure archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	mkdir, mkdtemp, open, readFile, rm, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkedRecordValueIndexHostedDigest as digestFile
	, extractCheckedRecordValueIndexHostedArtifact as extractArtifact
} from "./checked-record-value-index-hosted-archive.mjs";
import {
	directProofErasureHostedEvidenceDirectory
	, directProofErasureHostedInputs
	, directProofErasureHostedLanes
	, directProofErasureHostedOriginal
	, directProofErasureHostedProducer
	, directProofErasureHostedRefusal
	, directProofErasureHostedRunId
	, directProofErasureHostedSourcePath
	, directProofErasureHostedSources
	, inspectDirectProofErasureHostedArtifact
	, replayDirectProofErasureHostedRoute
} from "./direct-proof-erasure-hosted-archive.mjs";
import {
	closeDirectProofErasureMatrix, directProofErasureMatrixRoutes
	, validateDirectProofErasureMatrixResults
} from "./direct-proof-erasure-matrix.mjs";

export const directProofErasureHostedEvidencePins = Object.freeze({
	index: "PENDING_DIRECT_PROOF_ERASURE_INDEX"
	, producer: directProofErasureHostedProducer
	, archive: "PENDING_DIRECT_PROOF_ERASURE_ARCHIVE"
	, runId: directProofErasureHostedRunId
});

const exactKeys = (value, keys, label) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort(), label
);
const safePath = path => typeof path === "string" && path.length > 0
	&& !/[\0\r\n]/u.test(path) && !path.startsWith("/")
	&& path.split("/").every(part => part && part !== "." && part !== ".."
		&& (/^[A-Za-z0-9_$@.+-]+$/u.test(part)
			|| part === "[Content_Types].xml"));
const json = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), label);
	return value;
};
let cached;

/**
 * Verify every retained byte and replay each original package artifact.
 *
 * @param read - Repository-relative evidence byte reader.
 */
export const checkDirectProofErasureHostedEvidence = async (
	read = readFile
) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const pins = directProofErasureHostedEvidencePins;
		assert.match(pins.index, /^[a-f0-9]{64}$/u);
		assert.match(pins.producer, /^[a-f0-9]{40}$/u);
		assert.match(pins.archive, /^[a-f0-9]{40}$/u);
		assert.ok(Number.isSafeInteger(pins.runId) && pins.runId > 0);
		const indexPath = `${directProofErasureHostedEvidenceDirectory}/index.json`;
		const indexBytes = Buffer.from(await read(indexPath));
		assert.equal(sha256(indexBytes), pins.index, "index.json");
		const index = json(indexBytes, "index.json"), files = new Map();
		exactKeys(index, [
			"archiveCommit", "checkerCommit", "closure", "files"
			, "hostedRunConclusion", "kind", "lanes", "limitations", "matrix"
			, "producerCommit", "refusal", "schemaVersion", "selectedSources"
		], "index keys");
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "direct-proof-erasure-hosted-matrix-v1");
		assert.equal(index.producerCommit, pins.producer);
		assert.equal(index.checkerCommit, pins.archive);
		assert.equal(index.archiveCommit, pins.archive);
		assert.ok(["failure", "success"].includes(index.hostedRunConclusion));
		assert.deepEqual(index.matrix, {
			lanes: 10, routes: 2, profiles: 17, cells: 34
		});
		assert.deepEqual(index.closure, {
			cells: 204, retainedInstalled: 102
			, directInstalled: 68, explicitRefusals: 34
		});
		assert.equal(index.limitations.length, 4);
		let previous = "";
		for(const descriptor of index.files)
		{
			exactKeys(descriptor, ["bytes", "path", "sha256"], "file");
			assert.ok(safePath(descriptor.path) && !files.has(descriptor.path));
			assert.ok(previous === ""
				|| previous.localeCompare(descriptor.path) < 0);
			previous = descriptor.path;
			assert.ok(Number.isSafeInteger(descriptor.bytes)
				&& descriptor.bytes > 0);
			assert.match(descriptor.sha256, /^[a-f0-9]{64}$/u);
			const bytes = Buffer.from(await read(
				`${directProofErasureHostedEvidenceDirectory}/${descriptor.path}`
			));
			assert.equal(bytes.length, descriptor.bytes, descriptor.path);
			assert.equal(sha256(bytes), descriptor.sha256, descriptor.path);
			files.set(descriptor.path, bytes);
		}
		const get = path => {
			const bytes = files.get(path);
			assert.ok(Buffer.isBuffer(bytes), path);
			return bytes;
		};
		const revisions = {
			producer: pins.producer, checker: pins.archive, archiver: pins.archive
		};
		const selectedSources = directProofErasureHostedSources(revisions);
		assert.deepEqual(index.selectedSources, selectedSources);
		const expectedPaths = [];
		for(const source of selectedSources)
		{
			const path = directProofErasureHostedSourcePath(source);
			expectedPaths.push(path);
			assert.deepEqual(get(path), directProofErasureHostedOriginal(
				source.revision, source.path), path);
		}

		assert.deepEqual(index.lanes.map(lane => lane.id)
			, directProofErasureHostedLanes.map(lane => lane.key));
		const root = await mkdtemp(join(
			tmpdir(), "lean-direct-proof-erasure-evidence-"));
		const routeResults = [], artifacts = [];
		try
		{
			for(const archivedLane of index.lanes)
			{
				exactKeys(archivedLane, [
					"hostedRun", "id", "profiles", "results"
				], `lane ${archivedLane.id}`);
				const lane = directProofErasureHostedLanes.find(item =>
					item.key === archivedLane.id);
				assert.ok(lane);
				assert.deepEqual(archivedLane.profiles, lane.profiles);
				assert.equal(archivedLane.hostedRun.runId, pins.runId);
				const inputs = directProofErasureHostedInputs(root, lane);
				await mkdir(join(root, lane.key));
				for(const name of ["run", "job", "artifact"])
				{
					const path = `hosted/api/${lane.key}/${name}.json`;
					expectedPaths.push(path);
					await writeFile(inputs[`${name}-json`], get(path)
						, { flag: "wx" });
				}
				const logPath = `hosted/${lane.key}/job.log`;
				expectedPaths.push(logPath);
				await writeFile(inputs["job-log"], get(logPath), { flag: "wx" });
				let offset = 0;
				const output = await open(inputs["artifact-zip"], "wx");
				try
				{
					for(const part of archivedLane.hostedRun.artifact.parts)
					{
						exactKeys(part, [
							"bytes", "offset", "path", "sha256"
						], "artifact part");
						assert.equal(part.offset, offset);
						const bytes = get(part.path);
						expectedPaths.push(part.path);
						assert.equal(bytes.length, part.bytes);
						assert.equal(sha256(bytes), part.sha256);
						let written = 0;
						while(written < bytes.length)
						{
							const result = await output.write(bytes, written
								, bytes.length - written, offset + written);
							assert.ok(result.bytesWritten > 0);
							written += result.bytesWritten;
						}
						offset += bytes.length;
					}
				}
				finally
				{ await output.close(); }
				assert.equal(offset, archivedLane.hostedRun.artifact.bytes);
				assert.equal(await digestFile(inputs["artifact-zip"])
					, archivedLane.hostedRun.artifact.sha256);
				const selected = await inspectDirectProofErasureHostedArtifact(
					inputs, lane, index.hostedRunConclusion);
				assert.deepEqual(archivedLane.hostedRun, {
					...selected.hostedRun, artifact: {
						...selected.hostedRun.artifact
						, members: archivedLane.hostedRun.artifact.members
						, parts: archivedLane.hostedRun.artifact.parts
					}
				});
				const extracted = await extractArtifact(inputs["artifact-zip"]);
				try
				{
					assert.deepEqual(extracted.entries
						, archivedLane.hostedRun.artifact.members);
					const results = [];
					for(const route of directProofErasureMatrixRoutes.map(item =>
						item.reportRoute)){
						const result = replayDirectProofErasureHostedRoute(
							lane, route, extracted.root);
						results.push(result);
						routeResults.push(result);
						for(const name of [
							"run.tap", "verified.json", "report.json", "receipt.json"
						]){
							const path = `hosted/output/${lane.key}/${route}/${name}`;
							expectedPaths.push(path);
						}
						}
					assert.deepEqual(results, archivedLane.results);
				}
				finally
				{ await rm(extracted.root, { recursive: true }); }
				artifacts.push(archivedLane.hostedRun.artifact);
			}
		}
		finally
		{ await rm(root, { recursive: true }); }
		assert.deepEqual(validateDirectProofErasureMatrixResults(
			routeResults, pins.producer), index.matrix);
		const auditPath = "closure/proof-erasure-retained-audit.json";
		const dispositionsPath = "closure/dispositions.json";
		expectedPaths.push(auditPath, dispositionsPath);
		const auditBytes = directProofErasureHostedOriginal(
			pins.producer
			, "docs/evidence/proof-erasure-retained-audit-20261028.json"
		);
		assert.deepEqual(get(auditPath), auditBytes);
		const closure = closeDirectProofErasureMatrix(JSON.parse(auditBytes));
		assert.deepEqual(json(get(dispositionsPath), dispositionsPath), {
			schemaVersion: 1, kind: "direct-proof-erasure-matrix-closure-v1"
			, producerCommit: pins.producer, matrix: index.matrix, ...closure
		});

		exactKeys(index.refusal, ["diagnostic", "job", "runId", "test"]
			, "refusal");
		assert.equal(index.refusal.runId, pins.runId);
		assert.equal(index.refusal.job, directProofErasureHostedRefusal.jobName);
		assert.equal(index.refusal.test, directProofErasureHostedRefusal.testName);
		assert.equal(index.refusal.diagnostic
			, directProofErasureHostedRefusal.diagnostic);
		const refusal = {};
		for(const name of ["run", "job"])
		{
			const path = `hosted/api/refusal/${name}.json`;
			expectedPaths.push(path);
			refusal[name] = JSON.parse(get(path));
		}
		const refusalLogPath = "hosted/refusal/job.log";
		expectedPaths.push(refusalLogPath);
		const refusalLog = get(refusalLogPath).toString();
		assert.equal(refusal.run.id, pins.runId);
		assert.equal(refusal.run.head_sha, pins.producer);
		assert.equal(refusal.run.status, "completed");
		assert.equal(refusal.run.conclusion, "success");
		assert.equal(refusal.run.path, directProofErasureHostedRefusal.workflow);
		assert.equal(refusal.job.run_id, pins.runId);
		assert.equal(refusal.job.head_sha, pins.producer);
		assert.equal(refusal.job.status, "completed");
		assert.equal(refusal.job.conclusion, "success");
		assert.equal(refusal.job.name, directProofErasureHostedRefusal.jobName);
		assert.ok(refusalLog.includes(directProofErasureHostedRefusal.testName));

		assert.deepEqual([...files.keys()].sort(), [...new Set(expectedPaths)].sort());
		return Object.freeze({
			producerCommit: pins.producer, archiveCommit: pins.archive
			, runId: pins.runId
			, cells: index.closure.cells, lanes: index.lanes
			, artifacts: Object.freeze(artifacts), limitations: index.limitations
			, hostedAcceptance: true, supportPromoted: false
		});
	})();
	if(read === readFile) cached = checking;
	return checking;
};
