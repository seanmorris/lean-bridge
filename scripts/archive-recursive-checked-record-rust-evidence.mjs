#!/usr/bin/env node
/**
 * Validate and archive one complete local recursive checked-record Rust producer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, lstat, mkdir, readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { checkRecursiveCheckedRecordRustControls } from "../tests/helpers/recursive-checked-record-rust-controls.mjs";
import {
	assertRecursiveCheckedRecordRustCiTap, recursiveCheckedRecordRustCiReader
} from "../tests/helpers/recursive-checked-record-rust-ci-report.mjs";
import { checkRecursiveCheckedRecordRustReport, recursiveCheckedRecordRustRecords } from "../tests/helpers/recursive-checked-record-rust-report.mjs";
import {
	recursiveCheckedRecordRustEvidence
	, recursiveCheckedRecordRustEvidenceFloor
	, recursiveCheckedRecordRustEvidenceLoadCeiling
	, recursiveCheckedRecordRustEvidenceOriginal
	, recursiveCheckedRecordRustEvidenceRuntime
	, recursiveCheckedRecordRustEvidenceSources
	, recursiveCheckedRecordRustEvidenceToolchain
	, recursiveCheckedRecordRustProducer
	, recursiveCheckedRecordRustSelections
	, recursiveCheckedRecordRustVerifier
} from "../tests/helpers/recursive-checked-record-rust-provenance.mjs";
import { saveLakeFile } from "../tests/helpers/lake-workspace.mjs";

const sourceArgument = process.argv[2];
const usage = "Usage: archive-recursive-checked-record-rust-evidence.mjs /absolute/producer-root";
assert.ok(typeof sourceArgument === "string" && isAbsolute(sourceArgument)
	&& resolve(sourceArgument) === sourceArgument, usage);
assert.equal(process.argv.length, 3);
const sourceRoot = sourceArgument;
const destination = resolve(recursiveCheckedRecordRustEvidence);
await assert.rejects(access(destination), { code: "ENOENT" });
await mkdir(destination, { recursive: false });

const treeFiles = async (root, prefix = "") => {
	const paths = [];
	for(const entry of await readdir(join(root, prefix), { withFileTypes: true }))
	{
		const path = prefix ? `${prefix}/${entry.name}` : entry.name;
		if(entry.isDirectory()) paths.push(...await treeFiles(root, path));
		else
		{
			assert.ok(entry.isFile() && !entry.isSymbolicLink(), path);
			paths.push(path);
		}
	}
	return paths.sort();
};
const copy = async (from, to) => {
	const bytes = await readFile(from);
	await saveLakeFile(destination, to, bytes); return bytes;
};
const controlKeys = ["recordControls", "resourceControls"
	, "environmentControls", "packageControls", "modelControls"
	, "executionControls"];
const expectedControls = records => ({
	recordControls: records * 2, resourceControls: 8
	, environmentControls: 60
	, packageControls: 7, modelControls: 8
	, executionControls: 30
});

const runs = [];
const producerFiles = [];
let commonToolchain;
for(const [route, fixture] of recursiveCheckedRecordRustSelections)
{
	const label = `${route}-${fixture}`;
	const runRoot = join(sourceRoot, label);
	const recordsRoot = join(runRoot, "records", route, fixture);
	const read = await recursiveCheckedRecordRustCiReader(
		path => readFile(join(recordsRoot, path))
	);
	const toolchain = JSON.parse(await read("toolchain.json"));
	assert.deepEqual(toolchain, recursiveCheckedRecordRustEvidenceToolchain);
	const options = {
		route, fixture, producerCommit: recursiveCheckedRecordRustProducer
		, runtime: recursiveCheckedRecordRustEvidenceRuntime
		, floor: recursiveCheckedRecordRustEvidenceFloor, toolchain
	};
	const result = await checkRecursiveCheckedRecordRustReport(read, options);
	assert.equal(result.loadCeiling, recursiveCheckedRecordRustEvidenceLoadCeiling);
	const crate = JSON.parse(await read("crate.json"));
	const dependencies = JSON.parse(await read("dependencies.json"));
	const paths = recursiveCheckedRecordRustRecords(
		route, fixture, crate, dependencies
	).sort();
	assert.deepEqual(await treeFiles(recordsRoot), paths);
	assert.equal(result.records, paths.length);
	const tap = await readFile(join(runRoot, "run.tap"), "utf8");
	assertRecursiveCheckedRecordRustCiTap(tap, route, fixture);
	const verificationBytes = await readFile(join(
		runRoot, "verification.json"
	));
	const verification = JSON.parse(verificationBytes);
	assert.equal(verificationBytes.toString(), canonicalJson(verification));
	assert.deepEqual(verification, result);
	const controlled = await checkRecursiveCheckedRecordRustControls(read, options);
	const controls = Object.fromEntries(controlKeys.map(key => [key, controlled[key]]));
	assert.deepEqual(controls, expectedControls(paths.length));
	for(const path of paths)
	{
		await copy(join(recordsRoot, path), `${label}/records/${path}`);
		producerFiles.push(`${label}/records/${route}/${fixture}/${path}`);
	}
	await saveLakeFile(destination, `${label}/run.tap`, tap);
	await saveLakeFile(destination, `${label}/verification.json`, verificationBytes);
	await saveLakeFile(destination, `${label}/controls.json`, canonicalJson(controls));
	producerFiles.push(`${label}/run.tap`, `${label}/verification.json`);
	if(commonToolchain === undefined) commonToolchain = toolchain;
	else assert.deepEqual(toolchain, commonToolchain);
	const report = JSON.parse(await read("report.json"));
	runs.push({
		label, route, fixture, records: paths.length
		, executions: result.executions, counts: result.counts
		, generatorModules: result.generatorModules
		, dispatchObserved: result.dispatchObserved
		, loadCeiling: result.loadCeiling, controls
		, reportSha256: sha256(await read("report.json"))
		, tapSha256: sha256(tap)
		, verificationSha256: sha256(verificationBytes)
		, dependencyArchiveSha256: dependencies.sha256
		, artifacts: report.receipt.packages[0].artifacts
	});
}
assert.deepEqual(await treeFiles(sourceRoot), producerFiles.sort());

const selectedSources = await recursiveCheckedRecordRustEvidenceSources();
for(const source of selectedSources)
{
	const bytes = recursiveCheckedRecordRustEvidenceOriginal(
		source.revision, source.path
	);
	assert.deepEqual(await readFile(source.path), bytes, source.path);
	await saveLakeFile(destination, `sources/${source.role}/${source.path}`, bytes);
}

const files = [];
for(const path of await treeFiles(destination))
{
	const stats = await lstat(join(destination, path));
	assert.ok(stats.isFile() && !stats.isSymbolicLink(), path);
	const bytes = await readFile(join(destination, path));
	files.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
}
const index = {
	schemaVersion: 1, kind: "recursive-checked-record-rust-installed-v1"
	, producerCommit: recursiveCheckedRecordRustProducer
	, checkerCommit: recursiveCheckedRecordRustVerifier
	, loadCeiling: recursiveCheckedRecordRustEvidenceLoadCeiling
	, diskFloorBytes: 2 * 1024 ** 3
	, floor: recursiveCheckedRecordRustEvidenceFloor
	, runtime: recursiveCheckedRecordRustEvidenceRuntime
	, toolchain: commonToolchain, selectedSources, runs
	, limitations: [
		"The fixtures cover the tested self-recursive Packet graph and mutually recursive Envelope/Step graph; runtime values are finite and bounded."
		, "Checked fields are limited to Fin 3 and the tested Nat Subtype constructors."
		, "Acceptance covers the exact identities, aliases, active branches, traversal limits, diagnostics, recovery paths and positions exercised by the immutable Rust caller."
		, "Generic, inherited, open dependent and zero-payload records remain separate work."
		, "Callbacks, resources and explicitly owned or borrowed positions remain separate work."
		, "These local Linux x64/glibc 2.36 runs do not establish hosted release-floor acceptance."
		, "The original four selections were individually authenticated after serial execution; their separate TAP streams do not encode cross-selection timestamps."
		, "Constructor dispatch and peak memory are unmeasured; Rust, Cargo, the system linker and glibc remain trusted toolchain inputs."
	]
	, files
};
await saveLakeFile(destination, "index.json", canonicalJson(index));
process.stdout.write(canonicalJson({
	evidence: recursiveCheckedRecordRustEvidence
	, indexSha256: sha256(canonicalJson(index))
	, files: files.length
	, bytes: files.reduce((sum, file) => sum + file.bytes, 0)
}));
