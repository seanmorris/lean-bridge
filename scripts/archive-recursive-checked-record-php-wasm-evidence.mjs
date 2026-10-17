#!/usr/bin/env node
/**
 * Validate and archive one complete serial recursive checked-record PHP-Wasm producer root.
 * Each selection keeps the hosted-runner layout: runtime snapshots, TAP, verification and records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, lstat, mkdir, readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { checkRecursiveCheckedRecordPhpWasmCiRecords } from "../tests/helpers/recursive-checked-record-php-wasm-ci-report.mjs";
import {
	recursiveCheckedRecordPhpWasmEvidence, recursiveCheckedRecordPhpWasmEvidenceLoadCeiling
	, recursiveCheckedRecordPhpWasmEvidenceSources, recursiveCheckedRecordPhpWasmExpectedControls
	, recursiveCheckedRecordPhpWasmOriginal, recursiveCheckedRecordPhpWasmPinnedRevisions
	, recursiveCheckedRecordPhpWasmSelections
} from "../tests/helpers/recursive-checked-record-php-wasm-provenance.mjs";
import { saveLakeFile } from "../tests/helpers/lake-workspace.mjs";

const usage = "Usage: archive-recursive-checked-record-php-wasm-evidence.mjs /absolute/producer-root";
const sourceRoot = process.argv[2];
assert.ok(typeof sourceRoot === "string" && isAbsolute(sourceRoot) && resolve(sourceRoot) === sourceRoot, usage);
assert.equal(process.argv.length, 3, usage);
const { producer, verifier } = recursiveCheckedRecordPhpWasmPinnedRevisions();
const destination = resolve(recursiveCheckedRecordPhpWasmEvidence);
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
const cellFiles = ["run.tap", "runtime-after.json", "runtime-after.log", "runtime-before.json", "runtime-before.log", "verification.json"];

const runs = [], expectedRoot = [];
let runtimeSnapshotSha256, runtimeIdentity, host;
for(const [route, fixture] of recursiveCheckedRecordPhpWasmSelections)
{
	const label = `${route}-${fixture}`, selection = join(sourceRoot, label);
	const recordsRoot = join(selection, "records", route, fixture), records = new Map();
	for(const path of await treeFiles(recordsRoot)) records.set(path, await readFile(join(recordsRoot, path)));
	const tap = await readFile(join(selection, "run.tap"));
	const before = await readFile(join(selection, "runtime-before.json")), after = await readFile(join(selection, "runtime-after.json"));
	assert.deepEqual(after, before, `${label} runtime drifted during the producer`);
	const runtime = JSON.parse(before);
	// Exactly the hosted checker: TAP, host binding, report, inventory and every control.
	const ciOptions = { route, fixture, producer, directory: recordsRoot
		, tap: join(selection, "run.tap")
		, runtime: join(selection, "runtime-before.json") };
	const checked = await checkRecursiveCheckedRecordPhpWasmCiRecords(ciOptions
		, { tap: tap.toString(), runtime, records });
	const report = JSON.parse(records.get("report.json"));
	assert.equal(report.loadCeiling, recursiveCheckedRecordPhpWasmEvidenceLoadCeiling);
	const controls = recursiveCheckedRecordPhpWasmExpectedControls(checked.records.length);
	assert.deepEqual(checked.controls, controls);
	const verification = await readFile(join(selection, "verification.json"));
	assert.equal(verification.toString(), canonicalJson(checked), `${label} retained checker output`);
	for(const path of cellFiles) await saveLakeFile(destination, `${label}/${path}`, await readFile(join(selection, path)));
	for(const [path, bytes] of records) await saveLakeFile(destination, `${label}/records/${path}`, bytes);
	expectedRoot.push(...cellFiles.map(path => `${label}/${path}`), ...[...records.keys()].map(path => `${label}/records/${route}/${fixture}/${path}`));
	if(runtimeSnapshotSha256 === undefined)
	{
		runtimeSnapshotSha256 = sha256(before); runtimeIdentity = runtime.runtime.identity; host = runtime.host;
	}
	else
	{
		assert.equal(sha256(before), runtimeSnapshotSha256); assert.equal(runtime.runtime.identity, runtimeIdentity);
		assert.deepEqual(runtime.host, host);
	}
	runs.push({ label, route, fixture
		, records: checked.records.length
		, executions: checked.executions, counts: checked.counts
		, packageFiles: checked.packageFiles
		, dispatchObserved: checked.dispatchObserved
		, loadCeiling: report.loadCeiling, controls
		, reportSha256: checked.reportSha256, tapSha256: sha256(tap)
		, verificationSha256: sha256(verification)
		, runtimeSnapshotSha256: sha256(before) });
}
// The producer root holds exactly the four selections, with no partial or extra output.
assert.deepEqual(await treeFiles(sourceRoot), expectedRoot.sort());

const selectedSources = recursiveCheckedRecordPhpWasmEvidenceSources();
for(const source of selectedSources)
{
	const bytes = recursiveCheckedRecordPhpWasmOriginal(source.revision, source.path);
	// The executing checker must be the frozen verifier, not a later checkout.
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
	schemaVersion: 1, kind: "recursive-checked-record-php-wasm-installed-v1"
	, producerCommit: producer, checkerCommit: verifier
	, loadCeiling: recursiveCheckedRecordPhpWasmEvidenceLoadCeiling
	, diskFloorBytes: 2 * 1024 ** 3
	, runtimeSnapshotSha256, runtimeIdentity, host, selectedSources, runs
	, limitations: [
		"The fixtures cover the self-recursive Packet graph and the mutually recursive Envelope/Step graph with Option and Array carriers."
		, "Checked fields are limited to Fin 3 and the tested plusOne/plusTwo Nat Subtype constructors."
		, "The PHP-Wasm caller reuses the native-PHP caller and oracle byte for byte; acceptance does not follow from native PHP and every cell runs inside wasm32 PHP-Wasm."
		, "Generic, inherited, open dependent and zero-payload records, callbacks and explicitly owned positions remain separate work."
		, "Consumer PHP source remains required when the installed package executes."
		, "These local Linux x64 runs do not establish hosted release-floor acceptance."
		, "Compiler, operating-system, browser, Node, PHP, Composer and npm distributions remain trusted."
		, "Constructor dispatch and peak memory are unmeasured."
	]
	, files
};
await saveLakeFile(destination, "index.json", canonicalJson(index));
process.stdout.write(canonicalJson({ evidence: recursiveCheckedRecordPhpWasmEvidence
	, indexSha256: sha256(canonicalJson(index)), files: files.length
	, bytes: files.reduce((sum, file) => sum + file.bytes, 0) }) + "\n");
