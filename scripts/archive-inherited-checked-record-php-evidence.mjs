#!/usr/bin/env node
/**
 * Freeze one successful hosted inherited checked-record native PHP artifact.
 * The archive is written only after every original selection and control replays.
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
	assertInheritedCheckedRecordPhpCiTap
	, checkInheritedCheckedRecordPhpCiRecords
} from "../tests/helpers/inherited-checked-record-php-ci-report.mjs";
import {
	checkInheritedCheckedRecordPhpControls
} from "../tests/helpers/inherited-checked-record-php-controls.mjs";
import {
	assertNominalSubtypePhpToolRecords
} from "../tests/helpers/nominal-subtype-php-tool-records.mjs";
import {
	inheritedCheckedRecordPhpEvidenceOriginal
	, inheritedCheckedRecordPhpEvidenceSources
} from "../tests/helpers/inherited-checked-record-php-evidence-sources.mjs";
import {
	inheritedCheckedRecordPhpEvidenceFloor
	, inheritedCheckedRecordPhpEvidenceLoadCeiling
	, inheritedCheckedRecordPhpSelections
} from "../tests/helpers/inherited-checked-record-php-provenance.mjs";

const usage = "Usage: archive-inherited-checked-record-php-evidence.mjs --root /absolute/artifact/root --producer <commit> --checker <commit> --run-id <digits> --artifact-id <digits> --artifact-name <name> --artifact-bytes <digits>";
const allowed = [
	"root", "producer", "checker", "run-id"
	, "artifact-id", "artifact-name", "artifact-bytes"
];
const parse = args => {
	assert.equal(args.length, allowed.length * 2, usage);
	const selected = {};
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(flag.startsWith("--") && allowed.includes(flag.slice(2))
			, usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && value
			&& !value.startsWith("--") && !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.ok(isAbsolute(selected.root), usage);
	for(const key of ["producer", "checker"])
		assert.match(selected[key], /^[a-f0-9]{40}$/u, usage);
	for(const key of ["run-id", "artifact-id", "artifact-bytes"])
		assert.match(selected[key], /^[1-9][0-9]*$/u, usage);
	assert.equal(selected["artifact-name"]
		, `inherited-checked-record-php-${selected.producer}`, usage);
	return selected;
};

let selected;
try
{ selected = parse(process.argv.slice(2)); }
catch(error)
{ process.stderr.write(`${error.message}\n`); process.exit(2); }

const evidence = "docs/evidence/inherited-checked-record-php-20261017";
await assert.rejects(access(evidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
const revisions = {
	producer: selected.producer, checker: selected.checker
	, archiver: archiveCommit
};
assert.equal(await realpath(selected.root), selected.root);
const labels = inheritedCheckedRecordPhpSelections.map(
	([route, mode]) => `${route}-${mode}`);
assert.deepEqual((await readdir(selected.root)).sort()
	, [...labels, "tools.json"].sort());
const files = new Map();
const put = (path, bytes) => {
	assert.ok(!files.has(path), path); files.set(path, Buffer.from(bytes));
};
const controlKeys = [
	"recordControls", "resourceControls", "environmentControls"
	, "packageControls", "modelControls", "executionControls", "toolControls"
];
const expectedControls = (records, mode) => ({
	recordControls: records * 2, resourceControls: 7
	, environmentControls: 10, packageControls: 4, toolControls: 12
	, modelControls: mode === "full" ? 7 : 6, executionControls: 48
});
const producerToolsBytes = await readFile(join(selected.root, "tools.json"));
const producerTools = JSON.parse(producerToolsBytes);
let runtime, tools, phpVersion, composerVersion;
const runs = [];
for(const [route, mode] of inheritedCheckedRecordPhpSelections)
{
	const label = `${route}-${mode}`;
	const cellRoot = join(selected.root, label);
	assert.deepEqual((await readdir(cellRoot)).sort()
		, ["records", "run.tap", "verification.json"]);
	const recordsRoot = join(cellRoot, "records", route, mode);
	const paths = await nativeArtifactPaths(recordsRoot);
	const originalRead = path => readFile(join(recordsRoot, path));
	const report = JSON.parse(await originalRead("report.json"));
	const verification = await readFile(join(cellRoot, "verification.json"));
	const observed = JSON.parse(verification);
	runtime ??= observed.runtime;
	phpVersion ??= observed.phpVersion;
	composerVersion ??= observed.composerVersion;
	const currentTools = JSON.parse(await originalRead("tools.json"));
	tools ??= currentTools;
	assert.deepEqual(observed.runtime, runtime, `${label} runtime drift`);
	assert.equal(observed.phpVersion, phpVersion, `${label} PHP drift`);
	assert.equal(observed.composerVersion, composerVersion
		, `${label} Composer drift`);
	assert.deepEqual(observed.tools, tools, `${label} checker tool drift`);
	assert.deepEqual(currentTools, tools, `${label} tool drift`);
	assert.equal(observed.floor, inheritedCheckedRecordPhpEvidenceFloor);
	assert.equal(report.loadCeiling
		, inheritedCheckedRecordPhpEvidenceLoadCeiling);
	assert.equal(runtime.platform, "linux");
	assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.split(".")[1]) >= 38);
	assertNominalSubtypePhpToolRecords(tools, {
		phpVersion, composerVersion
	});
	const tap = await readFile(join(cellRoot, "run.tap"));
	assertInheritedCheckedRecordPhpCiTap(tap.toString(), route, mode);
	const options = {
		route, mode, producer: selected.producer, directory: recordsRoot
		, tap: join(cellRoot, "run.tap")
		, glibc: inheritedCheckedRecordPhpEvidenceFloor
		, php: tools.command, composer: tools.composer
		, "php-version": phpVersion, "composer-version": composerVersion
	};
	const checked = await checkInheritedCheckedRecordPhpCiRecords(options, {
		tap: tap.toString(), read: originalRead, runtime, tools
		, archiveSha256: report.receipt.packages[0].artifacts[0].sha256
	});
	assert.equal(verification.toString(), canonicalJson(checked)
		, `${label} hosted checker output`);
	assert.deepEqual(paths, [...checked.records].sort());
	const controlled = await checkInheritedCheckedRecordPhpControls(
		originalRead, {
			route, mode, producerCommit: selected.producer, runtime
			, floor: inheritedCheckedRecordPhpEvidenceFloor
			, phpVersion, composerVersion
		}
	);
	const controls = Object.fromEntries(controlKeys.map(key =>
		[key, controlled[key]]));
	assert.deepEqual(controls, expectedControls(checked.records.length, mode));
	for(const path of paths)
		put(`${label}/records/${path}`, await originalRead(path));
	put(`${label}/run.tap`, tap);
	put(`${label}/verification.json`, verification);
	put(`${label}/controls.json`, Buffer.from(canonicalJson(controls)));
	runs.push({
		label, route, mode, recordCount: paths.length, accepted: checked
		, controls, reportSha256: sha256(await originalRead("report.json"))
		, archiveSha256: checked.archiveSha256
		, tapSha256: sha256(tap)
		, verificationSha256: sha256(verification)
	});
}

assert.deepEqual(producerTools, tools, "producer tool selection drift");
put("producer/tools.json", producerToolsBytes);

const selectedSources = await inheritedCheckedRecordPhpEvidenceSources(
	revisions);
for(const source of selectedSources)
	put(`sources/${source.role}/${source.path}`
		, inheritedCheckedRecordPhpEvidenceOriginal(
			source.revision, source.path));
const runId = Number(selected["run-id"]);
const artifact = {
	id: Number(selected["artifact-id"]), name: selected["artifact-name"]
	, bytes: Number(selected["artifact-bytes"])
};
const index = {
	schemaVersion: 1, kind: "inherited-checked-record-php-installed-v1"
	, producerCommit: revisions.producer, checkerCommit: revisions.checker
	, archiveCommit, runtime, tools
	, floor: inheritedCheckedRecordPhpEvidenceFloor
	, loadCeiling: inheritedCheckedRecordPhpEvidenceLoadCeiling
	, hostedRun: {
		repository: "seanmorris/lean-bridge", runId
		, url: `https://github.com/seanmorris/lean-bridge/actions/runs/${runId}`
		, artifact
	}
	, runs, selectedSources
	, limitations: [
		"The fixture covers inherited parent subobjects, child checked fields, aliases, nested inheritance, repeated constructor selections, and constructor-free results."
		, "Ordinary and independently reviewed sources are exercised in full and result-only Composer packages through an independent PHP caller."
		, "Complete Composer ZIPs are reproduced, installed offline, executed before and after relocation, and replayed without Lean sources or compilers."
		, "Complete package archives, receipts, inventories, probes, execution records, TAP, controls, and producer/checker/archive source closures are retained."
		, "The package floor is glibc 2.38; the archive records and verifies the hosted runner's independently observed glibc and PHP tool identities."
		, "Compiler, operating system, PHP interpreter, Composer implementation, native toolchain, and glibc distributions remain trusted inputs."
		, "This archive establishes installed PHP behavior, not promotion into the public support inventory."
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
const evidenceBytes = [...files.values()].reduce(
	(total, bytes) => total + bytes.length, indexBytes.length);
process.stdout.write(canonicalJson({
	destination: evidence, files: files.size + 1, bytes: evidenceBytes
	, ...revisions, runId, artifact, indexSha256: sha256(indexBytes)
}));
