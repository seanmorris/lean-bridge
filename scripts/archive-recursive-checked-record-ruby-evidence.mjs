#!/usr/bin/env node
/**
 * Validate and archive one complete local recursive checked-record Ruby producer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, lstat, mkdir, readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { checkRecursiveCheckedRecordRubyControls } from "../tests/helpers/recursive-checked-record-ruby-controls.mjs";
import {
	assertRecursiveCheckedRecordRubyEvidenceTap
	, recursiveCheckedRecordRubyEvidence
	, recursiveCheckedRecordRubyEvidenceSources
	, recursiveCheckedRecordRubyInterpreter
	, recursiveCheckedRecordRubyLoadCeiling
	, recursiveCheckedRecordRubyOriginal
	, recursiveCheckedRecordRubyProducer
	, recursiveCheckedRecordRubyRuntime
	, recursiveCheckedRecordRubySelections
	, recursiveCheckedRecordRubyVerifier
} from "../tests/helpers/recursive-checked-record-ruby-provenance.mjs";
import { saveLakeFile } from "../tests/helpers/lake-workspace.mjs";

const sourceArgument = process.argv[2];
const usage = "Usage: archive-recursive-checked-record-ruby-evidence.mjs /absolute/producer-root";
assert.ok(typeof sourceArgument === "string" && isAbsolute(sourceArgument)
	&& resolve(sourceArgument) === sourceArgument, usage);
assert.equal(process.argv.length, 3);
const sourceRoot = sourceArgument, destination = resolve(recursiveCheckedRecordRubyEvidence);
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
const options = (route, fixture) => ({
	route, fixture, producerCommit: recursiveCheckedRecordRubyProducer
	, runtime: recursiveCheckedRecordRubyRuntime, floor: "2.36"
	, rubyVersion: recursiveCheckedRecordRubyInterpreter.version
});
const controlKeys = ["recordControls", "resourceControls", "modelControls"
	, "environmentControls", "packageControls", "executionControls"];

// The runner appends its own exit status after the unchanged TAP stream.
const log = await readFile(join(sourceRoot, "run.tap"));
assert.ok(log.toString().endsWith("\nexit 0\n"), "Producer runner did not exit successfully");
assertRecursiveCheckedRecordRubyEvidenceTap(log.toString().slice(0, -"exit 0\n".length));
await saveLakeFile(destination, "producer/run.tap", log);
const runner = await copy(join(sourceRoot, "runner.sh"), "producer/runner.sh");
assert.ok(runner.toString().includes(`= ${recursiveCheckedRecordRubyProducer} ||`), "Runner pins another revision");
const queue = JSON.parse(await copy(join(sourceRoot, "runner.queue"), "producer/runner.queue"));
assert.equal(queue.revision, recursiveCheckedRecordRubyProducer);
assert.equal(queue.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
const runs = [];
for(const [route, fixture] of recursiveCheckedRecordRubySelections)
{
	const label = `${route}-${fixture}`, recordsRoot = join(sourceRoot, "records", route, fixture);
	const read = path => readFile(join(recordsRoot, path));
	const result = await checkRecursiveCheckedRecordRubyControls(read, options(route, fixture));
	assert.equal(result.loadCeiling, recursiveCheckedRecordRubyLoadCeiling);
	assert.deepEqual(await treeFiles(recordsRoot), result.recordPaths);
	for(const path of result.recordPaths) await copy(join(recordsRoot, path), `${label}/records/${path}`);
	const controls = Object.fromEntries(controlKeys.map(key => [key, result[key]]));
	await saveLakeFile(destination, `${label}/controls.json`, canonicalJson(controls));
	runs.push({
		label, route, fixture, counts: result.counts, records: result.records
		, executions: result.executions, loadCeiling: result.loadCeiling
		, archiveSha256: result.archiveSha256, reportSha256: result.reportSha256
		, controls
	});
}

const selectedSources = recursiveCheckedRecordRubyEvidenceSources();
for(const source of selectedSources)
{
	const bytes = recursiveCheckedRecordRubyOriginal(source.revision, source.path);
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
	schemaVersion: 1, kind: "recursive-checked-record-ruby-installed-v1"
	, producerCommit: recursiveCheckedRecordRubyProducer
	, checkerCommit: recursiveCheckedRecordRubyVerifier
	, loadCeiling: recursiveCheckedRecordRubyLoadCeiling
	, runtime: recursiveCheckedRecordRubyRuntime
	, interpreter: recursiveCheckedRecordRubyInterpreter
	, logSha256: sha256(log), selectedSources, runs
	, limitations: [
		"The fixtures cover self-recursive Packet and mutual Envelope/Step groups with Option and Array carriers."
		, "Checked fields are limited to Fin 3 and the tested plusOne/plusTwo Nat Subtype constructors."
		, "Each gem is a graph-transport copied package; Lean fields named like reserved Ruby members are escaped with one trailing underscore; callbacks, resources and owned positions remain separate work."
		, "These local Linux x64/glibc 2.36 runs do not establish hosted release-floor acceptance."
		, "Constructor dispatch and peak memory are unmeasured."
	]
	, files
};
await saveLakeFile(destination, "index.json", canonicalJson(index));
process.stdout.write(canonicalJson({
	evidence: recursiveCheckedRecordRubyEvidence
	, indexSha256: sha256(canonicalJson(index))
	, files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0)
}));
