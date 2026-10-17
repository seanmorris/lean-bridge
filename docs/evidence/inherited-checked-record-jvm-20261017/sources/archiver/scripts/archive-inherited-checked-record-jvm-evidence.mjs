#!/usr/bin/env node
/**
 * Freeze one successful hosted inherited checked-record JVM artifact.
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
	inspectInheritedCheckedRecordJvmCiHandoff
} from "../tests/helpers/inherited-checked-record-jvm-ci-handoff.mjs";
import {
	assertInheritedCheckedRecordJvmCiTap
	, checkInheritedCheckedRecordJvmCiRecords
} from "../tests/helpers/inherited-checked-record-jvm-ci-report.mjs";
import {
	checkInheritedCheckedRecordJvmControls
} from "../tests/helpers/inherited-checked-record-jvm-controls.mjs";
import {
	inheritedCheckedRecordJvmEvidenceOriginal
	, inheritedCheckedRecordJvmEvidenceSources
} from "../tests/helpers/inherited-checked-record-jvm-evidence-sources.mjs";
import {
	inheritedCheckedRecordJvmEvidenceFloor
	, inheritedCheckedRecordJvmEvidenceLoadCeiling
	, inheritedCheckedRecordJvmSelections
} from "../tests/helpers/inherited-checked-record-jvm-provenance.mjs";

const usage = "Usage: archive-inherited-checked-record-jvm-evidence.mjs --root /absolute/artifact/root --producer <commit> --checker <commit> --run-id <digits> --artifact-id <digits> --artifact-name <name> --artifact-bytes <digits>";
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
		, `inherited-checked-record-jvm-${selected.producer}`, usage);
	return selected;
};

let selected;
try
{ selected = parse(process.argv.slice(2)); }
catch(error)
{ process.stderr.write(`${error.message}\n`); process.exit(2); }

const evidence = "docs/evidence/inherited-checked-record-jvm-20261017";
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
const labels = inheritedCheckedRecordJvmSelections.map(
	([route, mode]) => `${route}-${mode}`);
assert.deepEqual((await readdir(selected.root)).sort(), labels.sort());
const files = new Map();
const put = (path, bytes) => {
	assert.ok(!files.has(path), path); files.set(path, Buffer.from(bytes));
};
const controlKeys = [
	"recordControls", "executionControls", "probeControls"
	, "packageControls", "modelControls", "resourceControls"
];
const expectedControls = (records, mode) => ({
	recordControls: records * 2, executionControls: 48, probeControls: 22
	, packageControls: 4, modelControls: mode === "full" ? 5 : 4
	, resourceControls: 8
});
let runtime, tools;
const runs = [];
for(const [route, mode] of inheritedCheckedRecordJvmSelections)
{
	const label = `${route}-${mode}`;
	const cellRoot = join(selected.root, label);
	assert.deepEqual((await readdir(cellRoot)).sort()
		, ["records", "run.tap", "verification.json"]);
	const recordsRoot = join(cellRoot, "records", route, mode);
	const paths = await nativeArtifactPaths(recordsRoot);
	const originalRead = path => readFile(join(recordsRoot, path));
	const report = JSON.parse(await originalRead("report.json"));
	const verification = await readFile(join(cellRoot, "verification.json"));
	const observed = JSON.parse(verification);
	runtime ??= observed.runtime;
	tools ??= observed.tools;
	assert.deepEqual(observed.runtime, runtime, `${label} runtime drift`);
	assert.deepEqual(observed.tools, tools, `${label} toolchain drift`);
	assert.equal(observed.floor, inheritedCheckedRecordJvmEvidenceFloor);
	assert.equal(report.loadCeiling
		, inheritedCheckedRecordJvmEvidenceLoadCeiling);
	assert.equal(runtime.platform, "linux");
	assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.split(".")[1]) >= 38);
	assert.deepEqual(Object.keys(tools).sort(), ["java", "javac", "kotlinc"]);
	assert.match(tools.java.version, /^(?:openjdk|java) 22\.0\.2[ +]/u);
	assert.equal(tools.javac.version, "javac 22.0.2");
	assert.match(tools.kotlinc.version
		, /^info: kotlinc-jvm 2\.2\.0 \(JRE 22\.0\.2[+)]/u);
	const original = await inspectInheritedCheckedRecordJvmCiHandoff(
		originalRead, { floor: inheritedCheckedRecordJvmEvidenceFloor, mode }
	);
	const tap = await readFile(join(cellRoot, "run.tap"));
	assertInheritedCheckedRecordJvmCiTap(tap.toString(), route, mode);
	const options = {
		route, mode, producer: selected.producer, directory: recordsRoot
		, tap: join(cellRoot, "run.tap")
		, glibc: inheritedCheckedRecordJvmEvidenceFloor
		, java: tools.java.command, javac: tools.javac.command
		, kotlinc: tools.kotlinc.command
	};
	const checked = await checkInheritedCheckedRecordJvmCiRecords(options, {
		tap: tap.toString(), read: original.read, runtime, tools
		, archiveSha256: original.archiveSha256
	});
	assert.equal(verification.toString(), canonicalJson(checked)
		, `${label} hosted checker output`);
	assert.deepEqual(paths, [
		...checked.records.filter(path => !path.startsWith("package/"))
		, original.archivePath
	].sort());
	const controlled = await checkInheritedCheckedRecordJvmControls(
		original.read, {
			route, mode, producerCommit: selected.producer, runtime
			, floor: inheritedCheckedRecordJvmEvidenceFloor
			, javaVersion: tools.java.version
		}
	);
	const controls = Object.fromEntries(controlKeys.map(key =>
		[key, controlled[key]]));
	assert.deepEqual(controls, expectedControls(checked.records.length, mode));
	for(const path of paths)
		put(`${label}/records/${path}`, await originalRead(path));
	put(`${label}/run.tap`, tap);
	put(`${label}/verification.json`, verification);
	put(`${label}/controls.json`, Buffer.from(canonicalJson(controls)));
	runs.push({
		label, route, mode, recordCount: paths.length, accepted: checked
		, controls, reportSha256: sha256(await originalRead("report.json"))
		, archiveSha256: original.archiveSha256
		, tapSha256: sha256(tap)
		, verificationSha256: sha256(verification)
	});
}

const selectedSources = await inheritedCheckedRecordJvmEvidenceSources(
	revisions);
for(const source of selectedSources)
	put(`sources/${source.role}/${source.path}`
		, inheritedCheckedRecordJvmEvidenceOriginal(
			source.revision, source.path));
const runId = Number(selected["run-id"]);
const artifact = {
	id: Number(selected["artifact-id"]), name: selected["artifact-name"]
	, bytes: Number(selected["artifact-bytes"])
};
const index = {
	schemaVersion: 1, kind: "inherited-checked-record-jvm-installed-v1"
	, producerCommit: revisions.producer, checkerCommit: revisions.checker
	, archiveCommit, runtime, tools
	, floor: inheritedCheckedRecordJvmEvidenceFloor
	, loadCeiling: inheritedCheckedRecordJvmEvidenceLoadCeiling
	, hostedRun: {
		repository: "seanmorris/lean-bridge", runId
		, url: `https://github.com/seanmorris/lean-bridge/actions/runs/${runId}`
		, artifact
	}
	, runs, selectedSources
	, limitations: [
		"The fixture covers inherited parent subobjects, child checked fields, aliases, nested inheritance, repeated constructor selections, and constructor-free results."
		, "Ordinary and independently reviewed sources are exercised in full and result-only Maven packages through independent Java and Kotlin callers."
		, "Complete Maven packages are reproduced, installed offline, executed before and after relocation, and reduced to source-free runtime deployments."
		, "Complete package archives, receipts, inventories, probes, execution records, TAP, controls, and producer/checker/archive source closures are retained."
		, "The package floor is glibc 2.38; the archive records and verifies the hosted runner's independently observed glibc and JVM tool identities."
		, "Compiler, operating-system, JDK, Kotlin compiler, Maven-format archive, and glibc distributions remain trusted inputs."
		, "This archive establishes installed JVM behavior, not promotion into the public support inventory."
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
