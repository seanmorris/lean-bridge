#!/usr/bin/env node
/**
 * Freeze one successful hosted inherited checked-record WIT/WASI artifact.
 * The archive is written only after every original selection replays exactly.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import {
	checkInheritedCheckedRecordWitCiRecords
} from "../tests/helpers/inherited-checked-record-wit-ci-report.mjs";
import {
	inspectInheritedCheckedRecordWitHandoff
} from "../tests/helpers/inherited-checked-record-wit-handoff.mjs";
import {
	inheritedCheckedRecordWitEvidenceSources
	, inheritedCheckedRecordWitOriginal
} from "../tests/helpers/inherited-checked-record-wit-evidence-sources.mjs";
import {
	inheritedCheckedRecordWitSelections
} from "../tests/helpers/inherited-checked-record-wit-provenance.mjs";

const usage = "Usage: archive-inherited-checked-record-wit-evidence.mjs --root /absolute/artifact/root --producer <commit> --checker <commit> --run-id <digits>";
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

const evidence = "docs/evidence/inherited-checked-record-wit-20261017";
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
const labels = inheritedCheckedRecordWitSelections.map(
	([route, mode]) => `${route}-${mode}`);
assert.deepEqual((await readdir(selected.root)).sort()
	, ["tools.json", ...labels].sort());
const preflightTools = JSON.parse(await readFile(join(selected.root, "tools.json")));
const files = new Map();
const put = (path, bytes) => {
	assert.ok(!files.has(path), path); files.set(path, Buffer.from(bytes));
};
let runtime, tools;
const runs = [];
for(const [route, mode] of inheritedCheckedRecordWitSelections)
{
	const label = `${route}-${mode}`;
	const cellRoot = join(selected.root, label);
	assert.deepEqual((await readdir(cellRoot)).sort()
		, ["records", "run.tap", "verification.json"]);
	const recordsRoot = join(cellRoot, "records", route, mode);
	const paths = await nativeArtifactPaths(recordsRoot);
	const originalRead = path => readFile(join(recordsRoot, path));
	const handoff = await inspectInheritedCheckedRecordWitHandoff(originalRead);
	const recordRead = path => handoff.supplements.get(path) ?? originalRead(path);
	const report = JSON.parse(await originalRead("report.json"));
	const cellRuntime = {
		platform: report.runtime.platform, arch: report.runtime.arch
		, glibc: report.runtime.glibc.stdout.trim().slice(6)
	};
	const cellTools = JSON.parse(await originalRead("tools.json"));
	assert.deepEqual(cellTools, preflightTools, `${label} preflight tool drift`);
	runtime ??= cellRuntime; tools ??= cellTools;
	assert.deepEqual(cellRuntime, runtime, `${label} runtime drift`);
	assert.deepEqual(cellTools, tools, `${label} tool drift`);
	assert.equal(runtime.platform, "linux"); assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.split(".")[1]) >= 38);
	const tap = await readFile(join(cellRoot, "run.tap"));
	const options = {
		route, mode, producer: selected.producer, directory: recordsRoot
		, tap: join(cellRoot, "run.tap"), glibc: "2.38"
		, cc: tools.selected.cc, "wasm-tools": tools.selected.wasmTools
		, "wasmtime-capi": tools.selected.wasmtimeCapi
	};
	const checked = await checkInheritedCheckedRecordWitCiRecords(options, {
		tap: tap.toString(), read: recordRead, runtime, tools
		, archiveSha256: handoff.archiveSha256
	});
	const expected = [
		...checked.records.filter(path => !handoff.supplements.has(path))
		, handoff.archivePath
	].sort();
	assert.deepEqual(paths, expected);
	const verification = await readFile(join(cellRoot, "verification.json"));
	assert.equal(verification.toString(), canonicalJson(checked)
		, `${label} hosted checker output`);
	for(const path of paths)
		put(`${label}/records/${path}`, await originalRead(path));
	put(`${label}/run.tap`, tap);
	put(`${label}/verification.json`, verification);
	runs.push({
		label, route, mode, recordCount: paths.length, accepted: checked
		, archiveSha256: checked.archiveSha256
		, reportSha256: sha256(await originalRead("report.json"))
		, tapSha256: sha256(tap), verificationSha256: sha256(verification)
	});
}

const selectedSources = await inheritedCheckedRecordWitEvidenceSources(revisions);
for(const source of selectedSources)
	put(`sources/${source.role}/${source.path}`
		, inheritedCheckedRecordWitOriginal(source.revision, source.path));
const runId = Number(selected["run-id"]);
const index = {
	schemaVersion: 1, kind: "inherited-checked-record-wit-installed-v1"
	, producerCommit: revisions.producer, checkerCommit: revisions.checker
	, archiveCommit, runtime, tools, loadCeiling: 8
	, hostedRun: {
		repository: "seanmorris/lean-bridge", runId
		, url: `https://github.com/seanmorris/lean-bridge/actions/runs/${runId}`
	}
	, runs, selectedSources
	, limitations: [
		"The fixture covers inherited parent subobjects, child checked fields, aliases, nested inheritance, repeated constructor selections, and constructor-free results."
		, "Ordinary and independently reviewed sources are exercised in full and result-only WIT/WASI component packages."
		, "Complete packages are reproduced from two author roots, installed offline, exercised before and after relocation, and checked at a glibc 2.38 release floor."
		, "The generated C host requires its packaged native Lean component runtime; it is not a standalone WASI command."
		, "Complete archives, receipts, source-free inventories, caller binaries, execution records, TAP, and producer/checker/archive source closures are retained."
		, "Compiler, operating-system, wasm-tools, Wasmtime, and C toolchain distributions remain trusted inputs."
		, "This archive establishes installed WIT/WASI behavior, not promotion into the public support inventory."
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
process.stdout.write(canonicalJson({
	destination: evidence, files: files.size + 1
	, bytes: [...files.values()].reduce(
		(total, bytes) => total + bytes.length, indexBytes.length)
	, ...revisions
	, runId, indexSha256: sha256(indexBytes)
}));
