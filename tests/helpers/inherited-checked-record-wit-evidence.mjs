/**
 * Authenticate the immutable hosted inherited checked-record WIT/WASI archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkInheritedCheckedRecordWitCiRecords
} from "./inherited-checked-record-wit-ci-report.mjs";
import {
	inspectInheritedCheckedRecordWitHandoff
} from "./inherited-checked-record-wit-handoff.mjs";
import {
	inheritedCheckedRecordWitEvidence
	, inheritedCheckedRecordWitLoadCeiling
	, inheritedCheckedRecordWitPinnedRevisions
	, inheritedCheckedRecordWitSelectedSources
	, inheritedCheckedRecordWitSelections
} from "./inherited-checked-record-wit-provenance.mjs";
import {
	inheritedCheckedRecordWitOriginal
} from "./inherited-checked-record-wit-evidence-sources.mjs";

export { inheritedCheckedRecordWitEvidence } from "./inherited-checked-record-wit-provenance.mjs";
/** Pinned only after a hosted artifact is independently archived. */
export const inheritedCheckedRecordWitEvidenceSha256
	= "f3316695858e718babd2fed783cacef0f209a92f9a9e75f6a1b8ce97e85942ea";

const safePath = path => typeof path === "string"
	&& /^[A-Za-z0-9_@.+$/[\]-]+$/u.test(path) && !path.startsWith("/")
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path);
	return value;
};
let cached;

/**
 * Verify every archived byte, source snapshot, TAP stream, and accepted report.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkInheritedCheckedRecordWitEvidence = async (
	read = readFile
) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const revisions = inheritedCheckedRecordWitPinnedRevisions();
		assert.match(inheritedCheckedRecordWitEvidenceSha256 ?? ""
			, /^[a-f0-9]{64}$/u, "Pin the inherited WIT archive index first");
		const indexBytes = Buffer.from(await read(
			`${inheritedCheckedRecordWitEvidence}/index.json`));
		assert.equal(sha256(indexBytes), inheritedCheckedRecordWitEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "files", "hostedRun", "kind"
			, "limitations", "loadCeiling", "producerCommit", "runs", "runtime"
			, "schemaVersion", "selectedSources", "tools"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "inherited-checked-record-wit-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.equal(index.loadCeiling, inheritedCheckedRecordWitLoadCeiling);
		assert.deepEqual(Object.keys(index.runtime).sort()
			, ["arch", "glibc", "platform"]);
		assert.equal(index.runtime.platform, "linux");
		assert.equal(index.runtime.arch, "x64");
		assert.match(index.runtime.glibc, /^2\.[0-9]+$/u);
		assert.ok(Number(index.runtime.glibc.split(".")[1]) >= 38);
		assert.deepEqual(Object.keys(index.hostedRun).sort()
			, ["repository", "runId", "url"]);
		assert.equal(index.hostedRun.repository, "seanmorris/lean-bridge");
		assert.ok(Number.isSafeInteger(index.hostedRun.runId)
			&& index.hostedRun.runId > 0);
		assert.equal(index.hostedRun.url
			, `https://github.com/seanmorris/lean-bridge/actions/runs/${index.hostedRun.runId}`);
		assert.ok(Array.isArray(index.limitations)
			&& index.limitations.length === 7
			&& index.limitations.every(item => typeof item === "string" && item));
		let previous = "";
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(!previous || previous.localeCompare(entry.path) < 0);
			previous = entry.path;
			const value = Buffer.from(await read(
				`${inheritedCheckedRecordWitEvidence}/${entry.path}`));
			assert.equal(value.length, entry.bytes, entry.path);
			assert.equal(sha256(value), entry.sha256, entry.path);
			files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path);
			assert.ok(Buffer.isBuffer(value), path);
			return value;
		};
		const selectedSources = await inheritedCheckedRecordWitSelectedSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		const expectedPaths = [];
		for(const source of selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(get(path), inheritedCheckedRecordWitOriginal(
				source.revision, source.path), path);
		}
		assert.deepEqual(index.runs.map(run => [run.route, run.mode])
			, inheritedCheckedRecordWitSelections);
		const accepted = [];
		for(const run of index.runs)
		{
			assert.deepEqual(Object.keys(run).sort(), [
				"accepted", "archiveSha256", "label", "mode", "recordCount"
				, "reportSha256", "route", "tapSha256", "verificationSha256"
			]);
			const label = `${run.route}-${run.mode}`;
			assert.equal(run.label, label);
			const prefix = `${label}/records/`, records = new Map();
			for(const [path, bytes] of files)
				if(path.startsWith(prefix)) records.set(path.slice(prefix.length), bytes);
			const originalRead = async path => {
				assert.ok(records.has(path), path); return records.get(path);
			};
			const handoff = await inspectInheritedCheckedRecordWitHandoff(originalRead);
			const recordRead = path => handoff.supplements.get(path)
				?? originalRead(path);
			const tap = get(`${label}/run.tap`);
			const options = {
				route: run.route, mode: run.mode, producer: revisions.producer
				, directory: "records", tap: "run.tap", glibc: "2.38"
				, cc: index.tools.selected.cc
				, "wasm-tools": index.tools.selected.wasmTools
				, "wasmtime-capi": index.tools.selected.wasmtimeCapi
			};
			const checked = await checkInheritedCheckedRecordWitCiRecords(options, {
				tap: tap.toString(), read: recordRead, runtime: index.runtime
				, tools: index.tools, archiveSha256: handoff.archiveSha256
			});
			assert.deepEqual(run.accepted, checked);
			assert.equal(run.archiveSha256, checked.archiveSha256);
			assert.equal(run.reportSha256, checked.reportSha256);
			assert.equal(run.recordCount, records.size);
			assert.equal(run.tapSha256, sha256(tap));
			const verification = get(`${label}/verification.json`);
			assert.equal(verification.toString(), canonicalJson(checked));
			assert.equal(run.verificationSha256, sha256(verification));
			expectedPaths.push(`${label}/run.tap`, `${label}/verification.json`
				, ...[...records.keys()].map(path => prefix + path));
			accepted.push(checked);
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			...revisions, selections: accepted, runtime: index.runtime
			, tools: index.tools, hostedRun: index.hostedRun, files: index.files
			, supportPromoted: false, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached = checking;
	return checking;
};
