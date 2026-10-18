#!/usr/bin/env node
/**
 * Freeze one successful hosted inherited checked-record Perl artifact after
 * every original selection and destructive control replays.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, mkdir, readFile, readdir, realpath, writeFile
} from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	assertInheritedCheckedRecordPerlCiTap
	, checkInheritedCheckedRecordPerlCiRecords
} from "../tests/helpers/inherited-checked-record-perl-ci-report.mjs";
import {
	checkInheritedCheckedRecordPerlControls
} from "../tests/helpers/inherited-checked-record-perl-controls.mjs";
import {
	inheritedCheckedRecordPerlEvidenceOriginal
	, inheritedCheckedRecordPerlEvidenceSources
} from "../tests/helpers/inherited-checked-record-perl-evidence-sources.mjs";
import {
	inheritedCheckedRecordPerlEvidence
	, inheritedCheckedRecordPerlEvidenceFloor
	, inheritedCheckedRecordPerlEvidenceLoadCeiling
	, inheritedCheckedRecordPerlSelections
} from "../tests/helpers/inherited-checked-record-perl-provenance.mjs";

const usage = "Usage: archive-inherited-checked-record-perl-evidence.mjs --root /absolute/artifact/root --producer <commit> --checker <commit> --run-id <digits> --artifact-id <digits> --artifact-name <name> --artifact-bytes <digits>";
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
		, `inherited-checked-record-perl-${selected.producer}`, usage);
	return selected;
};

let selected;
try
{
	selected = parse(process.argv.slice(2));
}
catch(error)
{
	process.stderr.write(`${error.message}\n`); process.exit(2);
}

await assert.rejects(access(inheritedCheckedRecordPerlEvidence)
	, { code: "ENOENT" });
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
const labels = inheritedCheckedRecordPerlSelections.map(
	([route, mode]) => `${route}-${mode}`
);
assert.deepEqual((await readdir(selected.root)).sort(), labels.sort());
const files = new Map();
const put = (path, bytes) => {
	assert.ok(!files.has(path), path); files.set(path, Buffer.from(bytes));
};
const controlKeys = [
	"recordControls", "resourceControls", "interpreterControls"
	, "modelControls", "executionControls", "packageControls"
];
const expectedControls = (records, mode) => ({
	recordControls: records * 2, resourceControls: 7, interpreterControls: 4
	, modelControls: mode === "full" ? 13 : 12
	, executionControls: 12, packageControls: 4
});
let runtime, interpreters;
const runs = [];
for(const [route, mode] of inheritedCheckedRecordPerlSelections)
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
	interpreters ??= report.interpreters;
	assert.deepEqual(observed.runtime, runtime, `${label} runtime drift`);
	assert.deepEqual(report.interpreters, interpreters
		, `${label} interpreter drift`);
	assert.equal(observed.floor, inheritedCheckedRecordPerlEvidenceFloor);
	assert.equal(report.loadCeiling
		, inheritedCheckedRecordPerlEvidenceLoadCeiling);
	const tap = await readFile(join(cellRoot, "run.tap"));
	assertInheritedCheckedRecordPerlCiTap(tap.toString(), route, mode);
	const checkerOptions = {
		route, mode, producer: selected.producer, directory: recordsRoot
		, tap: tap.toString(), glibc: inheritedCheckedRecordPerlEvidenceFloor
		, maxLoad: inheritedCheckedRecordPerlEvidenceLoadCeiling
		, runtime, interpreters, paths
	};
	const checked = await checkInheritedCheckedRecordPerlCiRecords({
		...checkerOptions, read: originalRead
	});
	assert.equal(verification.toString(), canonicalJson(checked)
		, `${label} hosted checker output`);
	const controlled = await checkInheritedCheckedRecordPerlControls(
		originalRead, checkerOptions
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
		, tapSha256: sha256(tap), verificationSha256: sha256(verification)
	});
}

const selectedSources = await inheritedCheckedRecordPerlEvidenceSources(
	revisions
);
for(const source of selectedSources)
	put(`sources/${source.role}/${source.path}`
		, inheritedCheckedRecordPerlEvidenceOriginal(
			source.revision, source.path
		)
	);
const runId = Number(selected["run-id"]);
const artifact = {
	id: Number(selected["artifact-id"]), name: selected["artifact-name"]
	, bytes: Number(selected["artifact-bytes"])
};
const index = {
	schemaVersion: 1, kind: "inherited-checked-record-perl-installed-v1"
	, producerCommit: revisions.producer, checkerCommit: revisions.checker
	, archiveCommit, runtime, interpreters
	, floor: inheritedCheckedRecordPerlEvidenceFloor
	, loadCeiling: inheritedCheckedRecordPerlEvidenceLoadCeiling
	, hostedRun: {
		repository: "seanmorris/lean-bridge", runId
		, url: `https://github.com/seanmorris/lean-bridge/actions/runs/${runId}`
		, artifact
	}
	, runs, selectedSources
	, limitations: [
		"The fixture covers inherited parent subobjects, child checked fields, aliases, nested inheritance, repeated constructor selections, and constructor-free results."
		, "Ordinary and independently reviewed sources are exercised in full and result-only CPAN packages through an independent Perl caller."
		, "Both prepared archives reproduce from independent author roots, install offline through prebuilt and generated XS modes, execute source-free, relocate, and replay unchanged."
		, "Every cell covers threaded and unthreaded Perl 5.36.3 and 5.38.2 interpreters, for sixteen installed executions per selection."
		, "Complete CPAN archives, receipts, inventories, execution records, TAP, controls, and producer/checker/archive source closures are retained."
		, "The package floor is glibc 2.38; compiler, operating system, interpreter, native toolchain, and glibc distributions remain trusted inputs."
		, "This archive establishes installed Perl behavior, not promotion into the public support inventory."
	]
	, files: [...files].sort(([left], [right]) =>
		left.localeCompare(right)).map(([path, bytes]) => ({
		path, bytes: bytes.length, sha256: sha256(bytes)
		}))
};

await mkdir(inheritedCheckedRecordPerlEvidence);
for(const [path, bytes] of files)
{
	const target = join(inheritedCheckedRecordPerlEvidence, path);
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" });
}
const indexBytes = Buffer.from(canonicalJson(index));
await writeFile(join(inheritedCheckedRecordPerlEvidence, "index.json")
	, indexBytes, { flag: "wx" });
const evidenceBytes = [...files.values()].reduce(
	(total, bytes) => total + bytes.length, indexBytes.length
);
process.stdout.write(canonicalJson({
	destination: inheritedCheckedRecordPerlEvidence, files: files.size + 1
	, bytes: evidenceBytes, ...revisions, runId, artifact
	, indexSha256: sha256(indexBytes)
}));
