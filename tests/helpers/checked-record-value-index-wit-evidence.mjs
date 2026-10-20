/**
 * Authenticate the immutable hosted WIT/WASI value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexWitCiRecords
} from "./checked-record-value-index-wit-ci-report.mjs";
import {
	checkedRecordValueIndexWitRoutes
} from "./checked-record-value-index-wit-fixture.mjs";
import {
	checkedRecordValueIndexBrowserSelection
} from "./checked-record-value-index-browser-fixture.mjs";
import {
	inspectCheckedRecordValueIndexWitHandoff
} from "./checked-record-value-index-wit-handoff.mjs";
import {
	checkedRecordValueIndexHostedOriginal
	, checkedRecordValueIndexWitEvidenceSources
} from "./checked-record-value-index-hosted-evidence-sources.mjs";

export const checkedRecordValueIndexWitEvidence
	= "docs/evidence/checked-record-value-index-wit-20261020";
export const checkedRecordValueIndexWitEvidenceSha256
	= "a985723dd4dab68794a7061752c7dbf093c19a949a58b574a37063fa17d296b9";
const revisions = Object.freeze({
	producer: "b46042dd7b8c763a6884e15f75d59e005ad01c8d"
	, consumer: "b46042dd7b8c763a6884e15f75d59e005ad01c8d"
	, checker: "b46042dd7b8c763a6884e15f75d59e005ad01c8d"
	, archiver: "dd2ee7a08530f5956912616442bc0a110c5708e9"
});
const safePath = path => typeof path === "string" && path.length > 0
	&& !path.startsWith("/") && !path.includes("\\")
	&& posix.normalize(path) === path
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), label);
	return value;
};
let cached;

/**
 * Verify every retained byte, source snapshot, route replay, component
 * archive, and the complete original hosted artifact.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkCheckedRecordValueIndexWitEvidence = async (
	read = readFile
) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const indexBytes = Buffer.from(await read(
			`${checkedRecordValueIndexWitEvidence}/index.json`));
		assert.equal(sha256(indexBytes), checkedRecordValueIndexWitEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "consumerCommit", "files"
			, "hostedRun", "kind", "limitations", "producerCommit", "runs"
			, "runtime", "schemaVersion", "selectedSources", "tools"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "checked-record-value-index-wit-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.consumerCommit, revisions.consumer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.deepEqual(index.runtime, {
			platform: "linux", arch: "x64", glibc: "2.39"
		});
		assert.equal(index.tools.wasmtime.version, "42.0.1");
		assert.equal(index.tools.selected.cc, "/usr/bin/x86_64-linux-gnu-gcc-13");
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 5
			&& index.limitations.every(item => typeof item === "string" && item));
		let previous = "";
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(!previous || previous.localeCompare(entry.path) < 0, entry.path);
			previous = entry.path;
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(
				`${checkedRecordValueIndexWitEvidence}/${entry.path}`));
			assert.equal(value.length, entry.bytes, entry.path);
			assert.equal(sha256(value), entry.sha256, entry.path);
			files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path);
			assert.ok(Buffer.isBuffer(value), path);
			return value;
		};
		assert.deepEqual(index.selectedSources
			, checkedRecordValueIndexWitEvidenceSources(revisions));
		const expectedPaths = [];
		for(const source of index.selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(get(path), checkedRecordValueIndexHostedOriginal(
				source.revision, source.path), path);
		}
		assert.deepEqual(index.runs.map(run => run.route)
			, checkedRecordValueIndexWitRoutes);
		const accepted = [], artifactMembers = [];
		for(const run of index.runs)
		{
			assert.deepEqual(Object.keys(run).sort(), [
				"accepted", "mode", "recordCount", "resultOnly", "reviewed"
				, "route", "tapSha256", "verificationSha256"
			].sort());
			const prefix = `${run.route}/records/`, records = new Map();
			for(const [path, value] of files)
				if(path.startsWith(prefix)) records.set(path.slice(prefix.length), value);
			assert.equal(records.size, run.recordCount);
			const originalRead = async path => {
				assert.ok(records.has(path), path); return records.get(path);
			};
			const handoff = await inspectCheckedRecordValueIndexWitHandoff(originalRead);
			const tapPath = `${run.route}/run.tap`;
			const verificationPath = `${run.route}/verification.json`;
			const tap = get(tapPath), verification = get(verificationPath);
			const original = json(verification, verificationPath);
			assert.deepEqual(original.runtime, index.runtime);
			assert.deepEqual(original.tools, index.tools);
			const checked = await checkCheckedRecordValueIndexWitCiRecords({
				route: run.route, mode: run.mode, producer: revisions.producer
				, directory: `/archive/${run.route}/records`, tap: tapPath
				, glibc: original.floor, cc: index.tools.selected.cc
				, "wasm-tools": index.tools.selected.wasmTools
				, "wasmtime-capi": index.tools.selected.wasmtimeCapi
			}, {
				tap: tap.toString(), runtime: index.runtime, tools: index.tools
				, archiveSha256: handoff.archiveSha256
				, read: path => handoff.supplements.get(path) ?? originalRead(path)
			});
			assert.deepEqual(original, checked);
			assert.deepEqual(run.accepted, checked);
			assert.equal(run.tapSha256, sha256(tap));
			assert.equal(run.verificationSha256, sha256(verification));
			const selection = checkedRecordValueIndexBrowserSelection(run.route);
			assert.deepEqual([run.reviewed, run.resultOnly, run.mode]
				, [selection.reviewed, selection.resultOnly
					, selection.resultOnly ? "result-only" : "full"]);
			expectedPaths.push(tapPath, verificationPath
				, ...[...records.keys()].map(path => prefix + path));
			artifactMembers.push(
				...[...records.keys()].map(path =>
					`checked-record-value-index-wit-ci/${run.route}/records/${run.route}/${path}`)
				, `checked-record-value-index-wit-ci/${run.route}/run.tap`
				, `checked-record-value-index-wit-ci/${run.route}/verification.json`
			);
			accepted.push(checked);
		}
		assert.deepEqual(Object.keys(index.hostedRun).sort(), [
			"apiRecords", "artifact", "createdAt", "event", "job", "repository"
			, "runAttempt", "runId", "updatedAt", "url", "workflow"
		].sort());
		assert.equal(index.hostedRun.repository, "seanmorris/lean-bridge");
		assert.equal(index.hostedRun.workflow
			, ".github/workflows/checked-record-value-index-wit.yml");
		assert.equal(index.hostedRun.runId, 39373895062);
		assert.equal(index.hostedRun.runAttempt, 1);
		assert.equal(index.hostedRun.job.id, 118467591526);
		assert.equal(index.hostedRun.artifact.id, 12243086792);
		assert.equal(index.hostedRun.artifact.bytes, 237534694);
		assert.equal(index.hostedRun.artifact.sha256
			, "629b33b405b0c67afee92afc60194ab6c62347d0b5c06a09fd4872561ce1340d");
		assert.equal(index.hostedRun.artifact.apiDigest
			, `sha256:${index.hostedRun.artifact.sha256}`);
		assert.deepEqual([...index.hostedRun.artifact.members].sort(), [
			...artifactMembers, "checked-record-value-index-wit-ci/tools.json"
			, "checked-record-value-index-wit-toolchain.log"
		].sort());
		const archiveHash = createHash("sha256"); let archiveBytes = 0;
		for(const part of index.hostedRun.artifact.parts)
		{
			assert.deepEqual(Object.keys(part).sort(), [
				"bytes", "offset", "path", "sha256"
			]);
			const value = get(part.path);
			assert.equal(value.length, part.bytes, part.path);
			assert.equal(sha256(value), part.sha256, part.path);
			assert.equal(part.offset, archiveBytes, part.path);
			archiveHash.update(value); archiveBytes += value.length;
			expectedPaths.push(part.path);
		}
		assert.equal(archiveBytes, index.hostedRun.artifact.bytes);
		assert.equal(archiveHash.digest("hex"), index.hostedRun.artifact.sha256);
		for(const [name, detail] of Object.entries(index.hostedRun.apiRecords))
		{
			const path = `hosted/api/${name}.json`, value = get(path);
			assert.deepEqual(Object.keys(detail).sort(), ["bytes", "sha256"]);
			assert.equal(value.length, detail.bytes, path);
			assert.equal(sha256(value), detail.sha256, path);
			JSON.parse(value); expectedPaths.push(path);
		}
		expectedPaths.push("hosted/logs/toolchain.log");
		assert.ok(get("hosted/logs/toolchain.log").length > 0);
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			...revisions, accepted, runtime: index.runtime, tools: index.tools
			, hostedRun: index.hostedRun, files: index.files
			, supportPromoted: false, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached = checking;
	return checking;
};
