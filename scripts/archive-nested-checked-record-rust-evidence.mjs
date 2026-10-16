#!/usr/bin/env node
/**
 * Validate and archive one complete local nested checked-record Rust producer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, lstat, mkdir, readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { checkNestedCheckedRecordRustControls } from "../tests/helpers/nested-checked-record-rust-controls.mjs";
import { assertNestedCheckedRecordRustCiTap } from "../tests/helpers/nested-checked-record-rust-ci-report.mjs";
import { checkNestedCheckedRecordRustReport, nestedCheckedRecordRustRecords } from "../tests/helpers/nested-checked-record-rust-report.mjs";
import {
	nestedCheckedRecordRustEvidence
	, nestedCheckedRecordRustEvidenceFloor
	, nestedCheckedRecordRustEvidenceLoadCeiling
	, nestedCheckedRecordRustEvidenceOriginal
	, nestedCheckedRecordRustEvidenceRuntime
	, nestedCheckedRecordRustEvidenceSources
	, nestedCheckedRecordRustProducer
	, nestedCheckedRecordRustSelections
	, nestedCheckedRecordRustVerifier
} from "../tests/helpers/nested-checked-record-rust-provenance.mjs";
import { saveLakeFile } from "../tests/helpers/lake-workspace.mjs";

const sourceArgument = process.argv[2];
const usage = "Usage: archive-nested-checked-record-rust-evidence.mjs /absolute/producer-root";
assert.ok(typeof sourceArgument === "string" && isAbsolute(sourceArgument)
	&& resolve(sourceArgument) === sourceArgument, usage);
assert.equal(process.argv.length, 3);
const sourceRoot = sourceArgument;
const destination = resolve(nestedCheckedRecordRustEvidence);
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
const expectedControls = (records, mode) => ({
	recordControls: records * 2, resourceControls: 8
	, environmentControls: mode === "full" ? 60 : 61
	, packageControls: 6, modelControls: mode === "full" ? 6 : 5
	, executionControls: 30
});

const runs = [];
let commonToolchain;
for(const [route, mode] of nestedCheckedRecordRustSelections)
{
	const label = `${route}-${mode}`;
	const recordsRoot = join(sourceRoot, "records", route, mode);
	const read = path => readFile(join(recordsRoot, path));
	const toolchain = JSON.parse(await read("toolchain.json"));
	const options = {
		route, mode, producerCommit: nestedCheckedRecordRustProducer
		, runtime: nestedCheckedRecordRustEvidenceRuntime
		, floor: nestedCheckedRecordRustEvidenceFloor, toolchain
	};
	const result = await checkNestedCheckedRecordRustReport(read, options);
	assert.equal(result.loadCeiling, nestedCheckedRecordRustEvidenceLoadCeiling);
	const crate = JSON.parse(await read("crate.json"));
	const dependencies = JSON.parse(await read("dependencies.json"));
	const paths = nestedCheckedRecordRustRecords(route, crate, dependencies).sort();
	assert.deepEqual(await treeFiles(recordsRoot), paths);
	assert.equal(result.records, paths.length);
	const tap = await readFile(join(sourceRoot, `${label}.tap`), "utf8");
	assertNestedCheckedRecordRustCiTap(tap, route, mode);
	const verificationBytes = await readFile(join(
		sourceRoot, `${label}-verification.json`
	));
	const verification = JSON.parse(verificationBytes);
	assert.equal(verificationBytes.toString(), canonicalJson(verification));
	assert.deepEqual(verification, result);
	const controlled = await checkNestedCheckedRecordRustControls(read, options);
	const controls = Object.fromEntries(controlKeys.map(key => [key, controlled[key]]));
	assert.deepEqual(controls, expectedControls(paths.length, mode));
	for(const path of paths)
		await copy(join(recordsRoot, path), `${label}/records/${path}`);
	await saveLakeFile(destination, `${label}/run.tap`, tap);
	await saveLakeFile(destination, `${label}/verification.json`, verificationBytes);
	await saveLakeFile(destination, `${label}/controls.json`, canonicalJson(controls));
	if(commonToolchain === undefined) commonToolchain = toolchain;
	else assert.deepEqual(toolchain, commonToolchain);
	const report = JSON.parse(await read("report.json"));
	runs.push({
		label, route, mode, records: paths.length
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

const selectedSources = await nestedCheckedRecordRustEvidenceSources();
for(const source of selectedSources)
{
	const bytes = nestedCheckedRecordRustEvidenceOriginal(
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
	schemaVersion: 1, kind: "nested-checked-record-rust-installed-v1"
	, producerCommit: nestedCheckedRecordRustProducer
	, checkerCommit: nestedCheckedRecordRustVerifier
	, loadCeiling: nestedCheckedRecordRustEvidenceLoadCeiling
	, diskFloorBytes: 2 * 1024 ** 3
	, floor: nestedCheckedRecordRustEvidenceFloor
	, runtime: nestedCheckedRecordRustEvidenceRuntime
	, toolchain: commonToolchain, selectedSources, runs
	, limitations: [
		"The fixture covers only the tested acyclic Packet, Holder, and Choice records."
		, "Checked fields are limited to Fin 10 and the tested Nat Subtype constructor."
		, "Copied acceptance covers the listed direct and container positions plus Array and Option results."
		, "Generic, recursive, inherited, open dependent, and zero-payload records remain separate work."
		, "Callback and explicitly owned positions remain separate work."
		, "These local Linux x64/glibc 2.36 runs do not establish hosted release-floor acceptance."
		, "The original four selections were individually authenticated after serial execution; their separate TAP streams do not encode cross-selection timestamps."
		, "Constructor dispatch and peak memory are unmeasured; Rust, Cargo, the system linker and glibc remain trusted toolchain inputs."
	]
	, files
};
await saveLakeFile(destination, "index.json", canonicalJson(index));
process.stdout.write(canonicalJson({
	evidence: nestedCheckedRecordRustEvidence
	, indexSha256: sha256(canonicalJson(index))
	, files: files.length
	, bytes: files.reduce((sum, file) => sum + file.bytes, 0)
}));
