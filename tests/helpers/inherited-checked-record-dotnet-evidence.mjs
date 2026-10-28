/**
 * Authenticate the immutable hosted inherited checked-record .NET archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { inheritedCheckedRecordLaneFiles } from "./inherited-checked-record-lane-files.mjs";
import {
	inspectInheritedCheckedRecordDotnetCiHandoff
} from "./inherited-checked-record-dotnet-ci-handoff.mjs";
import {
	assertInheritedCheckedRecordDotnetCiTap
	, checkInheritedCheckedRecordDotnetCiRecords
} from "./inherited-checked-record-dotnet-ci-report.mjs";
import {
	checkInheritedCheckedRecordDotnetControls
} from "./inherited-checked-record-dotnet-controls.mjs";
import {
	inheritedCheckedRecordDotnetEvidenceOriginal
} from "./inherited-checked-record-dotnet-evidence-sources.mjs";
import {
	inheritedCheckedRecordDotnetEvidence
	, inheritedCheckedRecordDotnetEvidenceFloor
	, inheritedCheckedRecordDotnetEvidenceLoadCeiling
	, inheritedCheckedRecordDotnetPinnedRevisions
	, inheritedCheckedRecordDotnetSelectedSources
	, inheritedCheckedRecordDotnetSelections
} from "./inherited-checked-record-dotnet-provenance.mjs";
import {
	inheritedCheckedRecordDotnetRecords
} from "./inherited-checked-record-dotnet-report.mjs";

export {
	inheritedCheckedRecordDotnetEvidence
} from "./inherited-checked-record-dotnet-provenance.mjs";
/** Pinned only after a hosted artifact is independently archived. */
export const inheritedCheckedRecordDotnetEvidenceSha256
	= "5eca5f33284fe8862d8133aa92110dfd6d1b7e938701e1bfdabdc2302882a62f";

const handoff = Object.freeze([
	"handoff/package-set-receipt.json"
	, "handoff/package-set-receipt.json.sha256"
	, "handoff/archives/Inheritedcheckedrecords.Api.1.0.0.nupkg"
]);
const controlKeys = [
	"recordControls", "environmentControls", "packageControls"
	, "modelControls", "executionControls"
];
const expectedControls = (records, mode) => ({
	recordControls: records * 2, environmentControls: 28
	, packageControls: 5, modelControls: mode === "full" ? 5 : 4
	, executionControls: 30
});
const safePath = path => typeof path === "string" && path.length > 0
	&& !path.startsWith("/") && !path.includes("\\")
	&& posix.normalize(path) === path
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path);
	return value;
};
const cached = new Map();

/**
 * Verify every archived byte, source snapshot, TAP stream, report, and control.
 *
 * @param read - Repository-relative archive byte reader.
 * @param options - Negative-control replay scope.
 * @param options.controls - Replay one cell, all cells, or no controls.
 */
