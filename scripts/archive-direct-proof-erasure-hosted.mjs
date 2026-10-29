#!/usr/bin/env node
/**
 * Freeze and independently replay the complete direct proof-erasure matrix.
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
	assertDirectProofErasureHostedLocalSources
	, assertDirectProofErasureHostedSteps
	, directProofErasureHostedCoreRunId
	, directProofErasureHostedEvidenceDirectory
	, directProofErasureHostedInputs
	, directProofErasureHostedLanes
	, directProofErasureHostedOriginal
	, directProofErasureHostedProducer
	, directProofErasureHostedRefusal
	, directProofErasureHostedSourcePath
	, directProofErasureHostedSources
	, inspectDirectProofErasureHostedArtifact
	, parseDirectProofErasureHostedArchiveArgs
	, replayDirectProofErasureHostedRoute
} from "../tests/helpers/direct-proof-erasure-hosted-archive.mjs";
import {
	closeDirectProofErasureMatrix, directProofErasureMatrixRoutes
	, validateDirectProofErasureMatrixResults
} from "../tests/helpers/direct-proof-erasure-matrix.mjs";

let inputRoot;
try
{ inputRoot = parseDirectProofErasureHostedArchiveArgs(process.argv.slice(2)); }
catch(error)
{ process.stderr.write(`${error.message}\n`); process.exit(2); }
assert.equal(await realpath(inputRoot), inputRoot
	, "Hosted input root must be canonical");
assert.deepEqual((await readdir(inputRoot)).sort(), [
	...directProofErasureHostedLanes.map(lane => lane.key)
	, directProofErasureHostedRefusal.id
].sort());
for(const lane of directProofErasureHostedLanes)
	assert.deepEqual((await readdir(join(inputRoot, lane.key))).sort(), [
		"artifact.json", "artifact.zip", "job.json", "job.log", "run.json"
	]);
const refusalRoot = join(inputRoot, directProofErasureHostedRefusal.id);
assert.deepEqual((await readdir(refusalRoot)).sort()
	, ["job.json", "job.log", "run.json"]);
await assert.rejects(access(directProofErasureHostedEvidenceDirectory)
	, { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const revisions = {
	producer: directProofErasureHostedProducer
	, checker: archiveCommit, archiver: archiveCommit
};
await assertDirectProofErasureHostedLocalSources(revisions);

const descriptors = new Map();
const transaction = await createTransactionalDirectory(
	directProofErasureHostedEvidenceDirectory);
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

const routeResults = [], lanes = [];
try
{
	const firstRun = JSON.parse(await readFile(join(
		inputRoot, directProofErasureHostedLanes[0].key, "run.json")));
	assert.ok(["failure", "success"].includes(firstRun.conclusion));
	for(const lane of directProofErasureHostedLanes)
	{
		const selected = directProofErasureHostedInputs(inputRoot, lane);
		const hosted = await inspectDirectProofErasureHostedArtifact(
			selected, lane, firstRun.conclusion);
		assertDirectProofErasureHostedSteps(lane, hosted.api.job.bytes);
		const extracted = await extractCheckedRecordValueIndexHostedArtifact(
			selected["artifact-zip"]);
		const partsRoot = await mkdtemp(join(
			tmpdir(), `lean-bridge-direct-proof-${lane.key}-zip-`));
		try
		{
			const results = [];
			const routes = directProofErasureMatrixRoutes.map(item =>
				item.reportRoute);
			for(const route of routes)
			{
				const prefix = join(extracted.root, route);
				const result = replayDirectProofErasureHostedRoute(
					lane, route, extracted.root);
				const verified = await readFile(join(prefix, "verified.json"));
				assert.equal(verified.toString(), canonicalJson(result.result)
					, `${lane.key}:${route}:verified`);
				const tap = await readFile(join(prefix, "run.tap"));
				const report = await readFile(join(
					prefix, "records/report.json"));
				const receipt = lane.checker === "npm"
					? "handoff/component-package-receipt.json"
					: "handoff/package-set-receipt.json";
				await putBytes(`hosted/output/${lane.key}/${route}/run.tap`, tap);
				await putBytes(`hosted/output/${lane.key}/${route}/verified.json`
					, verified);
				await putBytes(`hosted/output/${lane.key}/${route}/report.json`
					, report);
				await putBytes(`hosted/output/${lane.key}/${route}/receipt.json`
					, await readFile(join(prefix, `records/${receipt}`)));
				results.push(result); routeResults.push(result);
			}
			await putFile(`hosted/${lane.key}/job.log`, selected["job-log"]);
			for(const [name, item] of Object.entries(hosted.api))
				await putBytes(`hosted/api/${lane.key}/${name}.json`, item.bytes);
			const parts = await splitCheckedRecordValueIndexHostedArtifact(
				selected["artifact-zip"], partsRoot);
			for(const part of parts)
				await putFile(
					`hosted/${lane.key}/artifact.zip.parts/${part.name}`
					, part.path);
			lanes.push({
				id: lane.key, profiles: [...lane.profiles], results
				, hostedRun: {
					...hosted.hostedRun
					, apiRecords: Object.fromEntries(
						Object.entries(hosted.api).map(([name, item]) => [name, {
							bytes: item.bytes.length, sha256: item.sha256
						}])
					)
					, artifact: {
						...hosted.hostedRun.artifact, members: extracted.entries
						, parts: parts.map(part => ({
							path: `hosted/${lane.key}/artifact.zip.parts/${part.name}`
							, offset: part.offset, bytes: part.bytes
							, sha256: part.sha256
						}))
					}
				}
			});
		}
		finally
		{
			await rm(extracted.root, { recursive: true });
			await rm(partsRoot, { recursive: true });
		}
	}
	const matrix = validateDirectProofErasureMatrixResults(
		routeResults, directProofErasureHostedProducer);
	const auditBytes = directProofErasureHostedOriginal(
		directProofErasureHostedProducer
		, "docs/evidence/proof-erasure-retained-audit-20261028.json"
	);
	const closure = closeDirectProofErasureMatrix(JSON.parse(auditBytes));
	await putBytes("closure/proof-erasure-retained-audit.json", auditBytes);
	await putBytes("closure/dispositions.json", canonicalJson({
		schemaVersion: 1, kind: "direct-proof-erasure-matrix-closure-v1"
		, producerCommit: directProofErasureHostedProducer
		, matrix, ...closure
	}));

	const refusal = {};
	for(const name of ["run", "job"])
	{
		const bytes = await readFile(join(refusalRoot, `${name}.json`));
		refusal[name] = { bytes, value: JSON.parse(bytes), sha256: sha256(bytes) };
	}
	const refusalLog = await readFile(join(refusalRoot, "job.log"));
	assert.equal(refusal.run.value.id, directProofErasureHostedCoreRunId);
	assert.equal(refusal.run.value.head_sha, directProofErasureHostedProducer);
	assert.equal(refusal.run.value.path, directProofErasureHostedRefusal.workflow);
	assert.equal(refusal.run.value.status, "completed");
	assert.equal(refusal.run.value.conclusion, "success");
	assert.equal(refusal.job.value.run_id, directProofErasureHostedCoreRunId);
	assert.equal(refusal.job.value.head_sha, directProofErasureHostedProducer);
	assert.equal(refusal.job.value.name, directProofErasureHostedRefusal.jobName);
	assert.equal(refusal.job.value.status, "completed");
	assert.equal(refusal.job.value.conclusion, "success");
	assert.ok(refusal.job.value.labels.includes("ubuntu-24.04"));
	assert.ok(refusalLog.includes(directProofErasureHostedRefusal.testName));
	const refusalSource = directProofErasureHostedOriginal(
		directProofErasureHostedProducer, "tests/elaborated-metadata.test.mjs"
	).toString();
	assert.ok(refusalSource.includes(directProofErasureHostedRefusal.testName));
	assert.ok(refusalSource.includes(directProofErasureHostedRefusal.diagnostic));
	for(const [name, item] of Object.entries(refusal))
		await putBytes(`hosted/api/refusal/${name}.json`, item.bytes);
	await putFile("hosted/refusal/job.log", join(refusalRoot, "job.log"));

	const selectedSources = directProofErasureHostedSources(revisions);
	for(const source of selectedSources)
		await putBytes(directProofErasureHostedSourcePath(source)
			, directProofErasureHostedOriginal(source.revision, source.path));
	const files = [...descriptors].sort(([left], [right]) =>
		left.localeCompare(right)).map(([path, descriptor]) => ({
		path, bytes: descriptor.bytes, sha256: descriptor.sha256
		}));
	const index = {
		schemaVersion: 1, kind: "direct-proof-erasure-hosted-matrix-v1"
		, producerCommit: directProofErasureHostedProducer
		, checkerCommit: archiveCommit, archiveCommit
		, hostedRunConclusion: firstRun.conclusion
		, matrix, closure: closure.counts, lanes
		, refusal: {
			runId: directProofErasureHostedCoreRunId
			, job: directProofErasureHostedRefusal.jobName
			, test: directProofErasureHostedRefusal.testName
			, diagnostic: directProofErasureHostedRefusal.diagnostic
		}
		, selectedSources, files
		, limitations: [
			"The ten hosted artifacts establish ordinary and independently reviewed installed proof-parameter erasure and proof-free public signatures for all seventeen supported consumer profiles."
			, "The retained audit supplies the 102 previously authenticated field and callback cells; this archive supplies 68 direct installed cells and the fresh Lean refusal supplies 34 proof-valued result cells."
			, "Every lane retains the complete original GitHub artifact ZIP, API identities, job log, selected TAP, report, receipt and verified bytes, plus exact producer, checker and archiver source closures."
			, "External runtimes, compilers, package managers, browsers, GitHub Actions and operating systems remain trusted recorded inputs. This archive establishes exactly the 204-cell closure ledger and no broader support claim."
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
		destination: directProofErasureHostedEvidenceDirectory
		, files: files.length + 1
		, bytes: files.reduce((sum, file) => sum + file.bytes
			, indexBytes.length)
		, ...revisions
		, lanes: lanes.map(lane => ({
			id: lane.id, artifact: lane.hostedRun.artifact
		}))
		, indexSha256: sha256(indexBytes)
	}));
}
finally
{ await transaction.dispose(); }
