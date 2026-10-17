/**
 * Authenticate the immutable hosted inherited checked-record JVM archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	inspectInheritedCheckedRecordJvmCiHandoff
} from "./inherited-checked-record-jvm-ci-handoff.mjs";
import {
	assertInheritedCheckedRecordJvmCiTap
	, checkInheritedCheckedRecordJvmCiRecords
} from "./inherited-checked-record-jvm-ci-report.mjs";
import {
	checkInheritedCheckedRecordJvmControls
} from "./inherited-checked-record-jvm-controls.mjs";
import {
	inheritedCheckedRecordJvmEvidenceOriginal
} from "./inherited-checked-record-jvm-evidence-sources.mjs";
import {
	inheritedCheckedRecordJvmEvidence
	, inheritedCheckedRecordJvmEvidenceFloor
	, inheritedCheckedRecordJvmEvidenceLoadCeiling
	, inheritedCheckedRecordJvmPinnedRevisions
	, inheritedCheckedRecordJvmSelectedSources
	, inheritedCheckedRecordJvmSelections
} from "./inherited-checked-record-jvm-provenance.mjs";

export {
	inheritedCheckedRecordJvmEvidence
} from "./inherited-checked-record-jvm-provenance.mjs";
/** Pinned only after a hosted artifact is independently archived. */
export const inheritedCheckedRecordJvmEvidenceSha256 = null;

