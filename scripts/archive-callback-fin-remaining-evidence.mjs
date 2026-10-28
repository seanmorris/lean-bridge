#!/usr/bin/env node
/**
 * Freeze all four successful managed/WIT callback-Fin matrix artifacts after
 * independently replaying their reports and receipt-closed package sets.
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
	assertCallbackFinRemainingHostedChecker
	, callbackFinRemainingHostedEvidenceDirectory
	, callbackFinRemainingHostedLaneInputs
	, callbackFinRemainingHostedLanes
	, callbackFinRemainingHostedOriginal
	, callbackFinRemainingHostedSources
	, inspectCallbackFinRemainingHostedArtifact
	, parseCallbackFinRemainingHostedArchiveArgs
} from "../tests/helpers/callback-fin-remaining-hosted-archive.mjs";
import {
	callbackFinRemainingVerification
} from "../tests/helpers/callback-fin-remaining-ci.mjs";
import {
	verifyCallbackFinRetainedPackages
} from "../tests/helpers/callback-fin-retained-packages.mjs";

let inputRoot;
try
{
	inputRoot = parseCallbackFinRemainingHostedArchiveArgs(
		process.argv.slice(2));
}
catch(error)
{
	process.stderr.write(`${error.message}\n`); process.exit(2);
}
assert.equal(await realpath(inputRoot), inputRoot
	, "Hosted input root must be canonical");
assert.deepEqual((await readdir(inputRoot)).sort(), [
	...callbackFinRemainingHostedLanes.map(lane => lane.id), "run.json"
].sort());
await assert.rejects(access(callbackFinRemainingHostedEvidenceDirectory)
	, { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);

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
	const information = await stat(source);
	assert.ok(information.isFile(), source);
	descriptors.set(path, {
		bytes: information.size
		, sha256: await checkedRecordValueIndexHostedDigest(source), source
	});
};

let revision, commonRun;
const lanes = [];
for(const lane of callbackFinRemainingHostedLanes)
{
	const selected = callbackFinRemainingHostedLaneInputs(inputRoot, lane);
	const hosted = await inspectCallbackFinRemainingHostedArtifact(
		selected, lane);
	revision ??= hosted.revision;
	assert.equal(hosted.revision, revision, `${lane.id} revision drift`);
	commonRun ??= hosted.api.run.bytes;
	assert.deepEqual(hosted.api.run.bytes, commonRun, `${lane.id} run drift`);
	const extracted = await extractCheckedRecordValueIndexHostedArtifact(
		selected["artifact-zip"]);
	const partsRoot = await mkdtemp(join(
		tmpdir(), `lean-bridge-callback-fin-${lane.id}-zip-`));
	try
	{
		const recordsName = `callback-fin-remaining-ci-${lane.id}`;
		const logName = `callback-fin-remaining-${lane.id}-toolchain.log`;
		assert.deepEqual((await readdir(extracted.root)).sort()
			, [recordsName, logName].sort());
		const recordsRoot = join(extracted.root, recordsName);
		assert.deepEqual((await readdir(recordsRoot)).sort(), [
			"acceptance.tap", "evidence", "report.json"
			, "retained-packages.json", "verification.json"
		]);
		const tap = await readFile(join(recordsRoot, "acceptance.tap"), "utf8");
		const report = JSON.parse(await readFile(
			join(recordsRoot, "report.json"), "utf8"));
		const checked = {
			...callbackFinRemainingVerification(
				revision, lane.profiles, tap, report)
			, retainedPackages: await verifyCallbackFinRetainedPackages(
				recordsRoot, report)
		};
		const verification = await readFile(join(
			recordsRoot, "verification.json"));
		assert.equal(verification.toString(), canonicalJson(checked)
			, `${lane.id} hosted checker output`);
		for(const name of [
			"acceptance.tap", "report.json", "retained-packages.json"
			, "verification.json"
		]) await putFile(`observations/${lane.id}/${name}`
			, join(recordsRoot, name));
		await putFile(`hosted/${lane.id}/toolchain.log`
			, join(extracted.root, logName));
		putBytes(`hosted/api/${lane.id}/job.json`, hosted.api.job.bytes);
		putBytes(`hosted/api/${lane.id}/artifact.json`
			, hosted.api.artifact.bytes);
		const parts = await splitCheckedRecordValueIndexHostedArtifact(
			selected["artifact-zip"], partsRoot);
		for(const part of parts)
			await putFile(`hosted/${lane.id}/artifact.zip.parts/${part.name}`
				, part.path);
		lanes.push({
			id: lane.id, profiles: [...lane.profiles], accepted: checked
			, hostedRun: {
				...hosted.hostedRun
				, apiRecords: {
					run: {
						bytes: hosted.api.run.bytes.length
						, sha256: hosted.api.run.sha256
					}
					, job: {
						bytes: hosted.api.job.bytes.length
						, sha256: hosted.api.job.sha256
					}
					, artifact: {
						bytes: hosted.api.artifact.bytes.length
						, sha256: hosted.api.artifact.sha256
					}
				}
				, artifact: {
					...hosted.hostedRun.artifact, members: extracted.entries
					, parts: parts.map(({
						name, offset, bytes, sha256: digest
					}) => ({
						path: `hosted/${lane.id}/artifact.zip.parts/${name}`
						, offset, bytes, sha256: digest
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
putBytes("hosted/api/run.json", commonRun);
const revisions = {
	producer: revision, checker: revision, archiver: archiveCommit
};
await assertCallbackFinRemainingHostedChecker(revision);
const selectedSources = callbackFinRemainingHostedSources(revisions);
for(const source of selectedSources)
	putBytes(`sources/${source.role}/${source.path}`
		, callbackFinRemainingHostedOriginal(source.revision, source.path));
const files = [];
for(const [path, descriptor] of [...descriptors].sort(
	([left], [right]) => left.localeCompare(right)
)) files.push({ path, bytes: descriptor.bytes, sha256: descriptor.sha256 });
const index = {
	schemaVersion: 1, kind: "callback-fin-remaining-installed-v1"
	, producerCommit: revision, checkerCommit: revision, archiveCommit
	, lanes, selectedSources, files
	, limitations: [
		"The four hosted lanes cover ordinary-source and independently reviewed Fin callback parameters and results in .NET, Java, Kotlin, native PHP and WIT/WASI installed packages."
		, "Each lane retains receipt-closed package archives for both routes, performs source-free offline installation, and repeats execution where the host adapter supports a repeat contract."
		, "The original GitHub artifact ZIPs, API identities, toolchain logs, reports, TAP, checker output and exact selected source snapshots are retained."
		, "This evidence does not add Perl, Python, Ruby, Rust, browser, copied-field, Subtype or unmeasured dispatch claims."
		, "External host runtimes, compiler toolchains, package managers and operating-system distributions remain trusted inputs represented by recorded identities rather than copied installations."
	]
};

await mkdir(callbackFinRemainingHostedEvidenceDirectory);
for(const [path, descriptor] of descriptors)
{
	const target = join(callbackFinRemainingHostedEvidenceDirectory, path);
	await mkdir(dirname(target), { recursive: true });
	if(descriptor.source) await copyFile(
		descriptor.source, target, constants.COPYFILE_FICLONE);
	else await writeFile(target, descriptor.value, { flag: "wx" });
	assert.equal((await stat(target)).size, descriptor.bytes, path);
	assert.equal(await checkedRecordValueIndexHostedDigest(target)
		, descriptor.sha256, path);
}
const indexBytes = Buffer.from(canonicalJson(index));
await writeFile(join(callbackFinRemainingHostedEvidenceDirectory
	, "index.json"), indexBytes, { flag: "wx" });
process.stdout.write(canonicalJson({
	destination: callbackFinRemainingHostedEvidenceDirectory
	, files: files.length + 1
	, bytes: files.reduce((sum, file) => sum + file.bytes
		, indexBytes.length)
	, ...revisions
	, lanes: lanes.map(lane => ({
		id: lane.id, artifact: lane.hostedRun.artifact
	}))
	, indexSha256: sha256(indexBytes)
}));
