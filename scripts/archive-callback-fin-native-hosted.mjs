#!/usr/bin/env node
/**
 * Freeze the successful hosted Python/Ruby/Rust and Perl callback-Fin
 * artifacts after independently replaying their reports and package sets.
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
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	checkedRecordValueIndexHostedDigest
	, extractCheckedRecordValueIndexHostedArtifact
	, splitCheckedRecordValueIndexHostedArtifact
} from "../tests/helpers/checked-record-value-index-hosted-archive.mjs";
import {
	assertCallbackFinNativeHostedChecker
	, callbackFinNativeHostedEvidenceDirectory
	, callbackFinNativeHostedInputs
	, callbackFinNativeHostedLanes
	, callbackFinNativeHostedOriginal
	, callbackFinNativeHostedSources
	, inspectCallbackFinNativeHostedArtifact
	, parseCallbackFinNativeHostedArchiveArgs
} from "../tests/helpers/callback-fin-native-hosted-archive.mjs";
import {
	callbackFinLanguageVerification
} from "../tests/helpers/callback-fin-language-ci.mjs";
import {
	callbackFinPerlVerification
} from "../tests/helpers/callback-fin-perl-ci.mjs";
import {
	callbackFinRetainedPackagesName, verifyCallbackFinRetainedPackages
} from "../tests/helpers/callback-fin-retained-packages.mjs";

let inputRoot;
try
{
	inputRoot = parseCallbackFinNativeHostedArchiveArgs(process.argv.slice(2));
}
catch(error)
{
	process.stderr.write(`${error.message}\n`); process.exit(2);
}
assert.equal(await realpath(inputRoot), inputRoot
	, "Hosted input root must be canonical");
assert.deepEqual((await readdir(inputRoot)).sort()
	, callbackFinNativeHostedLanes.map(lane => lane.id).sort());
for(const lane of callbackFinNativeHostedLanes)
	assert.deepEqual((await readdir(join(inputRoot, lane.id))).sort(), [
		"artifact.json", "artifact.zip", "job.json", "job.log", "run.json"
	]);
await assert.rejects(access(callbackFinNativeHostedEvidenceDirectory)
	, { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);

const descriptors = new Map();
const stagingRoot = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-fin-native-hosted-staging-"));
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

let revision;
const lanes = [];
for(const lane of callbackFinNativeHostedLanes)
{
	const selected = callbackFinNativeHostedInputs(inputRoot, lane);
	const hosted = await inspectCallbackFinNativeHostedArtifact(selected, lane);
	revision ??= hosted.revision;
	assert.equal(hosted.revision, revision, `${lane.id} revision drift`);
	const extracted = await extractCheckedRecordValueIndexHostedArtifact(
		selected["artifact-zip"]);
	const partsRoot = await mkdtemp(join(
		tmpdir(), `lean-bridge-callback-fin-${lane.id}-zip-`));
	try
	{
		const required = [
			"acceptance.tap", "evidence", "report.json"
			, callbackFinRetainedPackagesName, "verification.json"
		];
		assert.deepEqual((await readdir(extracted.root)).sort()
			, (lane.outputRoot
				? [lane.outputRoot, ...lane.logs] : required).sort());
		const outputRoot = lane.outputRoot
			? join(extracted.root, lane.outputRoot) : extracted.root;
		assert.deepEqual((await readdir(outputRoot)).sort(), required.sort());
		const tap = await readFile(join(outputRoot, "acceptance.tap"), "utf8");
		const report = JSON.parse(await readFile(
			join(outputRoot, "report.json"), "utf8"));
		const base = lane.id === "languages"
			? callbackFinLanguageVerification(revision, tap, report)
			: callbackFinPerlVerification(revision, tap, report);
		const accepted = {
			...base
			, retainedPackages: await verifyCallbackFinRetainedPackages(
				outputRoot, report)
		};
		assert.equal(await readFile(join(outputRoot, "verification.json"), "utf8")
			, canonicalJson(accepted), `${lane.id} hosted checker output`);
		for(const path of await nativeArtifactPaths(extracted.root))
			await putFile(`hosted/output/${lane.id}/${path}`
				, join(extracted.root, path));
		await putFile(`hosted/${lane.id}/job.log`
			, join(inputRoot, lane.id, "job.log"));
		for(const [name, item] of Object.entries(hosted.api))
			putBytes(`hosted/api/${lane.id}/${name}.json`, item.bytes);
		const parts = await splitCheckedRecordValueIndexHostedArtifact(
			selected["artifact-zip"], partsRoot);
		for(const part of parts)
			await putFile(`hosted/${lane.id}/artifact.zip.parts/${part.name}`
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
const revisions = {
	producer: revision, checker: revision, archiver: archiveCommit
};
await assertCallbackFinNativeHostedChecker(revision);
const selectedSources = callbackFinNativeHostedSources(revisions);
for(const source of selectedSources)
	putBytes(`sources/${source.role}/${source.path}`
		, callbackFinNativeHostedOriginal(source.revision, source.path));
const files = [...descriptors].sort(([left], [right]) =>
	left.localeCompare(right)).map(([path, descriptor]) => ({
	path, bytes: descriptor.bytes, sha256: descriptor.sha256
	}));
const index = {
	schemaVersion: 1, kind: "callback-fin-native-hosts-installed-v1"
	, producerCommit: revision, checkerCommit: revision, archiveCommit
	, lanes, selectedSources, files
	, limitations: [
		"The hosted language lane covers ordinary-source and independently reviewed Fin callback parameters and results in Python, Ruby and Rust installed packages."
		, "The hosted Perl lane covers both source routes through prebuilt-only and build-XS installation on all four pinned Perl ABI configurations."
		, "Each lane retains receipt-closed package archives for both routes, source-free offline installation observations, the original GitHub artifact ZIP and API identities, complete job logs, TAP, checker output and selected exact source snapshots."
		, "This evidence establishes exactly the sixteen remaining Python, Ruby, Rust and Perl callback-Fin cells. It does not add browser, copied-field, managed-host, WIT/WASI, Subtype or asynchronous callback claims."
		, "The retained selected sources are not a complete transitive source or toolchain closure. External runtimes, compilers, package managers and operating-system distributions remain trusted recorded inputs."
	]
};

await mkdir(callbackFinNativeHostedEvidenceDirectory);
for(const [path, descriptor] of descriptors)
{
	const target = join(callbackFinNativeHostedEvidenceDirectory, path);
	await mkdir(dirname(target), { recursive: true });
	if(descriptor.source) await copyFile(
		descriptor.source, target, constants.COPYFILE_FICLONE);
	else await writeFile(target, descriptor.value, { flag: "wx" });
	assert.equal((await stat(target)).size, descriptor.bytes, path);
	assert.equal(await checkedRecordValueIndexHostedDigest(target)
		, descriptor.sha256, path);
}
const indexBytes = Buffer.from(canonicalJson(index));
await writeFile(join(callbackFinNativeHostedEvidenceDirectory
	, "index.json"), indexBytes, { flag: "wx" });
await rm(stagingRoot, { recursive: true });
process.stdout.write(canonicalJson({
	destination: callbackFinNativeHostedEvidenceDirectory
	, files: files.length + 1
	, bytes: files.reduce((sum, file) => sum + file.bytes
		, indexBytes.length)
	, ...revisions
	, lanes: lanes.map(lane => ({
		id: lane.id, artifact: lane.hostedRun.artifact
	}))
	, indexSha256: sha256(indexBytes)
}));
