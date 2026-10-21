#!/usr/bin/env node
/**
 * Freeze one successful hosted zero-payload NuGet artifact exactly once.
 * Every route and destructive verifier control replays before retention.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, constants, copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat
	, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	zeroPayloadDotnetNegativeControls
} from "../tests/helpers/zero-payload-checked-record-dotnet-controls.mjs";
import {
	zeroPayloadDotnetRoutes, zeroPayloadDotnetSelection
} from "../tests/helpers/zero-payload-checked-record-dotnet-fixture.mjs";
import {
	zeroPayloadDotnetEvidenceSources, zeroPayloadHostedOriginal
} from "../tests/helpers/zero-payload-checked-record-hosted-evidence-sources.mjs";
import {
	extractZeroPayloadHostedArtifact, inspectZeroPayloadHostedArtifact
	, parseZeroPayloadHostedArchiveArgs, splitZeroPayloadHostedArtifact
	, zeroPayloadHostedDigest
} from "../tests/helpers/zero-payload-checked-record-hosted-archive.mjs";

const usage = "Usage: archive-zero-payload-checked-record-dotnet-evidence.mjs --artifact-zip /absolute/artifact.zip --run-json /absolute/run.json --job-json /absolute/job.json --artifact-json /absolute/artifact.json";
let selected;
try
{ selected = parseZeroPayloadHostedArchiveArgs(process.argv.slice(2), usage); }
catch(error)
{ process.stderr.write(`${error.message}\n`); process.exit(2); }

const evidence = "docs/evidence/zero-payload-checked-record-dotnet-20261021";
await assert.rejects(access(evidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const hosted = await inspectZeroPayloadHostedArtifact(selected, {
	workflow: ".github/workflows/zero-payload-checked-record-dotnet.yml"
	, jobName: "Four zero-payload checked-record routes in .NET"
	, artifactPrefix: "zero-payload-checked-record-dotnet"
});
const revision = hosted.revision;
const revisions = {
	producer: revision, consumer: revision, checker: revision
	, archiver: archiveCommit
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
	const information = await stat(source);
	assert.ok(information.isFile(), source);
	descriptors.set(path, {
		bytes: information.size
		, sha256: await zeroPayloadHostedDigest(source), source
	});
};

const extracted = await extractZeroPayloadHostedArtifact(
	selected["artifact-zip"]);
const partsRoot = await mkdtemp(join(
	tmpdir(), "lean-bridge-zero-payload-dotnet-zip-"));
try
{
	assert.deepEqual((await readdir(extracted.root)).sort(), [
		"zero-payload-checked-record-dotnet-ci"
		, "zero-payload-checked-record-dotnet-toolchain.log"
	]);
	const hostedRoot = join(
		extracted.root, "zero-payload-checked-record-dotnet-ci");
	assert.deepEqual((await readdir(hostedRoot)).sort()
		, [...zeroPayloadDotnetRoutes].sort());
	let runtime, tools, loadCeiling;
	const runs = [];
	for(const route of zeroPayloadDotnetRoutes)
	{
		const cell = join(hostedRoot, route);
		assert.deepEqual((await readdir(cell)).sort(), [
			"records", "run.tap", "verification.json"
		]);
		const recordsRoot = join(cell, "records", route);
		const paths = await nativeArtifactPaths(recordsRoot);
		const originals = new Map();
		for(const path of paths)
			originals.set(path, await readFile(join(recordsRoot, path)));
		const report = JSON.parse(originals.get("report.json"));
		runtime ??= report.runtime;
		tools ??= report.tools;
		assert.deepEqual(report.runtime, runtime, `${route} runtime identity`);
		assert.deepEqual(report.tools, tools, `${route} toolchain identity`);
		const ceilings = new Set(report.resourceChecks.map(item => item.maxLoad));
		assert.equal(ceilings.size, 1, `${route} load ceiling`);
		const routeCeiling = [...ceilings][0];
		loadCeiling ??= routeCeiling;
		assert.equal(routeCeiling, loadCeiling, `${route} shared load ceiling`);
		const tap = await readFile(join(cell, "run.tap"));
		const options = {
			route, producer: revision, consumer: revision
			, directory: recordsRoot, tap: join(cell, "run.tap")
			, glibc: "2.38", dotnet: report.tools.command, tapSource: tap
		};
		const controlled = await zeroPayloadDotnetNegativeControls(
			originals, options, report.tools.interpreter
		);
		const { accepted, ...controls } = controlled;
		const verification = await readFile(join(cell, "verification.json"));
		assert.equal(verification.toString(), canonicalJson({
			...accepted, controls
		}), `${route} hosted checker output`);
		for(const path of paths)
			await putFile(`${route}/records/${path}`, join(recordsRoot, path));
		for(const name of ["run.tap", "verification.json"])
			await putFile(`${route}/${name}`, join(cell, name));
		const selection = zeroPayloadDotnetSelection(route);
		runs.push({
			route, reviewed: selection.reviewed
			, resultOnly: selection.resultOnly, recordCount: paths.length
			, accepted, controls, tapSha256: sha256(tap)
			, verificationSha256: sha256(verification)
		});
	}
	await putFile("hosted/logs/toolchain.log", join(extracted.root
		, "zero-payload-checked-record-dotnet-toolchain.log"));
	for(const [name, item] of Object.entries(hosted.api))
		putBytes(`hosted/api/${name}.json`, item.bytes);
	const parts = await splitZeroPayloadHostedArtifact(
		selected["artifact-zip"], partsRoot);
	for(const part of parts)
		await putFile(`hosted/artifact.zip.parts/${part.name}`, part.path);
	const selectedSources = zeroPayloadDotnetEvidenceSources(revisions);
	for(const source of selectedSources)
	{
		const original = zeroPayloadHostedOriginal(source.revision, source.path);
		if(source.role === "checker")
			assert.deepEqual(await readFile(source.path), original
				, `Current checker differs from hosted checker: ${source.path}`);
		putBytes(`sources/${source.role}/${source.path}`, original);
	}
	const files = [...descriptors].sort(([left], [right]) =>
		left.localeCompare(right)).map(([path, descriptor]) => ({
		path, bytes: descriptor.bytes, sha256: descriptor.sha256
		}));
	const index = {
		schemaVersion: 1
		, kind: "zero-payload-checked-record-dotnet-installed-v1"
		, producerCommit: revision, consumerCommit: revision
		, checkerCommit: revision, archiveCommit, runtime, tools
		, floor: "2.38", loadCeiling
		, hostedRun: {
			...hosted.hostedRun
			, apiRecords: Object.fromEntries(
				Object.entries(hosted.api).map(([name, item]) => [name, {
					bytes: item.bytes.length, sha256: item.sha256
				}])
			)
			, artifact: {
				...hosted.hostedRun.artifact, members: extracted.entries
				, parts: parts.map(({
					name, offset, bytes, sha256: digest
				}) => ({
					path: `hosted/artifact.zip.parts/${name}`
					, offset, bytes, sha256: digest
				}))
			}
		}
		, runs, selectedSources, files
		, limitations: [
			"The fixture distinguishes a proof-erased empty Witness, a Unit-bearing Token, a plain empty Marker, Option values, arrays, and active and inactive variant branches."
			, "Ordinary Lean source and independently reviewed Binding IR are exercised through full and result-only NuGet APIs built from two independent author roots."
			, "A source-free C# caller installs offline, executes, relocates unchanged and replays while rejecting null and malformed nested checked-record values."
			, "Complete NuGet archives, receipts, reports, TAP, destructive controls, GitHub API records, workflow logs and a byte-exact split of the original artifact ZIP are retained."
			, "The package floor is glibc 2.38; external Lean, C/C++ compiler, .NET SDK, NuGet, glibc and operating-system distributions remain trusted inputs represented by recorded identities rather than copied toolchains."
			, "This lane establishes installed .NET acceptance only; aggregate support promotion and other zero-payload hosts require separate evidence."
		]
	};

	await mkdir(evidence);
	for(const [path, descriptor] of descriptors)
	{
		const target = join(evidence, path);
		await mkdir(dirname(target), { recursive: true });
		if(descriptor.source) await copyFile(
			descriptor.source, target, constants.COPYFILE_FICLONE);
		else await writeFile(target, descriptor.value, { flag: "wx" });
		assert.equal((await stat(target)).size, descriptor.bytes, path);
		assert.equal(await zeroPayloadHostedDigest(target)
			, descriptor.sha256, path);
	}
	const indexBytes = Buffer.from(canonicalJson(index));
	await writeFile(join(evidence, "index.json"), indexBytes, { flag: "wx" });
	process.stdout.write(canonicalJson({
		destination: evidence, files: files.length + 1
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
