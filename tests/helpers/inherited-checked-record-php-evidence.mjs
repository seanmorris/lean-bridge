/**
 * Authenticate the immutable hosted inherited checked-record native PHP archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	assertInheritedCheckedRecordPhpCiTap
	, checkInheritedCheckedRecordPhpCiRecords
} from "./inherited-checked-record-php-ci-report.mjs";
import {
	checkInheritedCheckedRecordPhpControls
} from "./inherited-checked-record-php-controls.mjs";
import {
	assertNominalSubtypePhpToolRecords
} from "./nominal-subtype-php-tool-records.mjs";
import {
	inheritedCheckedRecordPhpEvidenceOriginal
} from "./inherited-checked-record-php-evidence-sources.mjs";
import {
	inheritedCheckedRecordPhpEvidence
	, inheritedCheckedRecordPhpEvidenceFloor
	, inheritedCheckedRecordPhpEvidenceLoadCeiling
	, inheritedCheckedRecordPhpPinnedRevisions
	, inheritedCheckedRecordPhpSelectedSources
	, inheritedCheckedRecordPhpSelections
} from "./inherited-checked-record-php-provenance.mjs";

export {
	inheritedCheckedRecordPhpEvidence
} from "./inherited-checked-record-php-provenance.mjs";
/** Pinned only after a hosted artifact is independently archived. */
export const inheritedCheckedRecordPhpEvidenceSha256
	= "fab6f47368402da87eac5827124c4a16d66ca261e9d2299f44f463c311890ee1";

const controlKeys = [
	"recordControls", "resourceControls", "environmentControls"
	, "packageControls", "modelControls", "executionControls", "toolControls"
];
const expectedControls = (records, mode) => ({
	recordControls: records * 2, resourceControls: 7
	, environmentControls: 10, packageControls: 4, toolControls: 12
	, modelControls: mode === "full" ? 7 : 6, executionControls: 48
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
export const checkInheritedCheckedRecordPhpEvidence = async (
	read = readFile, { controls = "representative" } = {}
) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && cached.has(controls)) return cached.get(controls);
	const checking = (async () => {
		const revisions = inheritedCheckedRecordPhpPinnedRevisions();
		assert.match(inheritedCheckedRecordPhpEvidenceSha256 ?? ""
			, /^[a-f0-9]{64}$/u, "Pin the inherited PHP archive index first");
		const indexBytes = Buffer.from(await read(
			`${inheritedCheckedRecordPhpEvidence}/index.json`));
		assert.equal(sha256(indexBytes)
			, inheritedCheckedRecordPhpEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "files", "floor", "hostedRun"
			, "kind", "limitations", "loadCeiling"
			, "producerCommit", "runs", "runtime", "schemaVersion"
			, "selectedSources", "tools"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind
			, "inherited-checked-record-php-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.equal(index.loadCeiling
			, inheritedCheckedRecordPhpEvidenceLoadCeiling);
		assert.equal(index.floor, inheritedCheckedRecordPhpEvidenceFloor);
		assert.deepEqual(Object.keys(index.runtime).sort()
			, ["arch", "glibc", "platform"]);
		assert.equal(index.runtime.platform, "linux");
		assert.equal(index.runtime.arch, "x64");
		assert.match(index.runtime.glibc, /^2\.[0-9]+$/u);
		assert.ok(Number(index.runtime.glibc.split(".")[1]) >= 38);
		const phpVersion = index.tools.selected.phpVersion;
		const composerVersion = index.tools.selected.composerVersion;
		assertNominalSubtypePhpToolRecords(index.tools, {
			phpVersion, composerVersion
		});
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
			, `inherited-checked-record-php-${revisions.producer}`);
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
				`${inheritedCheckedRecordPhpEvidence}/${entry.path}`));
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
			= await inheritedCheckedRecordPhpSelectedSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		const expectedPaths = [];
		for(const source of selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(get(path)
					, inheritedCheckedRecordPhpEvidenceOriginal(
						source.revision, source.path), path);
		}
		const producerTools = "producer/tools.json";
		assert.deepEqual(json(get(producerTools), producerTools), index.tools);
		expectedPaths.push(producerTools);
		assert.deepEqual(index.runs.map(run => [run.route, run.mode])
			, inheritedCheckedRecordPhpSelections);
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
			const tap = get(`${label}/run.tap`);
			assertInheritedCheckedRecordPhpCiTap(
				tap.toString(), run.route, run.mode);
			const checked = await checkInheritedCheckedRecordPhpCiRecords({
				route: run.route, mode: run.mode, producer: revisions.producer
				, directory: `/archive/${label}/records`
				, tap: `/archive/${label}/run.tap`, glibc: index.floor
				, php: index.tools.command, composer: index.tools.composer
				, "php-version": phpVersion
				, "composer-version": composerVersion
			}, {
				tap: tap.toString(), read: originalRead, runtime: index.runtime
				, tools: index.tools, archiveSha256: run.archiveSha256
			});
			assert.deepEqual(run.accepted, checked);
			assert.equal(run.archiveSha256, checked.archiveSha256);
			assert.equal(run.reportSha256
				, sha256(get(prefix + "report.json")));
			assert.equal(run.tapSha256, sha256(tap));
			const verification = get(`${label}/verification.json`);
			assert.equal(verification.toString(), canonicalJson(checked));
			assert.equal(run.verificationSha256, sha256(verification));
			const controlsPath = `${label}/controls.json`;
			const controlCounts = expectedControls(checked.records.length, run.mode);
			assert.deepEqual(run.controls, controlCounts);
			assert.deepEqual(json(get(controlsPath), controlsPath)
				, controlCounts);
			if(controls === "all"
				|| controls === "representative" && position === 0) {
				const replay = await checkInheritedCheckedRecordPhpControls(
					originalRead, {
						route: run.route, mode: run.mode
						, producerCommit: revisions.producer
						, runtime: index.runtime, floor: index.floor
						, phpVersion, composerVersion
					}
				);
				assert.deepEqual(Object.fromEntries(controlKeys.map(key =>
					[key, replay[key]])), controlCounts);
				}
			const diskPaths = [...checked.records].sort();
			assert.deepEqual([...records.keys()].sort(), diskPaths);
			expectedPaths.push(`${label}/run.tap`
				, `${label}/verification.json`, controlsPath
				, ...diskPaths.map(path => prefix + path));
			accepted.push(checked);
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			...revisions, selections: accepted, runtime: index.runtime
			, tools: index.tools
			, hostedRun: index.hostedRun, files: index.files
			, controls, supportPromoted: false, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached.set(controls, checking);
	return checking;
};
