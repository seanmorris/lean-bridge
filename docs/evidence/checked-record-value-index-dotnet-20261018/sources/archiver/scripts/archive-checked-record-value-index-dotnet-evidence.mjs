#!/usr/bin/env node
/**
 * Freeze one successful hosted value-index checked-record .NET artifact.
 * No byte is retained until every original route and negative control replays.
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
	inspectCheckedRecordValueIndexDotnetCiHandoff
} from "../tests/helpers/checked-record-value-index-dotnet-ci-handoff.mjs";
import {
	assertCheckedRecordValueIndexDotnetCiTap
	, checkCheckedRecordValueIndexDotnetCiRecords
} from "../tests/helpers/checked-record-value-index-dotnet-ci-report.mjs";
import {
	checkCheckedRecordValueIndexDotnetControls
} from "../tests/helpers/checked-record-value-index-dotnet-controls.mjs";
import {
	checkedRecordValueIndexDotnetEvidenceOriginal
	, checkedRecordValueIndexDotnetEvidenceSources
} from "../tests/helpers/checked-record-value-index-dotnet-evidence-sources.mjs";
import {
	checkedRecordValueIndexDotnetEvidence
	, checkedRecordValueIndexDotnetEvidenceFloor
	, checkedRecordValueIndexDotnetEvidenceLoadCeiling
	, checkedRecordValueIndexDotnetSelections
} from "../tests/helpers/checked-record-value-index-dotnet-provenance.mjs";
import {
	checkedRecordValueIndexDotnetRecords
} from "../tests/helpers/checked-record-value-index-dotnet-report.mjs";

const usage = "Usage: archive-checked-record-value-index-dotnet-evidence.mjs --root /absolute/artifact/root --producer <commit> --consumer <commit> --checker <commit> --run-id <digits> --artifact-id <digits> --artifact-name <name> --artifact-bytes <digits>";
const allowed = [
	"root", "producer", "consumer", "checker", "run-id"
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
	for(const key of ["producer", "consumer", "checker"])
		assert.match(selected[key], /^[a-f0-9]{40}$/u, usage);
	for(const key of ["run-id", "artifact-id", "artifact-bytes"])
		assert.match(selected[key], /^[1-9][0-9]*$/u, usage);
	assert.equal(selected["artifact-name"]
		, `checked-record-value-index-dotnet-${selected.producer}`, usage);
	return selected;
};

let selected;
try
{ selected = parse(process.argv.slice(2)); }
catch(error)
{ process.stderr.write(`${error.message}\n`); process.exit(2); }

await assert.rejects(access(checkedRecordValueIndexDotnetEvidence)
	, { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
const revisions = {
	producer: selected.producer, consumer: selected.consumer
	, checker: selected.checker, archiver: archiveCommit
};
assert.equal(await realpath(selected.root), selected.root);
assert.deepEqual((await readdir(selected.root)).sort()
	, [...checkedRecordValueIndexDotnetSelections].sort());
const files = new Map();
const put = (path, bytes) => {
	assert.ok(!files.has(path), path); files.set(path, Buffer.from(bytes));
};
const controlKeys = Object.freeze([
	"records", "recordControls", "provenanceControls"
	, "reconciliationControls", "gitBindingControls", "packageControls"
	, "callerControls", "observationControls", "runtimeControls"
]);
const expectedControls = records => ({
	records, recordControls: 2, provenanceControls: 5
	, reconciliationControls: 1, gitBindingControls: 1
	, packageControls: 1, callerControls: 1
	, observationControls: 1, runtimeControls: 1
});
let runtime, toolchain, framework;
const runs = [];
for(const route of checkedRecordValueIndexDotnetSelections)
{
	const cellRoot = join(selected.root, route);
	assert.deepEqual((await readdir(cellRoot)).sort()
		, ["records", "run.tap", "verification.json"]);
	const recordsRoot = join(cellRoot, "records", route);
	const originalRead = path => readFile(join(recordsRoot, path));
	const report = JSON.parse(await originalRead("report.json"));
	const nuget = JSON.parse(await originalRead("nuget.json"));
	const context = JSON.parse(await originalRead("installation.json"));
	const verificationBytes = await readFile(join(
		cellRoot, "verification.json"));
	const verification = JSON.parse(verificationBytes);
	assert.equal(verificationBytes.toString(), canonicalJson(verification)
		, `${route} hosted checker output is canonical`);
	runtime ??= verification.runtime;
	toolchain ??= verification.toolchain;
	framework ??= verification.framework;
	assert.deepEqual(verification.runtime, runtime, `${route} runtime drift`);
	assert.deepEqual(verification.toolchain, toolchain
		, `${route} toolchain drift`);
	assert.deepEqual(verification.framework, framework
		, `${route} framework drift`);
	assert.equal(runtime.platform, "linux");
	assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.split(".")[1]) >= 38);
	assert.equal(toolchain.sdk.version, "8.0.424");
	assert.ok(report.resourceChecks.every(check => check.maxLoad
		=== checkedRecordValueIndexDotnetEvidenceLoadCeiling));
	const original = await inspectCheckedRecordValueIndexDotnetCiHandoff(
		originalRead);
	const recordPaths = checkedRecordValueIndexDotnetRecords(
		route, nuget, context).sort();
	assert.deepEqual(await nativeArtifactPaths(recordsRoot), recordPaths);
	const tap = await readFile(join(cellRoot, "run.tap"));
	assertCheckedRecordValueIndexDotnetCiTap(tap.toString(), route);
	const options = {
		route, producer: selected.producer, consumer: selected.consumer
		, directory: recordsRoot, tap: join(cellRoot, "run.tap")
		, glibc: checkedRecordValueIndexDotnetEvidenceFloor
		, dotnet: toolchain.command
	};
	const accepted = await checkCheckedRecordValueIndexDotnetCiRecords(
		options, {
			tap: tap.toString(), read: originalRead, runtime, toolchain, framework
			, archiveSha512: original.archiveSha512
		}
	);
	const controlled = await checkCheckedRecordValueIndexDotnetControls(
		originalRead, {
			route, producerCommit: selected.producer
			, consumerCommit: selected.consumer, runtime
			, floor: checkedRecordValueIndexDotnetEvidenceFloor
			, toolchain, framework, archiveSha512: original.archiveSha512
		}
	);
	assert.deepEqual(controlled.accepted, accepted);
	const controls = Object.fromEntries(controlKeys.map(key =>
		[key, controlled[key]]));
	assert.deepEqual(controls, expectedControls(recordPaths.length));
	assert.deepEqual(verification, {
		...accepted, archiveSha256: original.archiveSha256, controls
	});
	for(const path of recordPaths)
		put(`${route}/records/${path}`, await originalRead(path));
	put(`${route}/run.tap`, tap);
	put(`${route}/verification.json`, verificationBytes);
	runs.push({
		label: route, route, mode: accepted.mode
		, recordCount: recordPaths.length, accepted, controls
		, reportSha256: sha256(await originalRead("report.json"))
		, archiveSha256: original.archiveSha256
		, tapSha256: sha256(tap)
		, verificationSha256: sha256(verificationBytes)
	});
}

const selectedSources = await checkedRecordValueIndexDotnetEvidenceSources(
	revisions);
for(const source of selectedSources)
	put(`sources/${source.role}/${source.path}`
		, checkedRecordValueIndexDotnetEvidenceOriginal(
			source.revision, source.path));
const runId = Number(selected["run-id"]);
const artifact = {
	id: Number(selected["artifact-id"]), name: selected["artifact-name"]
	, bytes: Number(selected["artifact-bytes"])
};
const index = {
	schemaVersion: 1
	, kind: "checked-record-value-index-dotnet-installed-v1"
	, producerCommit: revisions.producer
	, consumerCommit: revisions.consumer
	, checkerCommit: revisions.checker
	, archiveCommit, runtime, toolchain, framework
	, floor: checkedRecordValueIndexDotnetEvidenceFloor
	, loadCeiling: checkedRecordValueIndexDotnetEvidenceLoadCeiling
	, hostedRun: {
		repository: "seanmorris/lean-bridge", runId
		, url: `https://github.com/seanmorris/lean-bridge/actions/runs/${runId}`
		, artifact
	}
	, runs, selectedSources
	, limitations: [
		"The fixture covers eight nominal records indexed by closed Bool, String and Nat values, including both booleans, empty and Unicode strings, zero and a Nat wider than 64 bits."
		, "Ordinary Lean source and independently reviewed Binding IR are exercised through full and result-only NuGet APIs; exact nominal identity, per-site constructors, invalid payloads, preserved rejected values, recovery and proof-free results are checked."
		, "Two independent author roots reproduce complete NuGet packages before source removal, offline restore, installed execution, physical relocation and source-free replay."
		, "Complete NuGet archives, receipts, inventories, API probes, execution records, TAP, all negative controls and producer/consumer/checker/archiver source closures are retained."
		, "The package floor is glibc 2.38; the archive records and verifies the hosted Linux x64 runner, .NET SDK 8.0.424 and shared-framework identities."
		, "Lean, C/C++ compilers, the operating system, .NET SDK, shared framework, NuGet and glibc distributions remain trusted inputs represented by recorded identities rather than copied toolchains."
		, "This lane establishes installed .NET acceptance only. Other value-index kinds, dependent runtime values, callbacks, owned positions, other hosts and aggregate public support promotion require separate evidence."
	]
	, files: [...files].sort(([left], [right]) => left.localeCompare(right))
		.map(([path, bytes]) => ({
			path, bytes: bytes.length, sha256: sha256(bytes)
		}))
};

await mkdir(checkedRecordValueIndexDotnetEvidence);
for(const [path, bytes] of files)
{
	const target = join(checkedRecordValueIndexDotnetEvidence, path);
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" });
}
const indexBytes = Buffer.from(canonicalJson(index));
await writeFile(join(checkedRecordValueIndexDotnetEvidence, "index.json")
	, indexBytes, { flag: "wx" });
const evidenceBytes = [...files.values()].reduce(
	(total, bytes) => total + bytes.length, indexBytes.length);
process.stdout.write(canonicalJson({
	destination: checkedRecordValueIndexDotnetEvidence
	, files: files.size + 1, bytes: evidenceBytes
	, ...revisions
	, runId, artifact, indexSha256: sha256(indexBytes)
}));
