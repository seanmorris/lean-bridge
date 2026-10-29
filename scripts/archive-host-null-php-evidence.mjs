#!/usr/bin/env node
/**
 * Freeze one successful hosted PHP HostNull artifact with its original ZIP,
 * API provenance, complete package handoffs and selected source closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, constants, copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertHostNullPhpReport } from "../tests/helpers/host-null-php-report.mjs";
import {
	hostNullPhpHostedEvidenceSources, hostNullPhpHostedOriginal
} from "../tests/helpers/host-null-php-hosted-evidence-sources.mjs";
import {
	hostNullPhpHostedPolicy
} from "../tests/helpers/host-null-php-hosted-policy.mjs";
import {
	checkedRecordValueIndexHostedDigest as digestFile
	, extractCheckedRecordValueIndexHostedArtifact as extractArtifact
	, inspectCheckedRecordValueIndexHostedArtifact as inspectArtifact
	, parseCheckedRecordValueIndexHostedArchiveArgs as parseArgs
	, splitCheckedRecordValueIndexHostedArtifact as splitArtifact
} from "../tests/helpers/checked-record-value-index-hosted-archive.mjs";

const profileIndex = process.argv.indexOf("--profile");
const profile = profileIndex < 0 ? undefined : process.argv[profileIndex + 1];
const remaining = process.argv.slice(2).filter((_, index, values) =>
	values[index - 1] !== "--profile" && values[index] !== "--profile");
const usage = "Usage: archive-host-null-php-evidence.mjs --profile <php-native|php-wasm> --artifact-zip /absolute/artifact.zip --run-json /absolute/run.json --job-json /absolute/job.json --artifact-json /absolute/artifact.json";
let selected, policy;
try
{
	policy = hostNullPhpHostedPolicy(profile);
	selected = parseArgs(remaining, usage);
}
catch(error)
{ process.stderr.write(`${error.message}\n`); process.exit(2); }

await assert.rejects(access(policy.evidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
const runApi = JSON.parse(await readFile(selected["run-json"]));
assert.ok(["failure", "success"].includes(runApi.conclusion));
const conclusions = { run: runApi.conclusion, job: "success" };
const hosted = await inspectArtifact(selected, {
	workflow: ".github/workflows/consumer-matrix.yml"
	, jobName: policy.jobName, artifactPrefix: policy.artifactPrefix
	, conclusions
});
const revisions = {
	producer: hosted.revision, consumer: hosted.revision
	, checker: archiveCommit, archiver: archiveCommit
};
const descriptors = new Map();
const putBytes = (path, value) => {
	assert.ok(!descriptors.has(path), path);
	const bytes = Buffer.from(value);
	descriptors.set(path, {
		bytes: bytes.length, sha256: sha256(bytes), value: bytes
	});
};
const putFile = async (path, source) => {
	assert.ok(!descriptors.has(path), path);
	const information = await stat(source); assert.ok(information.isFile());
	descriptors.set(path, {
		bytes: information.size, sha256: await digestFile(source), source
	});
};

const extracted = await extractArtifact(selected["artifact-zip"]);
const partsRoot = await mkdtemp(join(tmpdir(), "lean-host-null-php-zip-"));
try
{
	const reportBytes = await readFile(join(extracted.root, policy.reportPath));
	const report = JSON.parse(reportBytes);
	assert.equal(reportBytes.toString(), canonicalJson(report), policy.reportPath);
	const accepted = await assertHostNullPhpReport(report, profile
		, join(extracted.root, policy.packagesPath));
	for(const path of extracted.entries.filter(path => !path.endsWith("/")))
	{
		assert.ok(path === policy.reportPath
			|| path.startsWith(`${policy.packagesPath}/`), path);
		await putFile(`artifact/${path}`, join(extracted.root, path));
	}
	for(const [name, item] of Object.entries(hosted.api))
		putBytes(`hosted/api/${name}.json`, item.bytes);
	const parts = await splitArtifact(selected["artifact-zip"], partsRoot);
	for(const part of parts)
		await putFile(`hosted/artifact.zip.parts/${part.name}`, part.path);
	const selectedSources = hostNullPhpHostedEvidenceSources(
		profile, revisions);
	for(const source of selectedSources)
		putBytes(`sources/${source.role}/${source.path}`
			, hostNullPhpHostedOriginal(source.revision, source.path));
	const files = [...descriptors].sort(([left], [right]) =>
		left.localeCompare(right)).map(([path, descriptor]) => ({
		path, bytes: descriptor.bytes, sha256: descriptor.sha256
		}));
	const index = {
		schemaVersion: 1, kind: policy.kind, profile
		, producerCommit: revisions.producer
		, consumerCommit: revisions.consumer
		, checkerCommit: revisions.checker, archiveCommit
		, accepted, selectedSources, files
		, hostedRun: {
			...hosted.hostedRun
			, apiRecords: Object.fromEntries(
				Object.entries(hosted.api).map(([name, item]) => [
					name, { bytes: item.bytes.length, sha256: item.sha256 }
				])
			)
			, artifact: {
				...hosted.hostedRun.artifact, members: extracted.entries
				, parts: parts.map(part => ({
					path: `hosted/artifact.zip.parts/${part.name}`
					, offset: part.offset, bytes: part.bytes, sha256: part.sha256
				}))
			}
		}
		, limitations: policy.limitations
	};
	await mkdir(policy.evidence);
	for(const [path, descriptor] of descriptors)
	{
		const target = join(policy.evidence, path);
		await mkdir(dirname(target), { recursive: true });
		if(descriptor.source) await copyFile(
			descriptor.source, target, constants.COPYFILE_FICLONE);
		else await writeFile(target, descriptor.value, { flag: "wx" });
		assert.equal((await stat(target)).size, descriptor.bytes, path);
		assert.equal(await digestFile(target), descriptor.sha256, path);
	}
	const indexBytes = Buffer.from(canonicalJson(index));
	await writeFile(join(policy.evidence, "index.json")
		, indexBytes, { flag: "wx" });
	process.stdout.write(canonicalJson({
		destination: policy.evidence, files: files.length + 1
		, bytes: files.reduce((sum, file) => sum + file.bytes
			, indexBytes.length)
		, ...revisions
		, hostedRun: index.hostedRun
		, indexSha256: sha256(indexBytes)
	}));
}
finally
{
	await rm(extracted.root, { recursive: true });
	await rm(partsRoot, { recursive: true });
}
