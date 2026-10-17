#!/usr/bin/env node
/**
 * Freeze one successful hosted inherited checked-record Rust artifact.
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
	checkInheritedCheckedRecordRustControls
} from "../tests/helpers/inherited-checked-record-rust-controls.mjs";
import {
	assertInheritedCheckedRecordRustCiTap
	, checkInheritedCheckedRecordRustCiRecords
	, inheritedCheckedRecordRustCiReader
} from "../tests/helpers/inherited-checked-record-rust-ci-report.mjs";
import {
	inheritedCheckedRecordRustEvidenceSources
	, inheritedCheckedRecordRustOriginal
} from "../tests/helpers/inherited-checked-record-rust-evidence-sources.mjs";
import {
	inheritedCheckedRecordRustRecords
} from "../tests/helpers/inherited-checked-record-rust-report.mjs";
import {
	inheritedCheckedRecordRustSelections
} from "../tests/helpers/inherited-checked-record-rust-provenance.mjs";

const usage = "Usage: archive-inherited-checked-record-rust-evidence.mjs --root /absolute/artifact/root --producer <commit> --checker <commit> --run-id <digits>";
const allowed = ["root", "producer", "checker", "run-id"];
const parse = args => {
	assert.equal(args.length, allowed.length * 2, usage);
	const selected = {};
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && value && !value.startsWith("--")
			&& !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.ok(isAbsolute(selected.root), usage);
	for(const key of ["producer", "checker"])
		assert.match(selected[key], /^[a-f0-9]{40}$/u, usage);
	assert.match(selected["run-id"], /^[1-9][0-9]*$/u, usage);
	return selected;
};

let selected;
try
{ selected = parse(process.argv.slice(2)); }
catch(error)
{ process.stderr.write(`${error.message}\n`); process.exit(2); }

const evidence = "docs/evidence/inherited-checked-record-rust-20261017";
await assert.rejects(access(evidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
const revisions = {
	producer: selected.producer, checker: selected.checker, archiver: archiveCommit
};
assert.equal(await realpath(selected.root), selected.root);
const labels = inheritedCheckedRecordRustSelections.map(
	([route, mode]) => `${route}-${mode}`);
assert.deepEqual((await readdir(selected.root)).sort(), labels.sort());
const files = new Map();
const put = (path, bytes) => {
	assert.ok(!files.has(path), path); files.set(path, Buffer.from(bytes));
};
const controlKeys = [
	"recordControls", "resourceControls", "environmentControls"
	, "packageControls", "modelControls", "executionControls"
];
const expectedControls = (records, mode) => ({
	recordControls: records * 2, resourceControls: 8
	, environmentControls: mode === "full" ? 60 : 61
	, packageControls: 6, modelControls: mode === "full" ? 6 : 5
	, executionControls: 30
});
let runtime, toolchain;
const runs = [];
for(const [route, mode] of inheritedCheckedRecordRustSelections)
{
	const label = `${route}-${mode}`;
	const cellRoot = join(selected.root, label);
	assert.deepEqual((await readdir(cellRoot)).sort()
		, ["records", "run.tap", "verification.json"]);
	const recordsRoot = join(cellRoot, "records", route, mode);
	const paths = await nativeArtifactPaths(recordsRoot);
	const originalRead = path => readFile(join(recordsRoot, path));
	const recordRead = await inheritedCheckedRecordRustCiReader(originalRead);
	const report = JSON.parse(await originalRead("report.json"));
	const cellRuntime = {
		platform: report.runtime.platform, arch: report.runtime.arch
		, glibc: report.runtime.glibc.stdout.trim().slice(6)
	};
	const cellToolchain = JSON.parse(await originalRead("toolchain.json"));
	runtime ??= cellRuntime;
	toolchain ??= cellToolchain;
	assert.deepEqual(cellRuntime, runtime, `${label} runtime drift`);
	assert.deepEqual(cellToolchain, toolchain, `${label} toolchain drift`);
	assert.equal(runtime.platform, "linux"); assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.split(".")[1]) >= 38);
	const tap = await readFile(join(cellRoot, "run.tap"));
	assertInheritedCheckedRecordRustCiTap(tap.toString(), route, mode);
	const options = {
		route, mode, producer: selected.producer, directory: recordsRoot
		, tap: join(cellRoot, "run.tap"), glibc: "2.38"
		, rustc: toolchain.rustc.command, cargo: toolchain.cargo.command
	};
	const checked = await checkInheritedCheckedRecordRustCiRecords(options, {
		tap: tap.toString(), read: recordRead, runtime, toolchain
	});
	assert.equal(checked.loadCeiling, 8);
	const crate = JSON.parse(await originalRead("crate.json"));
	const dependencies = JSON.parse(await originalRead("dependencies.json"));
	const recordPaths = inheritedCheckedRecordRustRecords(route, crate, dependencies)
		.sort();
	assert.deepEqual(paths, recordPaths);
	assert.equal(checked.records, recordPaths.length);
	const verification = await readFile(join(cellRoot, "verification.json"));
	assert.equal(verification.toString(), canonicalJson(checked)
		, `${label} hosted checker output`);
	const controlled = await checkInheritedCheckedRecordRustControls(recordRead, {
		route, mode, producerCommit: selected.producer, runtime
		, floor: "2.38", toolchain
	});
	const controls = Object.fromEntries(controlKeys.map(key =>
		[key, controlled[key]]));
	assert.deepEqual(controls, expectedControls(recordPaths.length, mode));
	for(const path of recordPaths)
		put(`${label}/records/${path}`, await originalRead(path));
	put(`${label}/run.tap`, tap);
	put(`${label}/verification.json`, verification);
	put(`${label}/controls.json`, Buffer.from(canonicalJson(controls)));
	runs.push({
		label, route, mode, recordCount: recordPaths.length, accepted: checked
		, controls, reportSha256: sha256(await originalRead("report.json"))
		, tapSha256: sha256(tap), verificationSha256: sha256(verification)
	});
}

const selectedSources = await inheritedCheckedRecordRustEvidenceSources(revisions);
for(const source of selectedSources)
	put(`sources/${source.role}/${source.path}`
		, inheritedCheckedRecordRustOriginal(source.revision, source.path));
const runId = Number(selected["run-id"]);
const index = {
	schemaVersion: 1, kind: "inherited-checked-record-rust-installed-v1"
	, producerCommit: revisions.producer, checkerCommit: revisions.checker
	, archiveCommit, runtime, toolchain, floor: "2.38", loadCeiling: 8
	, hostedRun: {
		repository: "seanmorris/lean-bridge", runId
		, url: `https://github.com/seanmorris/lean-bridge/actions/runs/${runId}`
	}
	, runs, selectedSources
	, limitations: [
		"The fixture covers inherited parent subobjects, child checked fields, aliases, nested inheritance, repeated constructor selections, and constructor-free results."
		, "Ordinary and independently reviewed sources are exercised in full and result-only Cargo packages."
		, "Complete crates are reproduced from two author roots, installed offline, executed before and after relocation, and reduced to one source-free executable."
		, "Complete crate and dependency archives, receipts, inventories, caller binaries, execution records, TAP, controls, and producer/checker/archive source closures are retained."
		, "The package floor is glibc 2.38; the archive records and verifies the hosted runner's independently observed glibc version."
		, "Compiler, operating-system, Rust, Cargo, linker, and glibc distributions remain trusted inputs."
		, "This archive establishes installed Rust behavior, not promotion into the public support inventory."
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
	destination: evidence, files: files.size + 1
	, bytes: evidenceBytes
	, ...revisions, runId, indexSha256: sha256(indexBytes)
}));
