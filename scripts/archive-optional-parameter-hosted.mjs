#!/usr/bin/env node
/**
 * Freeze and independently replay the complete optional-parameter matrix.
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
	checkedRecordValueIndexHostedDigest
	, extractCheckedRecordValueIndexHostedArtifact
	, splitCheckedRecordValueIndexHostedArtifact
} from "../tests/helpers/checked-record-value-index-hosted-archive.mjs";
import {
	assertOptionalParameterHostedLocalSources
	, assertOptionalParameterHostedSteps
	, inspectOptionalParameterHostedArtifact
	, inspectOptionalParameterHostedReceipt
	, optionalParameterHostedEvidenceDirectory
	, optionalParameterHostedInputs, optionalParameterHostedLanes
	, optionalParameterHostedOriginal, optionalParameterHostedProducer
	, optionalParameterHostedReceipt, optionalParameterHostedRunId
	, optionalParameterHostedSourcePath, optionalParameterHostedSources
	, parseOptionalParameterHostedArchiveArgs
	, replayOptionalParameterHostedRoute
	, validateOptionalParameterHostedReceipt
} from "../tests/helpers/optional-parameter-hosted-archive.mjs";
import {
	optionalParameterMatrixRoutes, validateOptionalParameterMatrixResults
} from "../tests/helpers/optional-parameter-matrix.mjs";

let inputRoot;
try
{ inputRoot = parseOptionalParameterHostedArchiveArgs(process.argv.slice(2)); }
catch(error)
{ process.stderr.write(`${error.message}\n`); process.exit(2); }
assert.equal(await realpath(inputRoot), inputRoot
	, "Hosted input root must be canonical");
const selections = [...optionalParameterHostedLanes
	, optionalParameterHostedReceipt];
assert.deepEqual((await readdir(inputRoot)).sort()
	, selections.map(item => item.key).sort());
for(const item of selections)
	assert.deepEqual((await readdir(join(inputRoot, item.key))).sort(), [
		"artifact.json", "artifact.zip", "job.json", "job.log", "run.json"
	]);
await assert.rejects(access(optionalParameterHostedEvidenceDirectory)
	, { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const revisions = {
	producer: optionalParameterHostedProducer
	, checker: archiveCommit, archiver: archiveCommit
};
await assertOptionalParameterHostedLocalSources(revisions);

const descriptors = new Map();
const stagingRoot = await mkdtemp(join(
	tmpdir(), "lean-bridge-optional-hosted-staging-"));
const putBytes = (path, value) => {
	assert.ok(!descriptors.has(path), path);
	const bytes = Buffer.from(value);
	descriptors.set(path, {
		bytes: bytes.length, sha256: sha256(bytes), value: bytes
	});
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
		, source: staged
	});
};
const retainedHosted = async (item, hosted, extracted, partsRoot) => {
	await putFile(`hosted/${item.key}/job.log`
		, optionalParameterHostedInputs(inputRoot, item)["job-log"]);
	for(const [name, record] of Object.entries(hosted.api))
		putBytes(`hosted/api/${item.key}/${name}.json`, record.bytes);
	const parts = await splitCheckedRecordValueIndexHostedArtifact(
		optionalParameterHostedInputs(inputRoot, item)["artifact-zip"], partsRoot);
	for(const part of parts)
		await putFile(`hosted/${item.key}/artifact.zip.parts/${part.name}`
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
				path: `hosted/${item.key}/artifact.zip.parts/${part.name}`
				, offset: part.offset, bytes: part.bytes, sha256: part.sha256
			}))
		}
	};
};

const routeResults = [], lanes = [];
try
{
	for(const lane of optionalParameterHostedLanes)
	{
		const selected = optionalParameterHostedInputs(inputRoot, lane);
		const hosted = await inspectOptionalParameterHostedArtifact(selected, lane);
		assertOptionalParameterHostedSteps(lane, hosted.api.job.bytes);
		const extracted = await extractCheckedRecordValueIndexHostedArtifact(
			selected["artifact-zip"]);
		const partsRoot = await mkdtemp(join(
			tmpdir(), `lean-bridge-optional-${lane.key}-zip-`));
		try
		{
			const results = [];
			for(const route of optionalParameterMatrixRoutes.map(item =>
				item.reportRoute)){
				const prefix = join(extracted.root, route);
				const result = replayOptionalParameterHostedRoute(
					lane, route, extracted.root);
				const verified = await readFile(join(prefix, "verified.json"));
				assert.equal(verified.toString(), canonicalJson(result.result)
					, `${lane.key}:${route}:verified`);
				const receipt = lane.checker === "npm"
					? "handoff/component-package-receipt.json"
					: "handoff/package-set-receipt.json";
				for(const [name, path] of [
					["run.tap", join(prefix, "run.tap")]
					, ["verified.json", join(prefix, "verified.json")]
					, ["report.json", join(prefix, "records/report.json")]
					, ["receipt.json", join(prefix, `records/${receipt}`)]
				]) putBytes(`hosted/output/${lane.key}/${route}/${name}`
					, await readFile(path));
				results.push(result); routeResults.push(result);
				}
			lanes.push({
				id: lane.key, profiles: [...lane.profiles], results
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
	const matrix = validateOptionalParameterMatrixResults(
		routeResults.map(item => item.result), optionalParameterHostedProducer);

	const receiptInputs = optionalParameterHostedInputs(
		inputRoot, optionalParameterHostedReceipt);
	const receiptHosted = await inspectOptionalParameterHostedReceipt(
		receiptInputs);
	const receiptExtracted
		= await extractCheckedRecordValueIndexHostedArtifact(
			receiptInputs["artifact-zip"]);
	const receiptPartsRoot = await mkdtemp(join(
		tmpdir(), "lean-bridge-optional-matrix-zip-"));
	let aggregate;
	try
	{
		const receiptBytes = await readFile(join(
			receiptExtracted.root, "receipt.json"));
		const receipt = JSON.parse(receiptBytes);
		assert.equal(receiptBytes.toString(), canonicalJson(receipt));
		validateOptionalParameterHostedReceipt(receipt, routeResults);
		putBytes("hosted/output/matrix/receipt.json", receiptBytes);
		aggregate = {
			receipt
			, hostedRun: await retainedHosted(
				optionalParameterHostedReceipt, receiptHosted
				, receiptExtracted, receiptPartsRoot)
		};
	}
	finally
	{
		await rm(receiptExtracted.root, { recursive: true });
		await rm(receiptPartsRoot, { recursive: true });
	}

	const selectedSources = optionalParameterHostedSources(revisions);
	for(const source of selectedSources)
		putBytes(optionalParameterHostedSourcePath(source)
			, optionalParameterHostedOriginal(source.revision, source.path));
	const files = [...descriptors].sort(([left], [right]) =>
		left.localeCompare(right)).map(([path, descriptor]) => ({
		path, bytes: descriptor.bytes, sha256: descriptor.sha256
		}));
	const index = {
		schemaVersion: 1, kind: "optional-parameter-hosted-matrix-v1"
		, producerCommit: optionalParameterHostedProducer
		, checkerCommit: archiveCommit, archiveCommit
		, runId: optionalParameterHostedRunId, matrix
		, totals: aggregate.receipt.totals, lanes, aggregate
		, selectedSources, files
		, limitations: [
			"The ten same-run artifacts establish ordinary and independently reviewed installed optional parameters across all seventeen supported consumer profiles."
			, "The aggregate receipt authenticates the exact twenty independently replayed lane/route results and distinguishes omission, explicit defaults, nondefault values, Option.none, Unit, invalid host values and explicit host null."
			, "Every lane retains its original GitHub artifact ZIP, API identities, job log, TAP, report, receipt and verified result, plus exact producer, checker and archiver source closures."
			, "External runtimes, compilers, package managers, browsers, GitHub Actions and operating systems remain trusted recorded inputs; no result, field, callback, resource or asynchronous optionality claim is made."
		]
	};

	await mkdir(optionalParameterHostedEvidenceDirectory);
	for(const [path, descriptor] of descriptors)
	{
		const target = join(optionalParameterHostedEvidenceDirectory, path);
		await mkdir(dirname(target), { recursive: true });
		if(descriptor.source) await copyFile(
			descriptor.source, target, constants.COPYFILE_FICLONE);
		else await writeFile(target, descriptor.value, { flag: "wx" });
		assert.equal((await stat(target)).size, descriptor.bytes, path);
		assert.equal(await checkedRecordValueIndexHostedDigest(target)
			, descriptor.sha256, path);
	}
	const indexBytes = Buffer.from(canonicalJson(index));
	await writeFile(join(optionalParameterHostedEvidenceDirectory
		, "index.json"), indexBytes, { flag: "wx" });
	process.stdout.write(canonicalJson({
		destination: optionalParameterHostedEvidenceDirectory
		, files: files.length + 1
		, bytes: files.reduce((sum, file) => sum + file.bytes
			, indexBytes.length)
		, ...revisions
		, runId: optionalParameterHostedRunId
		, artifacts: [
			...lanes.map(lane => lane.hostedRun.artifact)
			, aggregate.hostedRun.artifact
		]
		, indexSha256: sha256(indexBytes)
	}));
}
finally
{ await rm(stagingRoot, { recursive: true }); }
