/**
 * Authenticate and independently replay the complete dependent-signature archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	mkdir, mkdtemp, open, readFile, realpath, rm, stat, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkedRecordValueIndexHostedDigest as digestFile
	, checkedRecordValueIndexHostedSafeZipPath as safePath
	, extractCheckedRecordValueIndexHostedArtifact as extractArtifact
} from "./checked-record-value-index-hosted-archive.mjs";
import {
	assertDependentSignatureHostedReceiptSteps
	, assertDependentSignatureHostedSteps
	, dependentSignatureHostedEvidenceDirectory
	, dependentSignatureHostedInputs, dependentSignatureHostedLanes
	, dependentSignatureHostedOriginal, dependentSignatureHostedProducer
	, dependentSignatureHostedReceipt, dependentSignatureHostedRunId
	, dependentSignatureHostedSourcePath, dependentSignatureHostedSources
	, inspectDependentSignatureHostedArtifact
	, inspectDependentSignatureHostedReceipt
	, validateDependentSignatureHostedReceipt
} from "./dependent-signature-hosted-archive.mjs";
import {
	buildDependentSignatureMatrixReceipt
	, dependentSignatureMatrixResultPath, dependentSignatureMatrixRoutes
} from "./dependent-signature-matrix-receipt.mjs";

export const dependentSignatureHostedIndexPath
	= `${dependentSignatureHostedEvidenceDirectory}/index.json`;

const exactKeys = (value, keys, label) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort(), label
);
const apiRecords = api => Object.fromEntries(Object.entries(api).map(
	([name, record]) => [name, {
		bytes: record.bytes.length, sha256: record.sha256
	}]
));
const canonical = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), label);
	return value;
};
const reconstruct = async (root, parts, target) => {
	const output = await open(target, "wx");
	let offset = 0;
	try
	{
		for(const part of parts)
		{
			exactKeys(part, ["bytes", "offset", "path", "sha256"]
				, "artifact part");
			assert.equal(part.offset, offset);
			const bytes = await readFile(join(root, part.path));
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
const materializeHosted = async (root, temporary, item, archived) => {
	const inputs = dependentSignatureHostedInputs(temporary, item);
	await mkdir(join(temporary, item.id));
	for(const name of ["run", "job", "artifact"])
		await writeFile(inputs[`${name}-json`], await readFile(join(
			root, `hosted/api/${item.id}/${name}.json`
		)), { flag: "wx" });
	await writeFile(inputs["job-log"], await readFile(join(
		root, `hosted/${item.id}/job.log`
	)), { flag: "wx" });
	const bytes = await reconstruct(
		root, archived.hostedRun.artifact.parts, inputs["artifact-zip"]);
	assert.equal(bytes, archived.hostedRun.artifact.bytes);
	assert.equal(await digestFile(inputs["artifact-zip"])
		, archived.hostedRun.artifact.sha256);
	return inputs;
};

/**
 * Verify every retained byte, rebuild all twelve ZIPs and replay the matrix.
 *
 * @param evidenceRoot - Immutable retained evidence root.
 */
