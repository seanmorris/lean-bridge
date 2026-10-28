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
	checkedRecordValueIndexHostedDigest
	, extractCheckedRecordValueIndexHostedArtifact
	, splitCheckedRecordValueIndexHostedArtifact
} from "../tests/helpers/checked-record-value-index-hosted-archive.mjs";
import {
	assertDependentSignatureHostedLocalSources
	, assertDependentSignatureHostedSteps
	, dependentSignatureHostedEvidenceDirectory
	, dependentSignatureHostedInputs
	, dependentSignatureHostedLanes
	, dependentSignatureHostedOriginal
	, dependentSignatureHostedProducer
	, dependentSignatureHostedRunConclusions
	, dependentSignatureHostedSourcePath
	, dependentSignatureHostedSources
	, inspectDependentSignatureHostedArtifact
	, parseDependentSignatureHostedArchiveArgs
} from "../tests/helpers/dependent-signature-hosted-archive.mjs";
import {
	validateDependentSignatureHostedReports
} from "../tests/helpers/dependent-signature-hosted-evidence.mjs";

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
assert.deepEqual((await readdir(inputRoot)).sort()
	, dependentSignatureHostedLanes.map(lane => lane.id).sort());
for(const lane of dependentSignatureHostedLanes)
	assert.deepEqual((await readdir(join(inputRoot, lane.id))).sort(), [
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
const stagingRoot = await mkdtemp(join(
	tmpdir(), "lean-bridge-dependent-signature-hosted-staging-"));
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

const lanes = [];
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
			const reports = {};
			for(const path of lane.reportPaths)
			{
				reports[path] = await readFile(join(extracted.root, path));
				putBytes(`hosted/output/${lane.id}/${path}`, reports[path]);
			}
			const accepted = validateDependentSignatureHostedReports(
				lane, reports);
			await putFile(`hosted/${lane.id}/job.log`, selected["job-log"]);
			for(const [name, item] of Object.entries(hosted.api))
				putBytes(`hosted/api/${lane.id}/${name}.json`, item.bytes);
			const parts = await splitCheckedRecordValueIndexHostedArtifact(
				selected["artifact-zip"], partsRoot);
			for(const part of parts)
				await putFile(
					`hosted/${lane.id}/artifact.zip.parts/${part.name}`
					, part.path);
			lanes.push({
				id: lane.id, profiles: [...lane.profiles], accepted
				, hostedRun: {
					...hosted.hostedRun
					, apiRecords: Object.fromEntries(Object.entries(hosted.api).map(
						([name, item]) => [name, {
							bytes: item.bytes.length, sha256: item.sha256
						}]
					))
					, artifact: {
						...hosted.hostedRun.artifact
						, members: extracted.entries
						, parts: parts.map(({
							name, offset, bytes, sha256: value
						}) => ({
							path: `hosted/${lane.id}/artifact.zip.parts/${name}`
							, offset, bytes, sha256: value
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
	const selectedSources = dependentSignatureHostedSources(revisions);
	for(const source of selectedSources)
		putBytes(dependentSignatureHostedSourcePath(source)
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
		, runConclusions: dependentSignatureHostedRunConclusions
		, lanes, selectedSources, files
		, limitations: [
			"The retained runs establish all thirty-four direct dependent-signature cells: seventeen supported profiles across ordinary Lean source and independently reviewed Binding IR."
			, "Every installed package checks a concrete Fin value against the live earlier Nat argument before entering Lean, exercises rejected endpoints and huge values, preserves caller data, and recovers for later calls."
			, "The JavaScript-family lane uses two independent author builds, source-free offline npm installation, strict TypeScript, and page, React and worker execution in Chromium, Firefox and WebKit."
			, "The native, managed, dynamic-language, WIT/WASI and four Perl ABI lanes use reproducible source-free package handoffs and public host APIs. PHP-Wasm additionally covers twelve loading, packaging, realm and strictness arrangements."
			, "The archive retains each complete original GitHub artifact ZIP, API identities, job log, selected reports and exact producer, checker and archiver source closures. External toolchains, runners, browsers and operating-system packages remain trusted recorded inputs."
		]
	};

	await mkdir(dependentSignatureHostedEvidenceDirectory);
	for(const [path, descriptor] of descriptors)
	{
		const target = join(dependentSignatureHostedEvidenceDirectory, path);
		await mkdir(dirname(target), { recursive: true });
		if(descriptor.source) await copyFile(
			descriptor.source, target, constants.COPYFILE_FICLONE);
		else await writeFile(target, descriptor.value, { flag: "wx" });
		assert.equal((await stat(target)).size, descriptor.bytes, path);
		assert.equal(await checkedRecordValueIndexHostedDigest(target)
			, descriptor.sha256, path);
	}
	const indexBytes = Buffer.from(canonicalJson(index));
	await writeFile(join(dependentSignatureHostedEvidenceDirectory
		, "index.json"), indexBytes, { flag: "wx" });
	process.stdout.write(canonicalJson({
		destination: dependentSignatureHostedEvidenceDirectory
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
{ await rm(stagingRoot, { recursive: true }); }
