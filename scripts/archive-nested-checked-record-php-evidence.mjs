#!/usr/bin/env node
/**
 * Validate and archive one complete local nested checked-record PHP producer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, lstat, mkdir, readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { checkNestedCheckedRecordPhpControls } from "../tests/helpers/nested-checked-record-php-controls.mjs";
import { checkNestedCheckedRecordPhpReport } from "../tests/helpers/nested-checked-record-php-report.mjs";
import {
	assertNestedCheckedRecordPhpEvidenceTap
	, nestedCheckedRecordPhpEvidence
	, nestedCheckedRecordPhpEvidenceSources
	, nestedCheckedRecordPhpLoadCeiling
	, nestedCheckedRecordPhpOriginal
	, nestedCheckedRecordPhpProducer
	, nestedCheckedRecordPhpRuntime
	, nestedCheckedRecordPhpSelections
	, nestedCheckedRecordPhpTools
	, nestedCheckedRecordPhpVerifier
} from "../tests/helpers/nested-checked-record-php-provenance.mjs";
import { saveLakeFile } from "../tests/helpers/lake-workspace.mjs";

const sourceArgument = process.argv[2];
const usage = "Usage: archive-nested-checked-record-php-evidence.mjs /absolute/producer-root";
assert.ok(typeof sourceArgument === "string" && isAbsolute(sourceArgument)
	&& resolve(sourceArgument) === sourceArgument, usage);
assert.equal(process.argv.length, 3);
const sourceRoot = sourceArgument, destination = resolve(nestedCheckedRecordPhpEvidence);
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
	const bytes = await readFile(from); await saveLakeFile(destination, to, bytes);
	return bytes;
};
const options = (route, mode) => ({
	route, mode, producerCommit: nestedCheckedRecordPhpProducer
	, runtime: nestedCheckedRecordPhpRuntime, floor: "2.36"
	, phpVersion: nestedCheckedRecordPhpTools.phpVersion
	, composerVersion: nestedCheckedRecordPhpTools.composerVersion
});

const tap = await readFile(join(sourceRoot, "run.tap"));
assertNestedCheckedRecordPhpEvidenceTap(tap.toString());
await saveLakeFile(destination, "producer/run.tap", tap);
const runs = [];
for(const [route, mode] of nestedCheckedRecordPhpSelections)
{
	const label = `${route}-${mode}`;
	const recordsRoot = join(sourceRoot, "records", route, mode);
	const read = path => readFile(join(recordsRoot, path));
	const result = await checkNestedCheckedRecordPhpReport(read, options(route, mode));
	assert.equal(result.loadCeiling, nestedCheckedRecordPhpLoadCeiling);
	assert.deepEqual(await treeFiles(recordsRoot), [...result.records].sort());
	for(const path of result.records)
		await copy(join(recordsRoot, path), `${label}/records/${path}`);
	const controls = await checkNestedCheckedRecordPhpControls(read, options(route, mode));
	await saveLakeFile(destination, `${label}/controls.json`, canonicalJson(controls));
	runs.push({
		label, route, mode, records: result.records.length
		, executions: result.executions, loadCeiling: result.loadCeiling
		, archiveSha256: result.archiveSha256
		, reportSha256: result.reportSha256, controls
	});
}

const selectedSources = await nestedCheckedRecordPhpEvidenceSources();
for(const source of selectedSources)
{
	const bytes = nestedCheckedRecordPhpOriginal(source.revision, source.path);
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
	schemaVersion: 1, kind: "nested-checked-record-php-installed-v1"
	, producerCommit: nestedCheckedRecordPhpProducer
	, checkerCommit: nestedCheckedRecordPhpVerifier
	, loadCeiling: nestedCheckedRecordPhpLoadCeiling
	, runtime: nestedCheckedRecordPhpRuntime, tools: nestedCheckedRecordPhpTools
	, tapSha256: sha256(tap), selectedSources, runs
	, limitations: [
		"The fixture covers only the tested acyclic Packet, Holder, and Choice records."
		, "Checked fields are limited to Fin 10 and the tested Nat Subtype constructor."
		, "Copied acceptance covers the listed direct and container positions plus Array and Option results."
		, "Generic, recursive, inherited, open dependent, and zero-payload records remain separate work."
		, "Callback and explicitly owned positions remain separate work."
		, "These local Linux x64/glibc 2.36 runs do not establish hosted release-floor acceptance."
		, "Constructor dispatch and peak memory are unmeasured; consumer PHP source remains required at runtime."
	]
	, files
};
await saveLakeFile(destination, "index.json", canonicalJson(index));
process.stdout.write(canonicalJson({
	evidence: nestedCheckedRecordPhpEvidence
	, indexSha256: sha256(canonicalJson(index))
	, files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0)
}));
