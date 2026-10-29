/**
 * Authenticate and independently replay the complete optional archive.
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
	inspectOptionalParameterHostedArtifact
	, inspectOptionalParameterHostedReceipt
	, optionalParameterHostedEvidenceDirectory
	, optionalParameterHostedInputs, optionalParameterHostedLanes
	, optionalParameterHostedOriginal, optionalParameterHostedProducer
	, optionalParameterHostedReceipt, optionalParameterHostedRunId
	, optionalParameterHostedSourcePath, optionalParameterHostedSources
	, replayOptionalParameterHostedRoute
	, validateOptionalParameterHostedReceipt
} from "./optional-parameter-hosted-archive.mjs";
import {
	optionalParameterMatrixRoutes, validateOptionalParameterMatrixResults
} from "./optional-parameter-matrix.mjs";
import {
	optionalParameterCompleteEvidenceId
	, optionalParameterCompleteReferencePaths
} from "./optional-parameter-complete-promotion.mjs";

export const optionalParameterHostedEvidencePins = Object.freeze({
	index: "PENDING_OPTIONAL_PARAMETER_INDEX"
	, producer: optionalParameterHostedProducer
	, archive: "PENDING_OPTIONAL_PARAMETER_ARCHIVE"
	, runId: optionalParameterHostedRunId
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

const reconstruct = async (get, parts, target, expectedPaths) => {
	const output = await open(target, "wx");
	let offset = 0;
	try
	{
		for(const part of parts)
		{
			exactKeys(part, ["bytes", "offset", "path", "sha256"]
				, "artifact part");
			assert.equal(part.offset, offset);
			const bytes = get(part.path); expectedPaths.push(part.path);
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
	return offset;
};

/**
 * Verify every retained byte, rebuild all eleven ZIPs and replay all lanes.
 *
 * @param read - Repository-relative evidence byte reader.
 */
