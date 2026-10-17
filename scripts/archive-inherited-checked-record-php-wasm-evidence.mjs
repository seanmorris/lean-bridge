#!/usr/bin/env node
/**
 * Freeze one successful hosted inherited checked-record PHP-Wasm artifact.
 * Every original selection and corruption control replays before any write.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, mkdir, readFile, readdir, realpath, writeFile
} from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import {
	checkInheritedCheckedRecordPhpWasmCiRecords
} from "../tests/helpers/inherited-checked-record-php-wasm-ci-report.mjs";
import {
	checkInheritedCheckedRecordPhpWasmControls
} from "../tests/helpers/inherited-checked-record-php-wasm-controls.mjs";
import {
	checkInheritedCheckedRecordPhpWasmReport
} from "../tests/helpers/inherited-checked-record-php-wasm-report.mjs";
import {
	inheritedCheckedRecordPhpWasmEvidenceSources
} from "../tests/helpers/inherited-checked-record-php-wasm-evidence-sources.mjs";
import {
	inheritedCheckedRecordPhpWasmOriginal
} from "../tests/helpers/inherited-checked-record-php-wasm-sources.mjs";
import {
	inheritedCheckedRecordPhpWasmSelections
} from "../tests/helpers/inherited-checked-record-php-wasm-selections.mjs";

const usage = "Usage: archive-inherited-checked-record-php-wasm-evidence.mjs --root /absolute/artifact/root --producer <commit> --checker <commit> --run-id <digits>";
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

const evidence = "docs/evidence/inherited-checked-record-php-wasm-20261017";
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
const labels = inheritedCheckedRecordPhpWasmSelections.map(
	([route, mode]) => `${route}-${mode}`
);
assert.deepEqual((await readdir(selected.root)).sort(), labels.sort());
const files = new Map();
const put = (path, bytes) => {
	assert.ok(!files.has(path), path); files.set(path, Buffer.from(bytes));
};
let runtimeSnapshotSha256, runtimeIdentity, host;
const runs = [];
for(const [route, mode] of inheritedCheckedRecordPhpWasmSelections)
{
	const label = `${route}-${mode}`;
	const cellRoot = join(selected.root, label);
	assert.deepEqual((await readdir(cellRoot)).sort(), [
		"records", "run.tap", "runtime-after.json", "runtime-after.log"
		, "runtime-before.json", "runtime-before.log", "verification.json"
	]);
	const recordsRoot = join(cellRoot, "records", route, mode);
	const paths = await nativeArtifactPaths(recordsRoot);
	const originals = new Map();
	for(const path of paths)
		originals.set(path, await readFile(join(recordsRoot, path)));
	const read = path => {
		assert.ok(originals.has(path), path);
		return Promise.resolve(originals.get(path));
	};
	const options = { route, mode, producerCommit: revisions.producer };
	const checked = await checkInheritedCheckedRecordPhpWasmReport(read, options);
	assert.deepEqual(paths, checked.records);
	const tap = await readFile(join(cellRoot, "run.tap"));
	const before = await readFile(join(cellRoot, "runtime-before.json"));
	const after = await readFile(join(cellRoot, "runtime-after.json"));
	const beforeLog = await readFile(join(cellRoot, "runtime-before.log"));
	const afterLog = await readFile(join(cellRoot, "runtime-after.log"));
	assert.deepEqual(after, before);
	const runtime = JSON.parse(before);
	assert.equal(runtime.schemaVersion, 1);
	assert.equal(runtime.producerCommit, revisions.producer);
	const ci = await checkInheritedCheckedRecordPhpWasmCiRecords({
		route, mode, producer: revisions.producer, directory: recordsRoot
		, tap: join(cellRoot, "run.tap")
		, runtime: join(cellRoot, "runtime-before.json")
	}, { tap: tap.toString(), runtime, paths, read });
	assert.deepEqual(ci, checked);
	const verification = await readFile(join(cellRoot, "verification.json"));
	assert.equal(verification.toString(), canonicalJson(checked)
		, `${label} hosted checker output`);
	const controls = await checkInheritedCheckedRecordPhpWasmControls(
		originals, options
	);
	for(const [path, bytes] of originals)
		put(`${label}/records/${path}`, bytes);
	for(const [name, bytes] of [
		["run.tap", tap], ["runtime-before.json", before]
		, ["runtime-after.json", after], ["runtime-before.log", beforeLog]
		, ["runtime-after.log", afterLog], ["verification.json", verification]
	]) put(`${label}/${name}`, bytes);
	put(`${label}/controls.json`, Buffer.from(canonicalJson(controls)));
	const runtimeSha256 = sha256(before);
	if(runtimeSnapshotSha256 === undefined)
	{
		runtimeSnapshotSha256 = runtimeSha256;
		runtimeIdentity = runtime.runtime.identity;
		host = runtime.host;
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
		, loadCeiling: JSON.parse(originals.get("report.json")).loadCeiling
		, controls, reportSha256: sha256(originals.get("report.json"))
		, tapSha256: sha256(tap), runtimeSnapshotSha256: runtimeSha256
		, runtimeBeforeLogSha256: sha256(beforeLog)
		, runtimeAfterLogSha256: sha256(afterLog)
		, verificationSha256: sha256(verification)
	});
}

const selectedSources = inheritedCheckedRecordPhpWasmEvidenceSources(revisions);
for(const source of selectedSources)
	put(`sources/${source.role}/${source.path}`
		, inheritedCheckedRecordPhpWasmOriginal(source.revision, source.path));
const runId = Number(selected["run-id"]);
const index = {
	schemaVersion: 1, kind: "inherited-checked-record-php-wasm-installed-v1"
	, producerCommit: revisions.producer, checkerCommit: revisions.checker
	, archiveCommit, loadCeiling: 8, diskFloorBytes: 2 * 1024 ** 3
	, runtimeSnapshotSha256, runtimeIdentity, host
	, hostedRun: {
		repository: "seanmorris/lean-bridge", runId
		, url: `https://github.com/seanmorris/lean-bridge/actions/runs/${runId}`
	}
	, selectedSources, runs
	, limitations: [
		"The fixture covers inherited parent subobjects, checked child fields, aliases, nested inheritance, repeated constructor selections, and proof-free results."
		, "Ordinary and independently reviewed sources are exercised in full and result-only prepared package sets."
		, "Each package set contains the Composer API, npm component, and shared npm runtime archives reproduced from two author roots."
		, "Offline consumers execute after source and handoff removal, before and after relocation, in twelve Node and Chromium loading contexts."
		, "Complete archives, receipts, callers, execution records, TAP, and producer, checker, and archiver source closures are retained."
		, "Consumer PHP source remains required when the installed package executes."
		, "Compiler, operating-system, browser, Node, PHP, Composer, and npm distributions remain trusted inputs."
		, "This archive establishes installed PHP-Wasm behavior, not promotion into the public support inventory."
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
