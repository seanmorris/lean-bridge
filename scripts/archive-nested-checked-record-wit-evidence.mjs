#!/usr/bin/env node
/**
 * Validate and archive one complete local nested checked-record WIT producer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, lstat, mkdir, readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { checkNestedCheckedRecordWitControls } from "../tests/helpers/nested-checked-record-wit-controls.mjs";
import { inspectNestedCheckedRecordWitHandoff } from "../tests/helpers/nested-checked-record-wit-handoff.mjs";
import { checkNestedCheckedRecordWitReport } from "../tests/helpers/nested-checked-record-wit-report.mjs";
import {
	assertNestedCheckedRecordWitEvidenceTap
	, nestedCheckedRecordWitEvidence
	, nestedCheckedRecordWitEvidenceSources
	, nestedCheckedRecordWitLoadCeiling
	, nestedCheckedRecordWitOriginal
	, nestedCheckedRecordWitProducer
	, nestedCheckedRecordWitRuntime
	, nestedCheckedRecordWitSelections
	, nestedCheckedRecordWitTools
	, nestedCheckedRecordWitVerifier
} from "../tests/helpers/nested-checked-record-wit-provenance.mjs";
import { saveLakeFile } from "../tests/helpers/lake-workspace.mjs";

const sourceArgument = process.argv[2];
const usage = "Usage: archive-nested-checked-record-wit-evidence.mjs /absolute/producer-root";
assert.ok(typeof sourceArgument === "string" && isAbsolute(sourceArgument)
	&& resolve(sourceArgument) === sourceArgument, usage);
assert.equal(process.argv.length, 3);
const sourceRoot = sourceArgument;
const destination = resolve(nestedCheckedRecordWitEvidence);
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
const options = (route, mode) => ({
	route, mode, producerCommit: nestedCheckedRecordWitProducer
	, runtime: nestedCheckedRecordWitRuntime, floor: "2.36"
});
const controlKeys = ["recordControls", "executionControls", "toolControls"
	, "resourceControls", "environmentControls", "packageControls"
	, "modelControls"];

const tap = await readFile(join(sourceRoot, "run.tap"));
assertNestedCheckedRecordWitEvidenceTap(tap.toString());
await saveLakeFile(destination, "producer/run.tap", tap);
const runs = [];
for(const [route, mode] of nestedCheckedRecordWitSelections)
{
	const label = `${route}-${mode}`;
	const recordsRoot = join(sourceRoot, "records", route, mode);
	const originalRead = path => readFile(join(recordsRoot, path));
	const handoff = await inspectNestedCheckedRecordWitHandoff(originalRead);
	const read = path => handoff.supplements.get(path) ?? originalRead(path);
	const result = await checkNestedCheckedRecordWitReport(
		read, options(route, mode)
	);
	assert.equal(result.loadCeiling, nestedCheckedRecordWitLoadCeiling);
	const actualRecords = result.records.filter(path =>
		!handoff.supplements.has(path)).concat(handoff.archivePath).sort();
	assert.deepEqual(await treeFiles(recordsRoot), actualRecords);
	for(const path of actualRecords)
		await copy(join(recordsRoot, path), `${label}/records/${path}`);
	const controlled = await checkNestedCheckedRecordWitControls(
		read, options(route, mode)
	);
	const stored = JSON.parse(await readFile(join(
		sourceRoot, "controls", `${label}.json`
	)));
	assert.equal(stored.schemaVersion, 1);
	assert.equal(stored.route, route); assert.equal(stored.mode, mode);
	assert.equal(stored.producerCommit, nestedCheckedRecordWitProducer);
	assert.deepEqual(stored.accepted, result);
	assert.deepEqual(stored.controls, controlled);
	const controls = Object.fromEntries(controlKeys.map(key =>
		[key, controlled[key]]));
	await saveLakeFile(destination, `${label}/controls.json`
		, canonicalJson(controls));
	runs.push({
		label, route, mode, records: result.records.length
		, executions: result.executions, loadCeiling: result.loadCeiling
		, archiveSha256: result.archiveSha256
		, reportSha256: result.reportSha256, controls
	});
}

const selectedSources = await nestedCheckedRecordWitEvidenceSources();
for(const source of selectedSources)
{
	const bytes = nestedCheckedRecordWitOriginal(source.revision, source.path);
	if(source.role === "verifier")
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
	schemaVersion: 1, kind: "nested-checked-record-wit-installed-v1"
	, producerCommit: nestedCheckedRecordWitProducer
	, checkerCommit: nestedCheckedRecordWitVerifier
	, loadCeiling: nestedCheckedRecordWitLoadCeiling
	, runtime: nestedCheckedRecordWitRuntime, tools: nestedCheckedRecordWitTools
	, tapSha256: sha256(tap), selectedSources, runs
	, limitations: [
		"The fixture covers only the tested acyclic Packet, Holder, and Choice records."
		, "Checked fields are limited to Fin 10 and the tested Nat Subtype constructor."
		, "Copied acceptance covers the listed direct and container positions plus Array and Option results."
		, "Generic, recursive, inherited, open dependent, and zero-payload records remain separate work."
		, "Callback and explicitly owned positions remain separate work."
		, "The Component Model adapter requires its packaged native host and is not a standalone WASI command."
		, "These local Linux x64/glibc 2.36 runs do not establish hosted release-floor acceptance."
		, "Compiler, operating-system, wasm-tools, and Wasmtime distributions remain trusted."
		, "Constructor dispatch and peak memory are unmeasured."
	]
	, files
};
await saveLakeFile(destination, "index.json", canonicalJson(index));
process.stdout.write(canonicalJson({
	evidence: nestedCheckedRecordWitEvidence
	, indexSha256: sha256(canonicalJson(index))
	, files: files.length
	, bytes: files.reduce((sum, file) => sum + file.bytes, 0)
}));