export const checkDependentSignatureHostedEvidence = async (
	evidenceRoot = dependentSignatureHostedEvidenceDirectory
) => {
	const root = await realpath(evidenceRoot);
	const indexBytes = await readFile(join(root, "index.json"));
	const index = canonical(indexBytes, "index.json");
	exactKeys(index, [
		"aggregate", "archiveCommit", "checkerCommit", "files", "kind"
		, "lanes", "limitations", "matrix", "producerCommit", "runId"
		, "schemaVersion", "selectedSources"
	], "index");
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "dependent-signatures-hosted-installed-v1");
	assert.equal(index.producerCommit, dependentSignatureHostedProducer);
	assert.equal(index.runId, dependentSignatureHostedRunId);
	assert.deepEqual(index.matrix, {
		lanes: 11, profiles: 17, authorRoutes: 2, apiModes: 2
		, reports: 44, cells: 34
	});
	assert.equal(index.limitations.length, 5);
	assert.deepEqual(index.lanes.map(item => item.id)
		, dependentSignatureHostedLanes.map(item => item.id));
	assert.deepEqual(index.files, [...index.files].sort((left, right) =>
		left.path.localeCompare(right.path)));
	assert.equal(new Set(index.files.map(file => file.path)).size
		, index.files.length);
	assert.deepEqual(await nativeArtifactPaths(root), [
		"index.json", ...index.files.map(file => file.path)
	].sort());
	for(const file of index.files)
	{
		exactKeys(file, ["bytes", "path", "sha256"], file.path);
		assert.ok(safePath(file.path), file.path);
		const path = join(root, file.path), information = await stat(path);
		assert.equal(information.size, file.bytes, file.path);
		assert.equal(await digestFile(path), file.sha256, file.path);
	}
	const revisions = {
		producer: index.producerCommit, checker: index.checkerCommit
		, archiver: index.archiveCommit
	};
	assert.deepEqual(index.selectedSources
		, dependentSignatureHostedSources(revisions));
	for(const source of index.selectedSources)
		assert.deepEqual(await readFile(join(root
			, dependentSignatureHostedSourcePath(source)))
		, dependentSignatureHostedOriginal(source.revision, source.path));

	const temporary = await mkdtemp(join(
		tmpdir(), "lean-dependent-signature-evidence-"));
	const summaries = new Map();
	try
	{
		for(const archived of index.lanes)
		{
			const lane = dependentSignatureHostedLanes.find(item =>
				item.id === archived.id);
			assert.ok(lane);
			assert.deepEqual(archived.profiles, lane.profiles);
			const inputs = await materializeHosted(
				root, temporary, lane, archived);
			const selected = await inspectDependentSignatureHostedArtifact(
				inputs, lane);
			assertDependentSignatureHostedSteps(
				lane, selected.api.job.bytes);
			assert.deepEqual(archived.hostedRun, {
				...selected.hostedRun, apiRecords: apiRecords(selected.api)
				, artifact: {
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
				for(const route of dependentSignatureMatrixRoutes)
				{
					const path = dependentSignatureMatrixResultPath(
						lane.matrixLane, route, dependentSignatureHostedProducer);
					const relative = path.slice(path.indexOf("/") + 1);
					const bytes = await readFile(join(extracted.root, relative));
					canonical(bytes, `${lane.id}:${route}`);
					assert.deepEqual(bytes, await readFile(join(root
						, `hosted/output/${lane.id}/${route}.json`)));
					assert.ok(!summaries.has(path), path);
					summaries.set(path, bytes);
				}
			}
			finally
			{ await rm(extracted.root, { recursive: true }); }
			assert.ok((await readFile(inputs["job-log"])).length > 0);
		}

		const inputs = await materializeHosted(
			root, temporary, dependentSignatureHostedReceipt, index.aggregate);
		const selected = await inspectDependentSignatureHostedReceipt(inputs);
		assertDependentSignatureHostedReceiptSteps(selected.api.job.bytes);
		assert.deepEqual(index.aggregate.hostedRun, {
			...selected.hostedRun, apiRecords: apiRecords(selected.api)
			, artifact: {
				...selected.hostedRun.artifact
				, members: index.aggregate.hostedRun.artifact.members
				, parts: index.aggregate.hostedRun.artifact.parts
			}
		});
		const extracted = await extractArtifact(inputs["artifact-zip"]);
		let receipt;
		try
		{
			assert.deepEqual(extracted.entries
				, index.aggregate.hostedRun.artifact.members);
			const bytes = await readFile(join(extracted.root, "receipt.json"));
			receipt = canonical(bytes, "receipt.json");
			assert.deepEqual(bytes, await readFile(join(
				root, "hosted/output/matrix/receipt.json")));
		}
		finally
		{ await rm(extracted.root, { recursive: true }); }
		validateDependentSignatureHostedReceipt(receipt);
		assert.deepEqual(receipt, index.aggregate.receipt);
		const replayed = await buildDependentSignatureMatrixReceipt(path => {
			assert.ok(summaries.has(path), path); return summaries.get(path);
		}, receipt.run);
		assert.deepEqual(replayed, receipt);
		assert.deepEqual(index.matrix, receipt.matrix);
		for(const lane of index.lanes)
			assert.deepEqual(lane.results
				, receipt.records.filter(record => record.lane === lane.id));
	}
	finally
	{ await rm(temporary, { recursive: true }); }
	return index;
};