export const checkInheritedCheckedRecordDotnetEvidence = async (
	read = readFile, { controls = "representative" } = {}
) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && cached.has(controls)) return cached.get(controls);
	const checking = (async () => {
		const revisions = inheritedCheckedRecordDotnetPinnedRevisions();
		assert.match(inheritedCheckedRecordDotnetEvidenceSha256 ?? ""
			, /^[a-f0-9]{64}$/u, "Pin the inherited .NET archive index first");
		const indexBytes = Buffer.from(await read(
			`${inheritedCheckedRecordDotnetEvidence}/index.json`));
		assert.equal(sha256(indexBytes)
			, inheritedCheckedRecordDotnetEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = inheritedCheckedRecordLaneFiles(
			read, inheritedCheckedRecordDotnetEvidence);
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "files", "floor", "framework"
			, "hostedRun", "kind", "limitations", "loadCeiling"
			, "producerCommit", "runs", "runtime", "schemaVersion"
			, "selectedSources", "toolchain"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind
			, "inherited-checked-record-dotnet-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.equal(index.loadCeiling
			, inheritedCheckedRecordDotnetEvidenceLoadCeiling);
		assert.equal(index.floor, inheritedCheckedRecordDotnetEvidenceFloor);
		assert.deepEqual(Object.keys(index.runtime).sort()
			, ["arch", "glibc", "platform"]);
		assert.equal(index.runtime.platform, "linux");
		assert.equal(index.runtime.arch, "x64");
		assert.match(index.runtime.glibc, /^2\.[0-9]+$/u);
		assert.ok(Number(index.runtime.glibc.split(".")[1]) >= 38);
		assert.deepEqual(Object.keys(index.toolchain).sort()
			, ["command", "interpreter", "sdk"]);
		assert.equal(index.toolchain.sdk.version, "8.0.424");
		assert.deepEqual(Object.keys(index.framework).sort()
			, ["facts", "runtimeFiles"]);
		assert.match(index.framework.facts.version, /^8\.0\.[0-9]+$/u);
		assert.deepEqual(Object.keys(index.hostedRun).sort()
			, ["artifact", "repository", "runId", "url"]);
		assert.equal(index.hostedRun.repository, "seanmorris/lean-bridge");
		assert.ok(Number.isSafeInteger(index.hostedRun.runId)
			&& index.hostedRun.runId > 0);
		assert.equal(index.hostedRun.url
			, `https://github.com/seanmorris/lean-bridge/actions/runs/${index.hostedRun.runId}`);
		assert.deepEqual(Object.keys(index.hostedRun.artifact).sort()
			, ["bytes", "id", "name"]);
		assert.ok(Number.isSafeInteger(index.hostedRun.artifact.id)
			&& index.hostedRun.artifact.id > 0);
		assert.ok(Number.isSafeInteger(index.hostedRun.artifact.bytes)
			&& index.hostedRun.artifact.bytes > 0);
		assert.equal(index.hostedRun.artifact.name
			, `inherited-checked-record-dotnet-${revisions.producer}`);
		assert.ok(Array.isArray(index.limitations)
			&& index.limitations.length === 7
			&& index.limitations.every(item => typeof item === "string" && item));
		let previous = "";
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort()
				, ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path)
				, entry.path);
			assert.ok(!previous || previous.localeCompare(entry.path) < 0);
			previous = entry.path;
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			await files.authenticate(entry);
		}
		const get = files.get;
		const selectedSources
			= await inheritedCheckedRecordDotnetSelectedSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		const expectedPaths = [];
		for(const source of selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(await get(path)
				, inheritedCheckedRecordDotnetEvidenceOriginal(
					source.revision, source.path), path);
		}
		assert.deepEqual(index.runs.map(run => [run.route, run.mode])
			, inheritedCheckedRecordDotnetSelections);
		const accepted = [];
		for(const [position, run] of index.runs.entries())
		{
			assert.deepEqual(Object.keys(run).sort(), [
				"accepted", "archiveSha256", "controls", "label", "mode"
				, "recordCount", "reportSha256", "route", "tapSha256"
				, "verificationSha256"
			].sort());
			const label = `${run.route}-${run.mode}`;
			assert.equal(run.label, label);
			const prefix = `${label}/records/`, records = new Map();
			for(const path of files.paths(prefix))
				records.set(path.slice(prefix.length), path);
			const originalRead = async path => {
				assert.ok(records.has(path), path);
				return get(records.get(path));
			};
			const nuget = json(await get(prefix + "nuget.json")
				, prefix + "nuget.json");
			const context = json(await get(prefix + "installation.json")
				, prefix + "installation.json");
			const recordPaths = inheritedCheckedRecordDotnetRecords(
				run.route, run.mode, nuget, context).sort();
			assert.equal(run.recordCount, recordPaths.length);
			assert.deepEqual([...records.keys()].sort()
				, [...recordPaths, ...handoff].sort());
			const original
				= await inspectInheritedCheckedRecordDotnetCiHandoff(originalRead);
			assert.equal(run.archiveSha256, original.archiveSha256);
			const tap = await get(`${label}/run.tap`);
			assertInheritedCheckedRecordDotnetCiTap(
				tap.toString(), run.route, run.mode);
			const checked = await checkInheritedCheckedRecordDotnetCiRecords({
				route: run.route, mode: run.mode, producer: revisions.producer
				, directory: `/archive/${label}/records`
				, tap: `/archive/${label}/run.tap`, glibc: index.floor
				, dotnet: index.toolchain.command
			}, {
				tap: tap.toString(), read: originalRead, runtime: index.runtime
				, toolchain: index.toolchain, framework: index.framework
				, archiveSha512: original.archiveSha512
			});
			assert.deepEqual(run.accepted, checked);
			assert.equal(run.reportSha256
				, sha256(await get(prefix + "report.json")));
			assert.equal(run.tapSha256, sha256(tap));
			const verification = await get(`${label}/verification.json`);
			assert.equal(verification.toString(), canonicalJson({
				...checked, archiveSha256: original.archiveSha256
			}));
			assert.equal(run.verificationSha256, sha256(verification));
			const controlsPath = `${label}/controls.json`;
			const controlCounts = expectedControls(
				recordPaths.length, run.mode);
			assert.deepEqual(run.controls, controlCounts);
			assert.deepEqual(json(await get(controlsPath), controlsPath)
				, controlCounts);
			if(controls === "all"
				|| controls === "representative" && position === 0) {
				const replay = await checkInheritedCheckedRecordDotnetControls(
					originalRead, {
						route: run.route, mode: run.mode
						, producerCommit: revisions.producer
						, runtime: index.runtime, floor: index.floor
						, toolchain: index.toolchain
						, framework: index.framework
						, archiveSha512: original.archiveSha512
					}
				);
				assert.deepEqual(Object.fromEntries(controlKeys.map(key =>
					[key, replay[key]])), controlCounts);
				}
			expectedPaths.push(`${label}/run.tap`
				, `${label}/verification.json`, controlsPath
				, ...[...recordPaths, ...handoff].map(path => prefix + path));
			accepted.push(checked);
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			...revisions, selections: accepted, runtime: index.runtime
			, toolchain: index.toolchain, framework: index.framework
			, hostedRun: index.hostedRun, files: index.files, controls
			, supportPromoted: false, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached.set(controls, checking);
	return checking;
};