const controlKeys = [
	"recordControls", "executionControls", "probeControls"
	, "packageControls", "modelControls", "resourceControls"
];
const expectedControls = (records, mode) => ({
	recordControls: records * 2, executionControls: 48, probeControls: 22
	, packageControls: 4, modelControls: mode === "full" ? 5 : 4
	, resourceControls: 8
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
export const checkInheritedCheckedRecordJvmEvidence = async (
	read = readFile, { controls = "representative" } = {}
) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && cached.has(controls)) return cached.get(controls);
	const checking = (async () => {
		const revisions = inheritedCheckedRecordJvmPinnedRevisions();
		assert.match(inheritedCheckedRecordJvmEvidenceSha256 ?? ""
			, /^[a-f0-9]{64}$/u, "Pin the inherited JVM archive index first");
		const indexBytes = Buffer.from(await read(
			`${inheritedCheckedRecordJvmEvidence}/index.json`));
		assert.equal(sha256(indexBytes)
			, inheritedCheckedRecordJvmEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "files", "floor", "hostedRun"
			, "kind", "limitations", "loadCeiling", "producerCommit", "runs"
			, "runtime", "schemaVersion", "selectedSources", "tools"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind
			, "inherited-checked-record-jvm-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.equal(index.loadCeiling
			, inheritedCheckedRecordJvmEvidenceLoadCeiling);
		assert.equal(index.floor, inheritedCheckedRecordJvmEvidenceFloor);
		assert.deepEqual(Object.keys(index.runtime).sort()
			, ["arch", "glibc", "platform"]);
		assert.equal(index.runtime.platform, "linux");
		assert.equal(index.runtime.arch, "x64");
		assert.match(index.runtime.glibc, /^2\.[0-9]+$/u);
		assert.ok(Number(index.runtime.glibc.split(".")[1]) >= 38);
		assert.deepEqual(Object.keys(index.tools).sort()
			, ["java", "javac", "kotlinc"]);
		assert.deepEqual(Object.keys(index.tools.java).sort()
			, ["command", "sha256", "version"]);
		assert.deepEqual(Object.keys(index.tools.javac).sort()
			, ["command", "sha256", "version"]);
		assert.deepEqual(Object.keys(index.tools.kotlinc).sort()
			, ["command", "compilerFiles", "sha256", "version"]);
		for(const name of ["java", "javac", "kotlinc"])
		{
			assert.ok(posix.isAbsolute(index.tools[name].command));
			assert.match(index.tools[name].sha256, /^[a-f0-9]{64}$/u);
		}
		assert.match(index.tools.java.version
			, /^(?:openjdk|java) 22\.0\.2[ +]/u);
		assert.equal(index.tools.javac.version, "javac 22.0.2");
		assert.match(index.tools.kotlinc.version
			, /^info: kotlinc-jvm 2\.2\.0 \(JRE 22\.0\.2[+)]/u);
		assert.ok(Object.keys(index.tools.kotlinc.compilerFiles).length > 2);
		for(const digest of Object.values(
			index.tools.kotlinc.compilerFiles))
			assert.match(digest, /^[a-f0-9]{64}$/u);
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
			, `inherited-checked-record-jvm-${revisions.producer}`);
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
			const value = Buffer.from(await read(
				`${inheritedCheckedRecordJvmEvidence}/${entry.path}`));
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
			= await inheritedCheckedRecordJvmSelectedSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		const expectedPaths = [];
		for(const source of selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(get(path)
				, inheritedCheckedRecordJvmEvidenceOriginal(
					source.revision, source.path), path);
		}
		assert.deepEqual(index.runs.map(run => [run.route, run.mode])
			, inheritedCheckedRecordJvmSelections);
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
			for(const [path, bytes] of files)
				if(path.startsWith(prefix))
					records.set(path.slice(prefix.length), bytes);
			assert.equal(run.recordCount, records.size);
			const originalRead = async path => {
				assert.ok(records.has(path), path);
				return records.get(path);
			};
			const original = await inspectInheritedCheckedRecordJvmCiHandoff(
				originalRead, { floor: index.floor, mode: run.mode }
			);
			assert.equal(run.archiveSha256, original.archiveSha256);
			const tap = get(`${label}/run.tap`);
			assertInheritedCheckedRecordJvmCiTap(
				tap.toString(), run.route, run.mode);
			const checked = await checkInheritedCheckedRecordJvmCiRecords({
				route: run.route, mode: run.mode, producer: revisions.producer
				, directory: `/archive/${label}/records`
				, tap: `/archive/${label}/run.tap`, glibc: index.floor
				, java: index.tools.java.command
				, javac: index.tools.javac.command
				, kotlinc: index.tools.kotlinc.command
			}, {
				tap: tap.toString(), read: original.read, runtime: index.runtime
				, tools: index.tools, archiveSha256: original.archiveSha256
			});
			assert.deepEqual(run.accepted, checked);
			assert.equal(run.reportSha256
				, sha256(get(prefix + "report.json")));
			assert.equal(run.tapSha256, sha256(tap));
			const verification = get(`${label}/verification.json`);
			assert.equal(verification.toString(), canonicalJson(checked));
			assert.equal(run.verificationSha256, sha256(verification));
			const controlsPath = `${label}/controls.json`;
			const controlCounts = expectedControls(
				checked.records.length, run.mode);
			assert.deepEqual(run.controls, controlCounts);
			assert.deepEqual(json(get(controlsPath), controlsPath)
				, controlCounts);
			if(controls === "all"
				|| controls === "representative" && position === 0) {
				const replay = await checkInheritedCheckedRecordJvmControls(
					original.read, {
						route: run.route, mode: run.mode
						, producerCommit: revisions.producer
						, runtime: index.runtime, floor: index.floor
						, javaVersion: index.tools.java.version
					}
				);
				assert.deepEqual(Object.fromEntries(controlKeys.map(key =>
					[key, replay[key]])), controlCounts);
				}
			const diskPaths = [
				...checked.records.filter(path => !path.startsWith("package/"))
				, original.archivePath
			].sort();
			assert.deepEqual([...records.keys()].sort(), diskPaths);
			expectedPaths.push(`${label}/run.tap`
				, `${label}/verification.json`, controlsPath
				, ...diskPaths.map(path => prefix + path));
			accepted.push(checked);
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			...revisions, selections: accepted, runtime: index.runtime
			, tools: index.tools, hostedRun: index.hostedRun, files: index.files
			, controls, supportPromoted: false, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached.set(controls, checking);
	return checking;
};
