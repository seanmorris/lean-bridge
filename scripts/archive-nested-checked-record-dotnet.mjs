#!/usr/bin/env node
/**
 * Retain four accepted nested checked-record .NET selections without rebuilding.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { assertNestedCheckedRecordDotnetCiTap } from "../tests/helpers/nested-checked-record-dotnet-ci-report.mjs";
import { checkNestedCheckedRecordDotnetControls } from "../tests/helpers/nested-checked-record-dotnet-controls.mjs";
import { checkNestedCheckedRecordDotnetReport, nestedCheckedRecordDotnetRecords } from "../tests/helpers/nested-checked-record-dotnet-report.mjs";
import {
	assertNestedCheckedRecordDotnetRun
	, nestedCheckedRecordDotnetAcceptedLaunches
	, nestedCheckedRecordDotnetEvidence
	, nestedCheckedRecordDotnetEvidenceSources
	, nestedCheckedRecordDotnetLaunchPaths
	, nestedCheckedRecordDotnetLoadCeiling
	, nestedCheckedRecordDotnetOriginal
	, nestedCheckedRecordDotnetProducer
	, nestedCheckedRecordDotnetSelections
} from "../tests/helpers/nested-checked-record-dotnet-provenance.mjs";

assert.equal(process.argv.length, 2, "The four frozen launches take no arguments");
await assert.rejects(access(nestedCheckedRecordDotnetEvidence), { code: "ENOENT" });
const files = new Map(), floor = "2.36";
const put = (path, bytes) => {
	assert.ok(!files.has(path), path); files.set(path, Buffer.from(bytes));
};
const json = (bytes, path) => {
	const value = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(value), path); return value;
};
const duration = tap => {
	const matches = [...tap.toString().matchAll(/^# duration_ms ([0-9]+(?:\.[0-9]+)?)$/gmu)];
	assert.equal(matches.length, 1); return Number(matches[0][1]);
};
const expectedControls = (records, mode) => ({
	recordControls: records * 2
	, environmentControls: 28
	, packageControls: 5
	, modelControls: mode === "full" ? 5 : 4
	, executionControls: 30
});

assert.deepEqual(
	nestedCheckedRecordDotnetAcceptedLaunches.map(item => [item.route, item.mode])
	, nestedCheckedRecordDotnetSelections
);
const runner = nestedCheckedRecordDotnetOriginal(
	nestedCheckedRecordDotnetProducer
	, "scripts/run-nested-checked-record-dotnet-local.mjs"
);
const runs = []; let previousFinish = 0;
for(const launch of nestedCheckedRecordDotnetAcceptedLaunches)
{
	const { route, mode, attempt } = launch, label = `${route}-${mode}`;
	const origin = nestedCheckedRecordDotnetLaunchPaths(launch);
	const startBytes = await readFile(origin.start), endBytes = await readFile(origin.end);
	const tap = await readFile(origin.tap), verificationBytes = await readFile(origin.verification);
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
	const verification = json(verificationBytes, origin.verification);
	assertNestedCheckedRecordDotnetRun({
		start, end, tap, runner, route, mode, prefix: origin.prefix
		, producerCommit: nestedCheckedRecordDotnetProducer
		, floor, loadCeiling: nestedCheckedRecordDotnetLoadCeiling
	});
	assertNestedCheckedRecordDotnetCiTap(tap.toString(), route, mode);
	assert.ok(Date.parse(start.started) >= previousFinish, `${label} overlaps the previous selection`);
	const nuget = JSON.parse(await readFile(join(origin.records, "nuget.json")));
	const context = JSON.parse(await readFile(join(origin.records, "installation.json")));
	const records = nestedCheckedRecordDotnetRecords(route, mode, nuget, context);
	const retained = [...records
		, "handoff/package-set-receipt.json"
		, "handoff/package-set-receipt.json.sha256"
		, "handoff/archives/Nestedcheckedrecords.Api.1.0.0.nupkg"];
	assert.deepEqual((await nativeArtifactPaths(origin.records)).sort(), retained.sort());
	const read = path => readFile(join(origin.records, path));
	const options = {
		route, mode, producerCommit: nestedCheckedRecordDotnetProducer
		, runtime: verification.runtime, floor: verification.floor
		, toolchain: verification.toolchain, framework: verification.framework
		, archiveSha512: verification.archiveSha512
	};
	assert.equal(options.floor, floor);
	const checked = await checkNestedCheckedRecordDotnetReport(read, options);
	assert.deepEqual(verification, { archiveSha256: nuget.archive.sha256, ...checked });
	const controlled = await checkNestedCheckedRecordDotnetControls(read, options);
	const controls = expectedControls(records.length, mode);
	assert.deepEqual(controlled, { ...checked, ...controls });
	for(const [name, bytes] of [
		["start.json", startBytes], ["end.json", endBytes]
		, ["run.tap", tap], ["verification.json", verificationBytes]
	]) put(`${label}/producer/${name}`, bytes);
	for(const path of retained) put(`${label}/records/${path}`, await readFile(join(origin.records, path)));
	previousFinish = Date.parse(end.finished);
	runs.push({
		label, route, mode, attempt, origin
		, producerCommit: nestedCheckedRecordDotnetProducer
		, loadCeiling: nestedCheckedRecordDotnetLoadCeiling
		, started: start.started, finished: end.finished
		, durationMs: duration(tap)
		, startSha256: sha256(startBytes), endSha256: sha256(endBytes)
		, tapSha256: sha256(tap), verificationSha256: sha256(verificationBytes)
		, reportSha256: sha256(await readFile(join(origin.records, "report.json")))
		, runtime: verification.runtime, floor: verification.floor
		, toolchain: verification.toolchain, framework: verification.framework
		, archiveSha256: verification.archiveSha256
		, archiveSha512: verification.archiveSha512
		, counts: verification.counts, executions: verification.executions
		, dispatchObserved: verification.dispatchObserved
		, generatorModules: verification.generatorModules
		, records: verification.records, controls
	});
}

const selectedSources = await nestedCheckedRecordDotnetEvidenceSources();
for(const path of selectedSources)
	put("sources/" + path, nestedCheckedRecordDotnetOriginal(nestedCheckedRecordDotnetProducer, path));
const index = {
	schemaVersion: 1, kind: "nested-checked-record-dotnet-installed-v1"
	, producerCommit: nestedCheckedRecordDotnetProducer
	, loadCeiling: nestedCheckedRecordDotnetLoadCeiling
	, runs, selectedSources
	, files: [...files].sort(([left], [right]) => left.localeCompare(right))
		.map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: [
		"Local Linux x64/glibc 2.36 acceptance with an explicit 2.36 package floor, not hosted release-floor acceptance."
		, "Four ordinary/reviewed full/result-only selections reproduce complete NuGet packages from two author roots, restore offline, replay after relocation, and execute after deleting every consumer source file."
		, "Every accepted selection runs the unchanged independent C# caller three times. Full mode checks 3,924 cases with 524 expected refusals and 528 recoveries; result-only mode checks 1,290 cases without input constructors."
		, "Accepted launches ran serially on one CPU with a local load ceiling of 10. Disk and memory floors remained 2 GiB. Hosted CI refuses overrides and retains its default ceiling of 6."
		, "Complete original NuGet packages, receipts, restore inputs, API-probe diagnostics, execution records, launch records, verification output, and the exact producer source closure are retained. External toolchain binaries are represented by version, size, and digest records rather than copied."
		, "The fixture covers a checked Packet record with a Fin field and refined Word field across repeated parameters, arrays, lists, options, tuples, results, a containing record, a variant, and constructor-free outputs. It does not generalize to every nested or dependent type."
		, "Constructor/source entry counts and memory are unmeasured. Refined callbacks, owned, recursive, dependent, and broader generic refinements remain separate work. This archive does not itself promote support or establish hosted acceptance."
	]
};

await mkdir(nestedCheckedRecordDotnetEvidence);
for(const [path, bytes] of files)
{
	const target = join(nestedCheckedRecordDotnetEvidence, path);
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" });
	assert.deepEqual(await readFile(target), bytes);
}
const indexBytes = Buffer.from(canonicalJson(index));
await writeFile(join(nestedCheckedRecordDotnetEvidence, "index.json"), indexBytes, { flag: "wx" });
process.stdout.write(canonicalJson({
	destination: nestedCheckedRecordDotnetEvidence
	, files: files.size
	, bytes: [...files.values()].reduce((sum, value) => sum + value.length, 0)
	, producerCommit: nestedCheckedRecordDotnetProducer
	, indexSha256: sha256(indexBytes)
}) + "\n");
