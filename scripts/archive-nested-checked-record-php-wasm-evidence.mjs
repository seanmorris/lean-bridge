#!/usr/bin/env node
/**
 * Validate and archive one complete local nested checked-record PHP-Wasm producer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, lstat, mkdir, readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { checkNestedCheckedRecordPhpWasmCiRecords } from "../tests/helpers/nested-checked-record-php-wasm-ci-report.mjs";
import { checkNestedCheckedRecordPhpWasmControls } from "../tests/helpers/nested-checked-record-php-wasm-controls.mjs";
import { checkNestedCheckedRecordPhpWasmReport } from "../tests/helpers/nested-checked-record-php-wasm-report.mjs";
import {
	assertNestedCheckedRecordPhpWasmTap
	, nestedCheckedRecordPhpWasmEvidence
	, nestedCheckedRecordPhpWasmEvidenceSources
	, nestedCheckedRecordPhpWasmLoadCeiling
	, nestedCheckedRecordPhpWasmOriginal
	, nestedCheckedRecordPhpWasmProducer
	, nestedCheckedRecordPhpWasmSelections
	, nestedCheckedRecordPhpWasmVerifier
} from "../tests/helpers/nested-checked-record-php-wasm-provenance.mjs";
import { saveLakeFile } from "../tests/helpers/lake-workspace.mjs";

const sourceArgument = process.argv[2];
const usage = "Usage: archive-nested-checked-record-php-wasm-evidence.mjs /absolute/producer-root";
assert.ok(typeof sourceArgument === "string" && isAbsolute(sourceArgument)
	&& resolve(sourceArgument) === sourceArgument, usage);
assert.equal(process.argv.length, 3);
const sourceRoot = sourceArgument;
const destination = resolve(nestedCheckedRecordPhpWasmEvidence);
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
const expectedControls = (records, mode) => ({
	recordControls: records * 2, semanticControls: mode === "full" ? 58 : 56
});

const runs = [];
let runtimeSnapshotSha256, runtimeIdentity, host;
for(const [route, mode] of nestedCheckedRecordPhpWasmSelections)
{
	const label = `${route}-${mode}`, selection = join(sourceRoot, label);
	const recordsRoot = join(selection, "records", route, mode);
	const paths = await nativeArtifactPaths(recordsRoot);
	assert.deepEqual(await treeFiles(recordsRoot), paths);
	const originals = new Map();
	for(const path of paths) originals.set(path, await readFile(join(recordsRoot, path)));
	const read = path => Promise.resolve(originals.get(path));
	const options = { route, mode, producerCommit: nestedCheckedRecordPhpWasmProducer };
	const checked = await checkNestedCheckedRecordPhpWasmReport(read, options);
	assert.deepEqual(paths, checked.records);
	const report = JSON.parse(originals.get("report.json"));
	assert.equal(report.loadCeiling, nestedCheckedRecordPhpWasmLoadCeiling);
	const tap = await readFile(join(selection, "run.tap"));
	assertNestedCheckedRecordPhpWasmTap(tap.toString(), route, mode);
	const before = await readFile(join(selection, "runtime-before.json"));
	const after = await readFile(join(selection, "runtime-after.json"));
	assert.deepEqual(after, before);
	const runtime = JSON.parse(before);
	const ci = await checkNestedCheckedRecordPhpWasmCiRecords({
		route, mode, producer: nestedCheckedRecordPhpWasmProducer
		, directory: recordsRoot, tap: join(selection, "run.tap")
		, runtime: join(selection, "runtime-before.json")
	}, { tap: tap.toString(), runtime, paths, read });
	assert.deepEqual(ci, checked);
	const controlled = await checkNestedCheckedRecordPhpWasmControls(
		originals, options
	);
	const controls = expectedControls(paths.length, mode);
	assert.deepEqual(controlled, controls);
	for(const [path, bytes] of originals)
		await saveLakeFile(destination, `${label}/records/${path}`, bytes);
	await saveLakeFile(destination, `${label}/run.tap`, tap);
	await saveLakeFile(destination, `${label}/runtime-before.json`, before);
	await saveLakeFile(destination, `${label}/runtime-after.json`, after);
	await saveLakeFile(destination, `${label}/controls.json`, canonicalJson(controls));
	const runtimeSha256 = sha256(before);
	if(runtimeSnapshotSha256 === undefined)
	{
		runtimeSnapshotSha256 = runtimeSha256;
		runtimeIdentity = runtime.runtime.identity; host = runtime.host;
	}
	else
	{
		assert.equal(runtimeSha256, runtimeSnapshotSha256);
		assert.equal(runtime.runtime.identity, runtimeIdentity);
		assert.deepEqual(runtime.host, host);
	}
	runs.push({
		label, route, mode, records: paths.length
		, executions: checked.executions, counts: checked.counts
		, packageFiles: checked.packageFiles
		, dispatchObserved: checked.dispatchObserved
		, loadCeiling: report.loadCeiling, controls
		, reportSha256: sha256(originals.get("report.json"))
		, tapSha256: sha256(tap), runtimeSnapshotSha256: runtimeSha256
	});
}

const selectedSources = nestedCheckedRecordPhpWasmEvidenceSources();
for(const source of selectedSources)
{
	const bytes = nestedCheckedRecordPhpWasmOriginal(source.revision, source.path);
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
	schemaVersion: 1, kind: "nested-checked-record-php-wasm-installed-v1"
	, producerCommit: nestedCheckedRecordPhpWasmProducer
	, checkerCommit: nestedCheckedRecordPhpWasmVerifier
	, loadCeiling: nestedCheckedRecordPhpWasmLoadCeiling
	, diskFloorBytes: 2 * 1024 ** 3
	, runtimeSnapshotSha256, runtimeIdentity, host, selectedSources, runs
	, limitations: [
		"The fixture covers only the tested acyclic Packet, Holder, and Choice records."
		, "Checked fields are limited to Fin 10 and the tested Nat Subtype constructor."
		, "Copied acceptance covers the listed direct and container positions plus Array and Option results."
		, "Generic, recursive, inherited, open dependent, and zero-payload records remain separate work."
		, "Callback and explicitly owned positions remain separate work."
		, "Consumer PHP source remains required when the installed package executes."
		, "These local Linux x64 runs in wasm32 PHP 8.4.1 do not establish hosted release-floor acceptance."
		, "Compiler, operating-system, browser, Node, PHP, Composer, and npm distributions remain trusted."
		, "Constructor dispatch and peak memory are unmeasured."
	]
	, files
};
await saveLakeFile(destination, "index.json", canonicalJson(index));
process.stdout.write(canonicalJson({
	evidence: nestedCheckedRecordPhpWasmEvidence
	, indexSha256: sha256(canonicalJson(index)), files: files.length
	, bytes: files.reduce((sum, file) => sum + file.bytes, 0)
}));