export const checkOptionalParameterHostedEvidence = async (
	read = readFile
) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const pins = optionalParameterHostedEvidencePins;
		assert.match(pins.index, /^[a-f0-9]{64}$/u);
		assert.match(pins.producer, /^[a-f0-9]{40}$/u);
		assert.match(pins.archive, /^[a-f0-9]{40}$/u);
		assert.ok(Number.isSafeInteger(pins.runId) && pins.runId > 0);
		const indexPath = `${optionalParameterHostedEvidenceDirectory}/index.json`;
		const indexBytes = Buffer.from(await read(indexPath));
		assert.equal(sha256(indexBytes), pins.index, "index.json");
		const index = json(indexBytes, "index.json"), files = new Map();
		exactKeys(index, [
			"aggregate", "archiveCommit", "checkerCommit", "files", "kind"
			, "lanes", "limitations", "matrix", "producerCommit", "runId"
			, "schemaVersion", "selectedSources", "totals"
		], "index keys");
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "optional-parameter-hosted-matrix-v1");
		assert.equal(index.producerCommit, pins.producer);
		assert.equal(index.checkerCommit, pins.archive);
		assert.equal(index.archiveCommit, pins.archive);
		assert.equal(index.runId, pins.runId);
		assert.deepEqual(index.matrix
			, { lanes: 10, routes: 2, profiles: 17, cells: 34 });
		assert.deepEqual(index.totals
			, { reports: 20, checks: 600, executions: 76, rejections: 110 });
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
				`${optionalParameterHostedEvidenceDirectory}/${descriptor.path}`
			));
			assert.equal(bytes.length, descriptor.bytes, descriptor.path);
			assert.equal(sha256(bytes), descriptor.sha256, descriptor.path);
			files.set(descriptor.path, bytes);
		}
		const get = path => {
			const bytes = files.get(path);
			assert.ok(Buffer.isBuffer(bytes), path); return bytes;
		};
		const revisions = {
			producer: pins.producer, checker: pins.archive
			, archiver: pins.archive
		};
		const selectedSources = optionalParameterHostedSources(revisions);
		assert.deepEqual(index.selectedSources, selectedSources);
		const expectedPaths = [];
		for(const source of selectedSources)
		{
			const path = optionalParameterHostedSourcePath(source);
			expectedPaths.push(path);
			assert.deepEqual(get(path), optionalParameterHostedOriginal(
				source.revision, source.path), path);
		}
		assert.deepEqual(index.lanes.map(item => item.id)
			, optionalParameterHostedLanes.map(item => item.key));
		const root = await mkdtemp(join(
			tmpdir(), "lean-optional-parameter-evidence-"));
		const routeResults = [], artifacts = [];
		try
		{
			for(const archived of index.lanes)
			{
				const lane = optionalParameterHostedLanes.find(item =>
					item.key === archived.id);
				assert.ok(lane);
				assert.deepEqual(archived.profiles, lane.profiles);
				const inputs = optionalParameterHostedInputs(root, lane);
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
				const bytes = await reconstruct(get
					, archived.hostedRun.artifact.parts
					, inputs["artifact-zip"], expectedPaths);
				assert.equal(bytes, archived.hostedRun.artifact.bytes);
				assert.equal(await digestFile(inputs["artifact-zip"])
					, archived.hostedRun.artifact.sha256);
				const selected = await inspectOptionalParameterHostedArtifact(
					inputs, lane);
				assert.deepEqual(archived.hostedRun, {
					...selected.hostedRun, artifact: {
						...selected.hostedRun.artifact
						, members: archived.hostedRun.artifact.members
						, parts: archived.hostedRun.artifact.parts
					}
				});
				const extracted = await extractArtifact(inputs["artifact-zip"]);
				try
				{
					assert.deepEqual(extracted.entries
						, archived.hostedRun.artifact.members);
					const results = [];
					for(const route of optionalParameterMatrixRoutes.map(item =>
						item.reportRoute)){
						const result = replayOptionalParameterHostedRoute(
							lane, route, extracted.root);
						results.push(result); routeResults.push(result);
						for(const name of [
							"run.tap", "verified.json", "report.json", "receipt.json"
						]) {
							const path = `hosted/output/${lane.key}/${route}/${name}`;
							expectedPaths.push(path);
						}
						}
					assert.deepEqual(results, archived.results);
				}
				finally
				{ await rm(extracted.root, { recursive: true }); }
				artifacts.push(archived.hostedRun.artifact);
			}

			const item = optionalParameterHostedReceipt;
			const inputs = optionalParameterHostedInputs(root, item);
			await mkdir(join(root, item.key));
			for(const name of ["run", "job", "artifact"])
			{
				const path = `hosted/api/${item.key}/${name}.json`;
				expectedPaths.push(path);
				await writeFile(inputs[`${name}-json`], get(path), { flag: "wx" });
			}
			const logPath = `hosted/${item.key}/job.log`;
			expectedPaths.push(logPath);
			await writeFile(inputs["job-log"], get(logPath), { flag: "wx" });
			const bytes = await reconstruct(get
				, index.aggregate.hostedRun.artifact.parts
				, inputs["artifact-zip"], expectedPaths);
			assert.equal(bytes, index.aggregate.hostedRun.artifact.bytes);
			assert.equal(await digestFile(inputs["artifact-zip"])
				, index.aggregate.hostedRun.artifact.sha256);
			const selected = await inspectOptionalParameterHostedReceipt(inputs);
			assert.deepEqual(index.aggregate.hostedRun, {
				...selected.hostedRun, artifact: {
					...selected.hostedRun.artifact
					, members: index.aggregate.hostedRun.artifact.members
					, parts: index.aggregate.hostedRun.artifact.parts
				}
			});
			const extracted = await extractArtifact(inputs["artifact-zip"]);
			try
			{
				assert.deepEqual(extracted.entries
					, index.aggregate.hostedRun.artifact.members);
				const path = "hosted/output/matrix/receipt.json";
				expectedPaths.push(path);
				const receipt = json(get(path), path);
				assert.deepEqual(receipt, index.aggregate.receipt);
				validateOptionalParameterHostedReceipt(receipt, routeResults);
			}
			finally
			{ await rm(extracted.root, { recursive: true }); }
			artifacts.push(index.aggregate.hostedRun.artifact);
		}
		finally
		{ await rm(root, { recursive: true }); }
		assert.deepEqual(validateOptionalParameterMatrixResults(
			routeResults.map(item => item.result), pins.producer), index.matrix);
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return Object.freeze({
			producerCommit: pins.producer, archiveCommit: pins.archive
			, runId: pins.runId, cells: index.matrix.cells
			, lanes: index.lanes, artifacts: Object.freeze(artifacts)
			, limitations: index.limitations
			, hostedAcceptance: true, supportPromoted: false
		});
	})();
	if(read === readFile) cached = checking;
	return checking;
};

/** Authenticate the archive and describe its exact inventory evidence. */
export const optionalParameterCompleteReference = async () => {
	const checked = await checkOptionalParameterHostedEvidence();
	assert.equal(checked.hostedAcceptance, true);
	assert.equal(checked.supportPromoted, false);
	assert.equal(checked.cells, 34);
	assert.equal(checked.lanes.length, 10);
	assert.equal(checked.artifacts.length, 11);
	return Object.freeze({
		id: optionalParameterCompleteEvidenceId
		, revision: checked.producerCommit
		, command: "node --test --test-concurrency=1 tests/optional-parameter-complete-hosted-evidence.test.mjs"
		, scope: "Ten same-revision installed-consumer artifacts and their independently reconciled aggregate receipt close all thirty-four optional-parameter signature cells across seventeen profiles and both author routes."
		, files: await Promise.all(optionalParameterCompleteReferencePaths
			.map(async path => ({ path, sha256: sha256(await readFile(path)) })))
		, artifacts: Object.freeze(checked.artifacts.map(artifact => ({
			path: `${artifact.name}.zip`, sha256: artifact.sha256
		})))
		, limitations: checked.limitations
	});
};
