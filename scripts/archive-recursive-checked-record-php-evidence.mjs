#!/usr/bin/env node
/**
 * Validate and archive the hosted recursive checked-record native PHP artifact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, lstat, mkdir, readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { checkRecursiveCheckedRecordPhpControls } from "../tests/helpers/recursive-checked-record-php-controls.mjs";
import { checkRecursiveCheckedRecordPhpReport } from "../tests/helpers/recursive-checked-record-php-report.mjs";
import {
	assertRecursiveCheckedRecordPhpEvidenceTap
	, assertRecursiveCheckedRecordPhpEvidenceTools
	, recursiveCheckedRecordPhpEvidence
	, recursiveCheckedRecordPhpEvidenceFloor
	, recursiveCheckedRecordPhpEvidenceLoadCeiling
	, recursiveCheckedRecordPhpEvidenceOriginal
	, recursiveCheckedRecordPhpEvidenceProducer
	, recursiveCheckedRecordPhpEvidenceRuntime
	, recursiveCheckedRecordPhpEvidenceSelections
	, recursiveCheckedRecordPhpEvidenceSources
	, recursiveCheckedRecordPhpEvidenceToolchainLogSha256
	, recursiveCheckedRecordPhpEvidenceToolsSha256
	, recursiveCheckedRecordPhpEvidenceVerifier
	, recursiveCheckedRecordPhpHostedArtifact
} from "../tests/helpers/recursive-checked-record-php-provenance.mjs";
import { saveLakeFile } from "../tests/helpers/lake-workspace.mjs";

const usage = "Usage: archive-recursive-checked-record-php-evidence.mjs /absolute/artifact-root /absolute/toolchain-log";
const [sourceArgument, logArgument, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0, usage);
for(const path of [sourceArgument, logArgument])
	assert.ok(typeof path === "string" && isAbsolute(path) && resolve(path) === path, usage);
const sourceRoot = sourceArgument, destination = resolve(recursiveCheckedRecordPhpEvidence);
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
			assert.ok(entry.isFile() && !entry.isSymbolicLink(), path); paths.push(path);
		}
	}
	return paths.sort();
};
const copy = async (from, to) => {
	const bytes = await readFile(from); await saveLakeFile(destination, to, bytes); return bytes;
};
const json = (bytes, path) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path); return value;
};
const controlKeys = ["recordControls", "executionControls"
	, "toolControls", "resourceControls", "environmentControls"
	, "packageControls", "modelControls"];
const expectedControls = records => ({
	recordControls: records * 2, executionControls: 48, toolControls: 12
	, resourceControls: 7, environmentControls: 10
	, packageControls: 6, modelControls: 7
});

const toolBytes = await readFile(join(sourceRoot, "tools.json"));
assert.equal(sha256(toolBytes), recursiveCheckedRecordPhpEvidenceToolsSha256);
const tools = assertRecursiveCheckedRecordPhpEvidenceTools(json(toolBytes, "tools.json"));
await saveLakeFile(destination, "producer/tools.json", toolBytes);
const toolchainLog = await copy(logArgument, "producer/toolchain.log");
assert.equal(sha256(toolchainLog), recursiveCheckedRecordPhpEvidenceToolchainLogSha256);

const runs = [], producerFiles = ["tools.json"];
for(const [route, fixture] of recursiveCheckedRecordPhpEvidenceSelections)
{
	const label = `${route}-${fixture}`, cell = join(sourceRoot, label);
	const recordsRoot = join(cell, "records", route, fixture);
	const read = path => readFile(join(recordsRoot, path));
	const options = {
		route, fixture, producerCommit: recursiveCheckedRecordPhpEvidenceProducer
		, runtime: recursiveCheckedRecordPhpEvidenceRuntime
		, floor: recursiveCheckedRecordPhpEvidenceFloor
		, phpVersion: tools.selected.phpVersion
		, composerVersion: tools.selected.composerVersion
	};
	const result = await checkRecursiveCheckedRecordPhpReport(read, options);
	assert.equal(result.loadCeiling, recursiveCheckedRecordPhpEvidenceLoadCeiling);
	assert.deepEqual(await treeFiles(recordsRoot), result.records);
	assert.deepEqual(json(await read("tools.json"), `${label}/records/tools.json`), tools);
	const tap = await readFile(join(cell, "run.tap"));
	assertRecursiveCheckedRecordPhpEvidenceTap(tap.toString(), route, fixture);
	const verificationBytes = await readFile(join(cell, "verification.json"));
	const verification = json(verificationBytes, `${label}/verification.json`);
	assert.deepEqual(verification, { ...result, tools });
	const controlled = await checkRecursiveCheckedRecordPhpControls(read, options);
	const controls = Object.fromEntries(controlKeys.map(key => [key, controlled[key]]));
	assert.deepEqual(controls, expectedControls(result.records.length));
	for(const path of result.records)
	{
		await copy(join(recordsRoot, path), `${label}/records/${path}`);
		producerFiles.push(`${label}/records/${route}/${fixture}/${path}`);
	}
	await saveLakeFile(destination, `${label}/run.tap`, tap);
	await saveLakeFile(destination, `${label}/verification.json`, verificationBytes);
	await saveLakeFile(destination, `${label}/controls.json`, canonicalJson(controls));
	producerFiles.push(`${label}/run.tap`, `${label}/verification.json`);
	const report = json(await read("report.json"), `${label}/records/report.json`);
	runs.push({
		label, route, fixture, records: result.records.length
		, executions: result.executions, counts: result.counts
		, dispatchObserved: result.dispatchObserved
		, generatorPaths: result.generatorPaths
		, loadCeiling: result.loadCeiling, controls
		, archiveSha256: result.archiveSha256
		, reportSha256: result.reportSha256
		, tapSha256: sha256(tap)
		, verificationSha256: sha256(verificationBytes)
		, artifacts: report.receipt.packages[0].artifacts
	});
}
assert.deepEqual(await treeFiles(sourceRoot), producerFiles.sort());

const selectedSources = await recursiveCheckedRecordPhpEvidenceSources();
for(const source of selectedSources)
{
	const bytes = recursiveCheckedRecordPhpEvidenceOriginal(source.revision, source.path);
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
	schemaVersion: 1, kind: "recursive-checked-record-php-installed-v1"
	, producerCommit: recursiveCheckedRecordPhpEvidenceProducer
	, checkerCommit: recursiveCheckedRecordPhpEvidenceVerifier
	, loadCeiling: recursiveCheckedRecordPhpEvidenceLoadCeiling
	, diskFloorBytes: 2 * 1024 ** 3
	, floor: recursiveCheckedRecordPhpEvidenceFloor
	, runtime: recursiveCheckedRecordPhpEvidenceRuntime
	, tools, toolchainLogSha256: sha256(toolchainLog)
	, hostedArtifact: recursiveCheckedRecordPhpHostedArtifact
	, selectedSources, runs
	, limitations: [
		"The fixtures cover the tested self-recursive Packet graph and mutually recursive Envelope/Step graph; runtime values are finite and bounded."
		, "Checked fields are limited to Fin 3 and the tested Nat Subtype constructors."
		, "Acceptance covers weak and strict callers before and after relocation through the exact retained Composer package and PHP FFI closure."
		, "Generic, inherited, open dependent and zero-payload records remain separate work."
		, "Callbacks, resources and explicitly owned or borrowed positions remain separate work."
		, "The packages declare a glibc 2.38 floor and were executed by the hosted Ubuntu 24.04 runner on glibc 2.39; this does not claim execution on a 2.38 host."
		, "PHP constructor dispatch and peak memory are unmeasured; Lean, PHP, Composer, the operating system and native compiler remain trusted toolchain inputs."
	]
	, files
};
await saveLakeFile(destination, "index.json", canonicalJson(index));
process.stdout.write(canonicalJson({
	evidence: recursiveCheckedRecordPhpEvidence
	, indexSha256: sha256(canonicalJson(index))
	, files: files.length
	, bytes: files.reduce((sum, file) => sum + file.bytes, 0)
}));
