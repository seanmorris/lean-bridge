/**
 * Authenticate the immutable hosted value-index checked-record .NET archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	inspectCheckedRecordValueIndexDotnetCiHandoff
} from "./checked-record-value-index-dotnet-ci-handoff.mjs";
import {
	assertCheckedRecordValueIndexDotnetCiTap
	, checkCheckedRecordValueIndexDotnetCiRecords
} from "./checked-record-value-index-dotnet-ci-report.mjs";
import {
	checkCheckedRecordValueIndexDotnetControls
} from "./checked-record-value-index-dotnet-controls.mjs";
import {
	checkedRecordValueIndexDotnetEvidenceOriginal
} from "./checked-record-value-index-dotnet-evidence-sources.mjs";
import {
	checkedRecordValueIndexDotnetEvidence
	, checkedRecordValueIndexDotnetEvidenceFloor
	, checkedRecordValueIndexDotnetEvidenceLoadCeiling
	, checkedRecordValueIndexDotnetPinnedRevisions
	, checkedRecordValueIndexDotnetSelectedSources
	, checkedRecordValueIndexDotnetSelections
} from "./checked-record-value-index-dotnet-provenance.mjs";
import {
	checkedRecordValueIndexDotnetRecords
} from "./checked-record-value-index-dotnet-report.mjs";

export {
	checkedRecordValueIndexDotnetEvidence
} from "./checked-record-value-index-dotnet-provenance.mjs";
/** Pinned only after a hosted artifact is independently archived. */
export const checkedRecordValueIndexDotnetEvidenceSha256 = null;

