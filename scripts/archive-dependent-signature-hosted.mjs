#!/usr/bin/env node
/**
 * Freeze and independently replay all 34 hosted dependent-signature cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, constants, copyFile, mkdir, mkdtemp, readFile, readdir, realpath
	, rm, stat, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	createTransactionalDirectory
} from "../src/capsule/transactional-directory.mjs";
import {
	checkedRecordValueIndexHostedDigest
	, extractCheckedRecordValueIndexHostedArtifact
	, splitCheckedRecordValueIndexHostedArtifact
} from "../tests/helpers/checked-record-value-index-hosted-archive.mjs";
import {
	assertDependentSignatureHostedLocalSources
	, assertDependentSignatureHostedReceiptSteps
	, assertDependentSignatureHostedSteps
	, dependentSignatureHostedEvidenceDirectory
	, dependentSignatureHostedInputs
	, dependentSignatureHostedLanes
	, dependentSignatureHostedOriginal
	, dependentSignatureHostedProducer
	, dependentSignatureHostedReceipt
	, dependentSignatureHostedRunId
	, dependentSignatureHostedSourcePath
	, dependentSignatureHostedSources
	, inspectDependentSignatureHostedArtifact
	, inspectDependentSignatureHostedReceipt
	, parseDependentSignatureHostedArchiveArgs
	, validateDependentSignatureHostedReceipt
} from "../tests/helpers/dependent-signature-hosted-archive.mjs";
import {
	buildDependentSignatureMatrixReceipt
	, dependentSignatureMatrixResultPath
	, dependentSignatureMatrixRoutes
} from "../tests/helpers/dependent-signature-matrix-receipt.mjs";

let inputRoot;
try
{
	inputRoot = parseDependentSignatureHostedArchiveArgs(process.argv.slice(2));
}
catch(error)
{
	process.stderr.write(`${error.message}\n`); process.exit(2);
}
assert.equal(await realpath(inputRoot), inputRoot
	, "Hosted input root must be canonical");
const selections = [...dependentSignatureHostedLanes
	, dependentSignatureHostedReceipt];
assert.deepEqual((await readdir(inputRoot)).sort()
	, selections.map(item => item.id).sort());
for(const item of selections)
	assert.deepEqual((await readdir(join(inputRoot, item.id))).sort(), [
		"artifact.json", "artifact.zip", "job.json", "job.log", "run.json"
	]);
await assert.rejects(access(dependentSignatureHostedEvidenceDirectory)
	, { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const revisions = {
	producer: dependentSignatureHostedProducer
	, checker: archiveCommit, archiver: archiveCommit
};
await assertDependentSignatureHostedLocalSources(revisions);

const descriptors = new Map();
const transaction = await createTransactionalDirectory(
	dependentSignatureHostedEvidenceDirectory);
const stagingRoot = transaction.root;
const putBytes = async (path, value) => {
	assert.ok(!descriptors.has(path), path);
	const bytes = Buffer.from(value);
	const staged = join(stagingRoot, path);
	await mkdir(dirname(staged), { recursive: true });
	await writeFile(staged, bytes, { flag: "wx" });
	descriptors.set(path, { bytes: bytes.length, sha256: sha256(bytes) });
};
const putFile = async (path, source) => {
	assert.ok(!descriptors.has(path), path);
	const information = await stat(source);
	assert.ok(information.isFile(), source);
	const staged = join(stagingRoot, path);
	await mkdir(dirname(staged), { recursive: true });
	await copyFile(source, staged, constants.COPYFILE_FICLONE);
	descriptors.set(path, {
		bytes: information.size
		, sha256: await checkedRecordValueIndexHostedDigest(staged)
	});
};
const retainedHosted = async (item, hosted, extracted, partsRoot) => {
	const selected = dependentSignatureHostedInputs(inputRoot, item);
	await putFile(`hosted/${item.id}/job.log`, selected["job-log"]);
	for(const [name, record] of Object.entries(hosted.api))
		await putBytes(`hosted/api/${item.id}/${name}.json`, record.bytes);
	const parts = await splitCheckedRecordValueIndexHostedArtifact(
		selected["artifact-zip"], partsRoot);
	for(const part of parts)
		await putFile(`hosted/${item.id}/artifact.zip.parts/${part.name}`
			, part.path);
	return {
		...hosted.hostedRun
		, apiRecords: Object.fromEntries(Object.entries(hosted.api).map(
			([name, record]) => [name, {
				bytes: record.bytes.length, sha256: record.sha256
			}]
		))
		, artifact: {
			...hosted.hostedRun.artifact, members: extracted.entries
			, parts: parts.map(part => ({
				path: `hosted/${item.id}/artifact.zip.parts/${part.name}`
				, offset: part.offset, bytes: part.bytes, sha256: part.sha256
			}))
		}
	};
};

const lanes = [], summaries = new Map();
try
{
	for(const lane of dependentSignatureHostedLanes)
	{
		const selected = dependentSignatureHostedInputs(inputRoot, lane);
		const hosted = await inspectDependentSignatureHostedArtifact(
			selected, lane);
		assertDependentSignatureHostedSteps(lane, hosted.api.job.bytes);
		const extracted = await extractCheckedRecordValueIndexHostedArtifact(
			selected["artifact-zip"]);
		const partsRoot = await mkdtemp(join(
			tmpdir(), `lean-bridge-dependent-${lane.id}-zip-`));
		try
		{
			for(const route of dependentSignatureMatrixRoutes)
			{
				const path = dependentSignatureMatrixResultPath(
					lane.matrixLane, route, dependentSignatureHostedProducer);
				const relative = path.slice(path.indexOf("/") + 1);
				const bytes = await readFile(join(extracted.root, relative));
				const value = JSON.parse(bytes);
				assert.equal(bytes.toString(), canonicalJson(value)
					, `${lane.id}:${route}`);
				assert.ok(!summaries.has(path), path);
				summaries.set(path, bytes);
				await putBytes(`hosted/output/${lane.id}/${route}.json`, bytes);
			}
			lanes.push({
				id: lane.id, profiles: [...lane.profiles]
				, hostedRun: await retainedHosted(
					lane, hosted, extracted, partsRoot)
			});
		}
		finally
		{
			await rm(extracted.root, { recursive: true });
			await rm(partsRoot, { recursive: true });
		}
	}

	const receiptInputs = dependentSignatureHostedInputs(
		inputRoot, dependentSignatureHostedReceipt);
	const receiptHosted = await inspectDependentSignatureHostedReceipt(
		receiptInputs);
	assertDependentSignatureHostedReceiptSteps(receiptHosted.api.job.bytes);
	const receiptExtracted
		= await extractCheckedRecordValueIndexHostedArtifact(
			receiptInputs["artifact-zip"]);
	const receiptPartsRoot = await mkdtemp(join(
		tmpdir(), "lean-bridge-dependent-signature-matrix-zip-"));
	let aggregate, receipt;
	try
	{
		const receiptBytes = await readFile(join(
			receiptExtracted.root, "receipt.json"));
		receipt = JSON.parse(receiptBytes);
		assert.equal(receiptBytes.toString(), canonicalJson(receipt));
		validateDependentSignatureHostedReceipt(receipt);
		const replayed = await buildDependentSignatureMatrixReceipt(path => {
			assert.ok(summaries.has(path), path); return summaries.get(path);
		}, receipt.run);
		assert.deepEqual(replayed, receipt);
		await putBytes("hosted/output/matrix/receipt.json", receiptBytes);
		aggregate = {
			receipt
			, hostedRun: await retainedHosted(
				dependentSignatureHostedReceipt, receiptHosted
				, receiptExtracted, receiptPartsRoot)
		};
	}
	finally
	{
		await rm(receiptExtracted.root, { recursive: true });
		await rm(receiptPartsRoot, { recursive: true });
	}
	for(const lane of lanes)
		lane.results = receipt.records.filter(record => record.lane === lane.id);

	const selectedSources = dependentSignatureHostedSources(revisions);
	for(const source of selectedSources)
		await putBytes(dependentSignatureHostedSourcePath(source)
			, dependentSignatureHostedOriginal(source.revision, source.path));
	const files = [...descriptors].sort(([left], [right]) =>
		left.localeCompare(right)).map(([path, descriptor]) => ({
		path, bytes: descriptor.bytes, sha256: descriptor.sha256
		}));
	const index = {
		schemaVersion: 1
		, kind: "dependent-signatures-hosted-installed-v1"
		, producerCommit: dependentSignatureHostedProducer
		, checkerCommit: archiveCommit, archiveCommit
		, runId: dependentSignatureHostedRunId
		, matrix: receipt.matrix, lanes, aggregate, selectedSources, files
		, limitations: [
			"The eleven same-run producer artifacts establish all thirty-four direct dependent-signature cells: seventeen supported profiles across ordinary Lean source and independently reviewed Binding IR."
			, "Every installed package checks a concrete Fin value against the live earlier Nat argument before entering Lean, exercises rejected endpoints and huge values, preserves caller data, and recovers for later calls."
			, "The same-run receipt authenticates all forty-four independent checker summaries across eleven lanes, two author routes and full and result-only public APIs."
			, "The native, managed, dynamic-language, browser, WIT/WASI and four-ABI Perl lanes use reproducible source-free package handoffs and public host APIs."
			, "The archive retains all twelve complete original GitHub artifact ZIPs, API identities, job logs, canonical summaries and exact producer, checker and archiver source closures. External toolchains, runners, browsers and operating-system packages remain trusted recorded inputs."
		]
	};

	for(const [path, descriptor] of descriptors)
	{
		const target = join(stagingRoot, path);
		assert.equal((await stat(target)).size, descriptor.bytes, path);
		assert.equal(await checkedRecordValueIndexHostedDigest(target)
			, descriptor.sha256, path);
	}
	const indexBytes = Buffer.from(canonicalJson(index));
	await writeFile(join(stagingRoot, "index.json"), indexBytes, { flag: "wx" });
	await transaction.publish();
	process.stdout.write(canonicalJson({
		destination: dependentSignatureHostedEvidenceDirectory
		, files: files.length + 1
		, bytes: files.reduce((sum, file) => sum + file.bytes
			, indexBytes.length)
		, ...revisions
		, runId: dependentSignatureHostedRunId
		, artifacts: [...lanes.map(lane => lane.hostedRun.artifact)
			, aggregate.hostedRun.artifact]
		, indexSha256: sha256(indexBytes)
	}));
}
finally
{ await transaction.dispose(); }
