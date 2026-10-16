#!/usr/bin/env node
/**
 * Validate and archive one complete local nested checked-record Python producer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, lstat, mkdir, readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { checkNestedCheckedRecordPythonControls } from "../tests/helpers/nested-checked-record-python-controls.mjs";
import { checkNestedCheckedRecordPythonReport } from "../tests/helpers/nested-checked-record-python-report.mjs";
import {
	assertNestedCheckedRecordPythonEvidenceTap
	, nestedCheckedRecordPythonEvidence
	, nestedCheckedRecordPythonEvidenceSources
	, nestedCheckedRecordPythonInterpreters
	, nestedCheckedRecordPythonLoadCeiling
	, nestedCheckedRecordPythonOriginal
	, nestedCheckedRecordPythonProducer
	, nestedCheckedRecordPythonRuntime
	, nestedCheckedRecordPythonSelections
	, nestedCheckedRecordPythonVerifier
} from "../tests/helpers/nested-checked-record-python-provenance.mjs";
import { saveLakeFile } from "../tests/helpers/lake-workspace.mjs";

const sourceArgument = process.argv[2];
const usage = "Usage: archive-nested-checked-record-python-evidence.mjs /absolute/producer-root";
assert.ok(typeof sourceArgument === "string" && isAbsolute(sourceArgument)
	&& resolve(sourceArgument) === sourceArgument, usage);
assert.equal(process.argv.length, 3);
const sourceRoot = sourceArgument, destination = resolve(nestedCheckedRecordPythonEvidence);
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
const options = (route, mode) => ({
	route, mode, producerCommit: nestedCheckedRecordPythonProducer
	, runtime: nestedCheckedRecordPythonRuntime, floor: "2.36"
});
const controlKeys = ["recordControls", "resourceControls", "environmentControls"
	, "packageControls", "modelControls"];

const tap = await readFile(join(sourceRoot, "run.tap"));
assertNestedCheckedRecordPythonEvidenceTap(tap.toString());
await saveLakeFile(destination, "producer/run.tap", tap);
const runs = [];
for(const [route, mode] of nestedCheckedRecordPythonSelections)
{
	const label = `${route}-${mode}`, recordsRoot = join(sourceRoot, "records", route, mode);
	const read = path => readFile(join(recordsRoot, path));
	const result = await checkNestedCheckedRecordPythonReport(read, options(route, mode));
	assert.equal(result.loadCeiling, nestedCheckedRecordPythonLoadCeiling);
	assert.deepEqual(await treeFiles(recordsRoot), result.recordPaths);
	for(const path of result.recordPaths) await copy(join(recordsRoot, path), `${label}/records/${path}`);
	const controlled = await checkNestedCheckedRecordPythonControls(read, options(route, mode));
	const controls = Object.fromEntries(controlKeys.map(key => [key, controlled[key]]));
	await saveLakeFile(destination, `${label}/controls.json`, canonicalJson(controls));
	runs.push({
		label, route, mode, records: result.records, executions: result.executions
		, loadCeiling: result.loadCeiling, archiveSha256: result.archiveSha256
		, reportSha256: result.reportSha256, controls
	});
}

const selectedSources = await nestedCheckedRecordPythonEvidenceSources();
for(const source of selectedSources)
{
	const bytes = nestedCheckedRecordPythonOriginal(source.revision, source.path);
	if(source.role === "verifier") assert.deepEqual(await readFile(source.path), bytes, source.path);
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
	schemaVersion: 1, kind: "nested-checked-record-python-installed-v1"
	, producerCommit: nestedCheckedRecordPythonProducer
	, checkerCommit: nestedCheckedRecordPythonVerifier
	, loadCeiling: nestedCheckedRecordPythonLoadCeiling
	, runtime: nestedCheckedRecordPythonRuntime
	, interpreters: nestedCheckedRecordPythonInterpreters
	, tapSha256: sha256(tap), selectedSources, runs
	, limitations: [
		"The fixture covers only the tested acyclic Packet, Holder, and Choice records."
		, "Checked fields are limited to Fin 10 and the tested Nat Subtype constructor."
		, "Copied acceptance covers the listed direct and container positions plus Array and Option results."
		, "Generic, recursive, inherited, open dependent, and zero-payload records remain separate work."
		, "Callback and explicitly owned positions remain separate work."
		, "These local Linux x64/glibc 2.36 runs do not establish hosted release-floor acceptance."
		, "Constructor dispatch and peak memory are unmeasured."
	]
	, files
};
await saveLakeFile(destination, "index.json", canonicalJson(index));
process.stdout.write(canonicalJson({
	evidence: nestedCheckedRecordPythonEvidence
	, indexSha256: sha256(canonicalJson(index))
	, files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0)
}));