const controlKeys = Object.freeze([
	"records", "recordControls", "provenanceControls"
	, "reconciliationControls", "gitBindingControls", "packageControls"
	, "callerControls", "observationControls", "runtimeControls"
]);
const expectedControls = records => ({
	records, recordControls: 2, provenanceControls: 5
	, reconciliationControls: 1, gitBindingControls: 1
	, packageControls: 1, callerControls: 1
	, observationControls: 1, runtimeControls: 1
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
 * Verify every retained byte, source snapshot, TAP stream, report and control.
 *
 * @param read - Repository-relative archive byte reader.
 * @param options - Negative-control replay scope.
 * @param options.controls - Replay one route, all routes, or no controls.
 */
export const checkCheckedRecordValueIndexDotnetEvidence = async (
	read = readFile, { controls = "representative" } = {}
) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && cached.has(controls)) return cached.get(controls);
	const checking = (async () => {
		const revisions = checkedRecordValueIndexDotnetPinnedRevisions();
		assert.match(checkedRecordValueIndexDotnetEvidenceSha256 ?? ""
			, /^[a-f0-9]{64}$/u
			, "Pin the value-index checked-record .NET archive index first");
		const indexBytes = Buffer.from(await read(
			`${checkedRecordValueIndexDotnetEvidence}/index.json`));
		assert.equal(sha256(indexBytes)
			, checkedRecordValueIndexDotnetEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "consumerCommit", "files"
			, "floor", "framework", "hostedRun", "kind", "limitations"
			, "loadCeiling", "producerCommit", "runs", "runtime"
			, "schemaVersion", "selectedSources", "toolchain"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind
			, "checked-record-value-index-dotnet-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.consumerCommit, revisions.consumer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.equal(index.floor, checkedRecordValueIndexDotnetEvidenceFloor);
		assert.equal(index.loadCeiling
			, checkedRecordValueIndexDotnetEvidenceLoadCeiling);
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
			, `checked-record-value-index-dotnet-${revisions.producer}`);
		assert.ok(Array.isArray(index.limitations)
			&& index.limitations.length === 7
			&& index.limitations.every(item =>
				typeof item === "string" && item.length > 0));
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
			const value = Buffer.from(await read(
				`${checkedRecordValueIndexDotnetEvidence}/${entry.path}`));
			assert.equal(value.length, entry.bytes, entry.path);
			assert.equal(sha256(value), entry.sha256, entry.path);
			files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path);
			assert.ok(Buffer.isBuffer(value), path);
			return value;
		};
		const selectedSources
			= await checkedRecordValueIndexDotnetSelectedSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		const expectedPaths = [];
		for(const source of selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(get(path)
				, checkedRecordValueIndexDotnetEvidenceOriginal(
					source.revision, source.path), path);
		}
		assert.deepEqual(index.runs.map(run => run.route)
			, checkedRecordValueIndexDotnetSelections);
		const accepted = [];
		for(const [position, run] of index.runs.entries())
		{
			assert.deepEqual(Object.keys(run).sort(), [
				"accepted", "archiveSha256", "controls", "label", "mode"
				, "recordCount", "reportSha256", "route", "tapSha256"
				, "verificationSha256"
			].sort());
			assert.equal(run.label, run.route);
			assert.equal(run.mode, run.route.startsWith("result-only-")
				? "result-only" : "full");
			const prefix = `${run.route}/records/`, records = new Map();
			for(const [path, bytes] of files)
				if(path.startsWith(prefix))
					records.set(path.slice(prefix.length), bytes);
			const originalRead = async path => {
				assert.ok(records.has(path), path);
				return records.get(path);
			};
			const nuget = json(get(prefix + "nuget.json")
				, prefix + "nuget.json");
			const context = json(get(prefix + "installation.json")
				, prefix + "installation.json");
			const recordPaths = checkedRecordValueIndexDotnetRecords(
				run.route, nuget, context).sort();
			assert.equal(run.recordCount, recordPaths.length);
			assert.deepEqual([...records.keys()].sort(), recordPaths);
			const original
				= await inspectCheckedRecordValueIndexDotnetCiHandoff(
					originalRead);
			assert.equal(run.archiveSha256, original.archiveSha256);
			const tap = get(`${run.route}/run.tap`);
			assertCheckedRecordValueIndexDotnetCiTap(
				tap.toString(), run.route);
			const checked = await checkCheckedRecordValueIndexDotnetCiRecords({
				route: run.route, producer: revisions.producer
				, consumer: revisions.consumer
				, directory: `/archive/${run.route}/records`
				, tap: `/archive/${run.route}/run.tap`
				, glibc: index.floor, dotnet: index.toolchain.command
			}, {
				tap: tap.toString(), read: originalRead, runtime: index.runtime
				, toolchain: index.toolchain, framework: index.framework
				, archiveSha512: original.archiveSha512
			});
			assert.deepEqual(run.accepted, checked);
			assert.equal(run.reportSha256
				, sha256(get(prefix + "report.json")));
			assert.equal(run.tapSha256, sha256(tap));
			const verification = get(`${run.route}/verification.json`);
			const controlCounts = expectedControls(recordPaths.length);
			assert.deepEqual(run.controls, controlCounts);
			assert.equal(verification.toString(), canonicalJson({
				...checked, archiveSha256: original.archiveSha256
				, controls: controlCounts
			}));
			assert.equal(run.verificationSha256, sha256(verification));
			if(controls === "all"
				|| controls === "representative" && position === 0) {
				const replay = await checkCheckedRecordValueIndexDotnetControls(
					originalRead, {
						route: run.route, producerCommit: revisions.producer
						, consumerCommit: revisions.consumer
						, runtime: index.runtime, floor: index.floor
						, toolchain: index.toolchain
						, framework: index.framework
						, archiveSha512: original.archiveSha512
					}
				);
				assert.deepEqual(replay.accepted, checked);
				assert.deepEqual(Object.fromEntries(controlKeys.map(key =>
					[key, replay[key]])), controlCounts);
				}
			expectedPaths.push(`${run.route}/run.tap`
				, `${run.route}/verification.json`
				, ...recordPaths.map(path => prefix + path));
			accepted.push(checked);
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			...revisions, selections: accepted, runtime: index.runtime
			, toolchain: index.toolchain, framework: index.framework
			, hostedRun: index.hostedRun, files: index.files, controls
			, installedProfiles: ["dotnet"]
			, supportPromoted: false, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached.set(controls, checking);
	return checking;
};
