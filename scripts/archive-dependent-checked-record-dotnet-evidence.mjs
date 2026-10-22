#!/usr/bin/env node
/**
 * Freeze one successful hosted dependent checked-record .NET artifact. Every
 * retained record and destructive control is replayed before evidence bytes
 * are admitted, and the original GitHub artifact is preserved exactly.
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
	dependentCheckedRecordDotnetNegativeControls
} from "../tests/helpers/dependent-checked-record-dotnet-controls.mjs";
import {
	dependentCheckedRecordDotnetRoutes
} from "../tests/helpers/dependent-checked-record-dotnet-fixture.mjs";
import {
	dependentCheckedRecordDotnetEvidenceSources
	, dependentCheckedRecordHostedOriginal
} from "../tests/helpers/dependent-checked-record-hosted-evidence-sources.mjs";
import {
	dependentCheckedRecordHostedDigest
	, extractDependentCheckedRecordHostedArtifact
	, inspectDependentCheckedRecordHostedArtifact
	, parseDependentCheckedRecordHostedArchiveArgs
	, splitDependentCheckedRecordHostedArtifact
} from "../tests/helpers/dependent-checked-record-hosted-archive.mjs";

const usage = "Usage: archive-dependent-checked-record-dotnet-evidence.mjs --artifact-zip /absolute/artifact.zip --run-json /absolute/run.json --job-json /absolute/job.json --artifact-json /absolute/artifact.json";
let selected;
try
{
	selected = parseDependentCheckedRecordHostedArchiveArgs(
		process.argv.slice(2), usage);
}
catch(error)
{
	process.stderr.write(`${error.message}\n`); process.exit(2);
}

const evidence = "docs/evidence/dependent-checked-record-dotnet-20261021";
await assert.rejects(access(evidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const hosted = await inspectDependentCheckedRecordHostedArtifact(selected, {
	workflow: ".github/workflows/dependent-checked-record-dotnet.yml"
	, jobName: "Four dependent checked-record checked-record routes in .NET"
	, artifactPrefix: "dependent-checked-record-dotnet"
});
const revision = hosted.revision, revisions = {
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
		, sha256: await dependentCheckedRecordHostedDigest(source), source
	});
};

const extracted = await extractDependentCheckedRecordHostedArtifact(
	selected["artifact-zip"]);
const partsRoot = await mkdtemp(join(
	tmpdir(), "lean-bridge-dependent-dotnet-zip-"));
try
{
	assert.deepEqual((await readdir(extracted.root)).sort(), [
		"dependent-checked-record-dotnet-ci"
		, "dependent-checked-record-dotnet-toolchain.log"
	]);
	const hostedRoot = join(
		extracted.root, "dependent-checked-record-dotnet-ci");
	assert.deepEqual((await readdir(hostedRoot)).sort()
		, [...dependentCheckedRecordDotnetRoutes].sort());
	const runs = [];
	let runtime, toolchain, resourceCeiling;
	for(const route of dependentCheckedRecordDotnetRoutes)
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
		assert.equal(originals.get("report.json").toString()
			, canonicalJson(report), `${route} report`);
		const tap = await readFile(join(cell, "run.tap"));
		const controlled = await dependentCheckedRecordDotnetNegativeControls(
			originals, {
				route, producer: revision, consumer: revision
				, directory: recordsRoot, tap: join(cell, "run.tap")
				, glibc: "2.38", dotnet: report.tools.command
				, tapSource: tap.toString()
			}, report.tools.interpreter
		);
		const { accepted, ...controls } = controlled;
		const verification = await readFile(join(cell, "verification.json"));
		assert.equal(verification.toString()
			, canonicalJson({ ...accepted, controls })
			, `${route} checker replay`);
		runtime ??= report.runtime;
		toolchain ??= report.tools;
		resourceCeiling ??= report.resourceChecks[0].maxLoad;
		assert.deepEqual(report.runtime, runtime, `${route} runtime identity`);
		assert.deepEqual(report.tools, toolchain, `${route} toolchain identity`);
		assert.ok(report.resourceChecks.every(item =>
			item.maxLoad === resourceCeiling), `${route} load ceiling`);
		for(const path of paths)
			await putFile(`${route}/records/${path}`, join(recordsRoot, path));
		for(const name of ["run.tap", "verification.json"])
			await putFile(`${route}/${name}`, join(cell, name));
		runs.push({
			route, mode: accepted.mode, recordCount: paths.length
			, accepted, controls, tapSha256: sha256(tap)
			, verificationSha256: sha256(verification)
		});
	}
	await putFile("hosted/logs/toolchain.log", join(extracted.root
		, "dependent-checked-record-dotnet-toolchain.log"));
	for(const [name, item] of Object.entries(hosted.api))
		putBytes(`hosted/api/${name}.json`, item.bytes);
	const parts = await splitDependentCheckedRecordHostedArtifact(
		selected["artifact-zip"], partsRoot);
	for(const part of parts)
		await putFile(`hosted/artifact.zip.parts/${part.name}`, part.path);
	const selectedSources = dependentCheckedRecordDotnetEvidenceSources(
		revisions);
	for(const source of selectedSources)
		putBytes(`sources/${source.role}/${source.path}`
			, dependentCheckedRecordHostedOriginal(source.revision, source.path));
	const files = [...descriptors].sort(([left], [right]) => left.localeCompare(right))
		.map(([path, descriptor]) => ({
			path, bytes: descriptor.bytes, sha256: descriptor.sha256
		}));
	const index = {
		schemaVersion: 1
		, kind: "dependent-checked-record-dotnet-installed-v1"
		, producerCommit: revision, consumerCommit: revision
		, checkerCommit: revision, archiveCommit, runtime, toolchain
		, floor: "2.38", resourceCeiling
		, hostedRun: {
			...hosted.hostedRun
			, apiRecords: Object.fromEntries(
				Object.entries(hosted.api).map(([name, item]) => [
					name, { bytes: item.bytes.length, sha256: item.sha256 }
				])
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
			"The fixture carries a retained Nat bound beside a proof-erased Fin payload and rejects every observed below value that is not strictly less than its sibling bound."
			, "Ordinary Lean source and independently reviewed Binding IR are exercised through full and result-only NuGet APIs."
			, "The independent C# caller covers valid values, equality and zero-bound refusals, recovery, immutable inputs and a Nat wider than 128 bits."
			, "Each route reproduces a NuGet package twice, removes author roots, installs offline, replays after relocation and executes a source-free deployment."
			, "Complete packages, receipts, records, TAP, destructive controls, toolchain log, GitHub API records and a byte-exact split of the original artifact ZIP are retained."
			, "The native package floor is glibc 2.38; external .NET, Lean, compiler and operating-system distributions remain trusted recorded inputs."
			, "This lane establishes installed .NET acceptance only; aggregate support promotion and other hosts require separate evidence."
		]
	};
	await mkdir(evidence);
	for(const [path, descriptor] of descriptors)
	{
		const target = join(evidence, path);
		await mkdir(dirname(target), { recursive: true });
		if(descriptor.source)
			await copyFile(descriptor.source, target, constants.COPYFILE_FICLONE);
		else await writeFile(target, descriptor.value, { flag: "wx" });
		assert.equal((await stat(target)).size, descriptor.bytes, path);
		assert.equal(await dependentCheckedRecordHostedDigest(target)
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
