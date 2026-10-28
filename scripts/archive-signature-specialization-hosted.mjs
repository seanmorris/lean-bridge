#!/usr/bin/env node
/**
 * Freeze and independently replay the ten successful installed-specialization
 * hosted artifacts.
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
	assertSignatureSpecializationHostedLocalSources
	, assertSignatureSpecializationHostedSteps
	, inspectSignatureSpecializationHostedArtifact
	, parseSignatureSpecializationHostedArchiveArgs
	, signatureSpecializationHostedEvidenceDirectory
	, signatureSpecializationHostedInputs
	, signatureSpecializationHostedLanes
	, signatureSpecializationHostedOriginal
	, signatureSpecializationHostedProducer
	, signatureSpecializationHostedSources
} from "../tests/helpers/signature-specialization-hosted-archive.mjs";
import {
	validateSignatureSpecializationHostedReport
} from "../tests/helpers/signature-specialization-hosted-evidence.mjs";

let inputRoot;
try
{
	inputRoot = parseSignatureSpecializationHostedArchiveArgs(
		process.argv.slice(2));
}
catch(error)
{
	process.stderr.write(`${error.message}\n`); process.exit(2);
}
assert.equal(await realpath(inputRoot), inputRoot
	, "Hosted input root must be canonical");
assert.deepEqual((await readdir(inputRoot)).sort()
	, signatureSpecializationHostedLanes.map(lane => lane.id).sort());
for(const lane of signatureSpecializationHostedLanes)
	assert.deepEqual((await readdir(join(inputRoot, lane.id))).sort(), [
		"artifact.json", "artifact.zip", "job.json", "job.log", "run.json"
	]);
await assert.rejects(access(signatureSpecializationHostedEvidenceDirectory)
	, { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const revisions = {
	producer: signatureSpecializationHostedProducer
	, checker: archiveCommit, archiver: archiveCommit
};
await assertSignatureSpecializationHostedLocalSources(revisions);

const descriptors = new Map();
const stagingRoot = await mkdtemp(join(
	tmpdir(), "lean-bridge-signature-specialization-hosted-staging-"));
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
	for(const lane of signatureSpecializationHostedLanes)
	{
		const selected = signatureSpecializationHostedInputs(inputRoot, lane);
		const hosted = await inspectSignatureSpecializationHostedArtifact(
			selected, lane);
		assert.equal(hosted.revision, signatureSpecializationHostedProducer);
		assertSignatureSpecializationHostedSteps(lane, hosted.api.job.bytes);
		const extracted = await extractCheckedRecordValueIndexHostedArtifact(
			selected["artifact-zip"]);
		const partsRoot = await mkdtemp(join(
			tmpdir(), `lean-bridge-signature-${lane.id}-zip-`));
		try
		{
			const report = await readFile(join(extracted.root, lane.reportPath));
			const tap = lane.tapPath
				? await readFile(join(extracted.root, lane.tapPath)) : null;
			const accepted = validateSignatureSpecializationHostedReport(
				lane, report, tap);
			putBytes(`hosted/output/${lane.id}/${lane.reportPath}`, report);
			if(lane.tapPath)
				putBytes(`hosted/output/${lane.id}/${lane.tapPath}`, tap);
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
	const selectedSources = signatureSpecializationHostedSources(revisions);
	for(const source of selectedSources)
		putBytes(`sources/${source.role}/${source.path}`
			, signatureSpecializationHostedOriginal(source.revision, source.path));
	const files = [...descriptors].sort(([left], [right]) =>
		left.localeCompare(right)).map(([path, descriptor]) => ({
		path, bytes: descriptor.bytes, sha256: descriptor.sha256
		}));
	const index = {
		schemaVersion: 1, kind: "signature-specializations-hosted-installed-v1"
		, producerCommit: signatureSpecializationHostedProducer
		, checkerCommit: archiveCommit, archiveCommit
		, lanes, selectedSources, files
		, limitations: [
			"The eight native lanes establish the reviewed generic, implicit and instance signatures in the selected installed Python, Ruby, Rust, .NET, Java, Kotlin, native PHP, WIT/WASI and Perl packages."
			, "The browser lane establishes the ordinary instance signature in pages, React and dedicated workers and all three reviewed signature forms in those realms across Chromium, Firefox and WebKit."
			, "The PHP-Wasm lane establishes all three ordinary and all three reviewed signature forms in twelve Node and Chromium installation/loading/caller arrangements for each author route."
			, "Every lane retains the complete original GitHub artifact ZIP, API identities, job log, selected report and TAP bytes where present, and exact producer, checker and archiver source closures."
			, "External runtimes, browsers, compilers, package managers and operating-system distributions remain trusted recorded inputs. This archive establishes exactly the forty-five installed signature cells and no other support claim."
		]
	};

	await mkdir(signatureSpecializationHostedEvidenceDirectory);
	for(const [path, descriptor] of descriptors)
	{
		const target = join(signatureSpecializationHostedEvidenceDirectory, path);
		await mkdir(dirname(target), { recursive: true });
		if(descriptor.source) await copyFile(
			descriptor.source, target, constants.COPYFILE_FICLONE);
		else await writeFile(target, descriptor.value, { flag: "wx" });
		assert.equal((await stat(target)).size, descriptor.bytes, path);
		assert.equal(await checkedRecordValueIndexHostedDigest(target)
			, descriptor.sha256, path);
	}
	const indexBytes = Buffer.from(canonicalJson(index));
	await writeFile(join(signatureSpecializationHostedEvidenceDirectory
		, "index.json"), indexBytes, { flag: "wx" });
	process.stdout.write(canonicalJson({
		destination: signatureSpecializationHostedEvidenceDirectory
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
