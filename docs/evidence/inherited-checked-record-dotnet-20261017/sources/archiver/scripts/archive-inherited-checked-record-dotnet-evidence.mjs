#!/usr/bin/env node
/**
 * Freeze one successful hosted inherited checked-record .NET artifact.
 * The archive is written only after every original selection and control replays.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, mkdir, readFile, readdir, realpath, writeFile
} from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import {
	inspectInheritedCheckedRecordDotnetCiHandoff
} from "../tests/helpers/inherited-checked-record-dotnet-ci-handoff.mjs";
import {
	assertInheritedCheckedRecordDotnetCiTap
	, checkInheritedCheckedRecordDotnetCiRecords
} from "../tests/helpers/inherited-checked-record-dotnet-ci-report.mjs";
import {
	checkInheritedCheckedRecordDotnetControls
} from "../tests/helpers/inherited-checked-record-dotnet-controls.mjs";
import {
	inheritedCheckedRecordDotnetEvidenceOriginal
	, inheritedCheckedRecordDotnetEvidenceSources
} from "../tests/helpers/inherited-checked-record-dotnet-evidence-sources.mjs";
import {
	inheritedCheckedRecordDotnetEvidenceFloor
	, inheritedCheckedRecordDotnetEvidenceLoadCeiling
	, inheritedCheckedRecordDotnetSelections
} from "../tests/helpers/inherited-checked-record-dotnet-provenance.mjs";
import {
	inheritedCheckedRecordDotnetRecords
} from "../tests/helpers/inherited-checked-record-dotnet-report.mjs";

const usage = "Usage: archive-inherited-checked-record-dotnet-evidence.mjs --root /absolute/artifact/root --producer <commit> --checker <commit> --run-id <digits> --artifact-id <digits> --artifact-name <name> --artifact-bytes <digits>";
const allowed = [
	"root", "producer", "checker", "run-id"
	, "artifact-id", "artifact-name", "artifact-bytes"
];
const parse = args => {
	assert.equal(args.length, allowed.length * 2, usage);
	const selected = {};
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(flag.startsWith("--") && allowed.includes(flag.slice(2))
			, usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && value
			&& !value.startsWith("--") && !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.ok(isAbsolute(selected.root), usage);
	for(const key of ["producer", "checker"])
		assert.match(selected[key], /^[a-f0-9]{40}$/u, usage);
	for(const key of ["run-id", "artifact-id", "artifact-bytes"])
		assert.match(selected[key], /^[1-9][0-9]*$/u, usage);
	assert.equal(selected["artifact-name"]
		, `inherited-checked-record-dotnet-${selected.producer}`, usage);
	return selected;
};

let selected;
try
{ selected = parse(process.argv.slice(2)); }
catch(error)
{ process.stderr.write(`${error.message}\n`); process.exit(2); }

const evidence = "docs/evidence/inherited-checked-record-dotnet-20261017";
await assert.rejects(access(evidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
const revisions = {
	producer: selected.producer, checker: selected.checker
	, archiver: archiveCommit
};
assert.equal(await realpath(selected.root), selected.root);
const labels = inheritedCheckedRecordDotnetSelections.map(
	([route, mode]) => `${route}-${mode}`);
assert.deepEqual((await readdir(selected.root)).sort(), labels.sort());
const files = new Map();
const put = (path, bytes) => {
	assert.ok(!files.has(path), path); files.set(path, Buffer.from(bytes));
};
const handoff = Object.freeze([
	"handoff/package-set-receipt.json"
	, "handoff/package-set-receipt.json.sha256"
	, "handoff/archives/Inheritedcheckedrecords.Api.1.0.0.nupkg"
]);
const controlKeys = [
	"recordControls", "environmentControls", "packageControls"
	, "modelControls", "executionControls"
];
const expectedControls = (records, mode) => ({
	recordControls: records * 2, environmentControls: 28
	, packageControls: 5, modelControls: mode === "full" ? 5 : 4
	, executionControls: 30
});
const identity = (tools, observation) => ({
	toolchain: {
		command: tools.command, interpreter: tools.interpreter, sdk: tools.sdk
	}
	, framework: {
		facts: observation.framework.facts
		, runtimeFiles: observation.framework.runtimeFiles
	}
});
let runtime, toolchain, framework;
const runs = [];
for(const [route, mode] of inheritedCheckedRecordDotnetSelections)
{
	const label = `${route}-${mode}`;
	const cellRoot = join(selected.root, label);
	assert.deepEqual((await readdir(cellRoot)).sort()
		, ["records", "run.tap", "verification.json"]);
	const recordsRoot = join(cellRoot, "records", route, mode);
	const paths = await nativeArtifactPaths(recordsRoot);
	const originalRead = path => readFile(join(recordsRoot, path));
	const report = JSON.parse(await originalRead("report.json"));
	const nuget = JSON.parse(await originalRead("nuget.json"));
	const context = JSON.parse(await originalRead("installation.json"));
	const tools = JSON.parse(await originalRead("toolchain.json"));
	const installed = JSON.parse(await originalRead("installed.json"));
	const cellRuntime = {
		platform: report.runtime.platform, arch: report.runtime.arch
		, glibc: report.runtime.glibc.stdout.trim().slice(6)
	};
	const cellIdentity = identity(tools, installed);
	runtime ??= cellRuntime;
	toolchain ??= cellIdentity.toolchain;
	framework ??= cellIdentity.framework;
	assert.deepEqual(cellRuntime, runtime, `${label} runtime drift`);
	assert.deepEqual(cellIdentity.toolchain, toolchain
		, `${label} toolchain drift`);
	assert.deepEqual(cellIdentity.framework, framework
		, `${label} framework drift`);
	assert.equal(runtime.platform, "linux");
	assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.split(".")[1]) >= 38);
	assert.equal(toolchain.sdk.version, "8.0.424");
	assert.ok(report.resourceChecks.every(check => check.maxLoad
		=== inheritedCheckedRecordDotnetEvidenceLoadCeiling));
	const original = await inspectInheritedCheckedRecordDotnetCiHandoff(
		originalRead);
	const recordPaths = inheritedCheckedRecordDotnetRecords(
		route, mode, nuget, context).sort();
	assert.deepEqual(paths, [...recordPaths, ...handoff].sort());
	const tap = await readFile(join(cellRoot, "run.tap"));
	assertInheritedCheckedRecordDotnetCiTap(tap.toString(), route, mode);
	const options = {
		route, mode, producer: selected.producer, directory: recordsRoot
		, tap: join(cellRoot, "run.tap")
		, glibc: inheritedCheckedRecordDotnetEvidenceFloor
		, dotnet: toolchain.command
	};
	const checked = await checkInheritedCheckedRecordDotnetCiRecords(options, {
		tap: tap.toString(), read: originalRead, runtime, toolchain, framework
		, archiveSha512: original.archiveSha512
	});
	const verification = await readFile(join(cellRoot, "verification.json"));
	assert.equal(verification.toString(), canonicalJson({
		...checked, archiveSha256: original.archiveSha256
	}), `${label} hosted checker output`);
	const controlled = await checkInheritedCheckedRecordDotnetControls(
		originalRead, {
			route, mode, producerCommit: selected.producer, runtime
			, floor: inheritedCheckedRecordDotnetEvidenceFloor
			, toolchain, framework, archiveSha512: original.archiveSha512
		}
	);
	const controls = Object.fromEntries(controlKeys.map(key =>
		[key, controlled[key]]));
	assert.deepEqual(controls, expectedControls(recordPaths.length, mode));
	for(const path of [...recordPaths, ...handoff])
		put(`${label}/records/${path}`, await originalRead(path));
	put(`${label}/run.tap`, tap);
	put(`${label}/verification.json`, verification);
	put(`${label}/controls.json`, Buffer.from(canonicalJson(controls)));
	runs.push({
		label, route, mode, recordCount: recordPaths.length, accepted: checked
		, controls, reportSha256: sha256(await originalRead("report.json"))
		, archiveSha256: original.archiveSha256
		, tapSha256: sha256(tap)
		, verificationSha256: sha256(verification)
	});
}

const selectedSources = await inheritedCheckedRecordDotnetEvidenceSources(
	revisions);
for(const source of selectedSources)
	put(`sources/${source.role}/${source.path}`
		, inheritedCheckedRecordDotnetEvidenceOriginal(
			source.revision, source.path));
const runId = Number(selected["run-id"]);
const artifact = {
	id: Number(selected["artifact-id"]), name: selected["artifact-name"]
	, bytes: Number(selected["artifact-bytes"])
};
const index = {
	schemaVersion: 1, kind: "inherited-checked-record-dotnet-installed-v1"
	, producerCommit: revisions.producer, checkerCommit: revisions.checker
	, archiveCommit, runtime, toolchain, framework
	, floor: inheritedCheckedRecordDotnetEvidenceFloor
	, loadCeiling: inheritedCheckedRecordDotnetEvidenceLoadCeiling
	, hostedRun: {
		repository: "seanmorris/lean-bridge", runId
		, url: `https://github.com/seanmorris/lean-bridge/actions/runs/${runId}`
		, artifact
	}
	, runs, selectedSources
	, limitations: [
		"The fixture covers inherited parent subobjects, child checked fields, aliases, nested inheritance, repeated constructor selections, and constructor-free results."
		, "Ordinary and independently reviewed sources are exercised in full and result-only NuGet packages."
		, "Complete NuGet packages are reproduced, restored offline, executed before and after relocation, and reduced to source-free runtime deployments."
		, "Complete package archives, receipts, inventories, probes, execution records, TAP, controls, and producer/checker/archive source closures are retained."
		, "The package floor is glibc 2.38; the archive records and verifies the hosted runner's independently observed glibc and .NET identities."
		, "Compiler, operating-system, .NET SDK, shared-framework, NuGet, and glibc distributions remain trusted inputs."
		, "This archive establishes installed .NET behavior, not promotion into the public support inventory."
	]
	, files: [...files].sort(([left], [right]) => left.localeCompare(right))
		.map(([path, bytes]) => ({
			path, bytes: bytes.length, sha256: sha256(bytes)
		}))
};

await mkdir(evidence);
for(const [path, bytes] of files)
{
	const target = join(evidence, path);
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" });
}
const indexBytes = Buffer.from(canonicalJson(index));
await writeFile(join(evidence, "index.json"), indexBytes, { flag: "wx" });
const evidenceBytes = [...files.values()].reduce(
	(total, bytes) => total + bytes.length, indexBytes.length);
process.stdout.write(canonicalJson({
	destination: evidence, files: files.size + 1, bytes: evidenceBytes
	, ...revisions, runId, artifact, indexSha256: sha256(indexBytes)
}));
