/**
 * Authenticate the immutable hosted value-index C/C++ archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexNativeCiRecords
} from "./checked-record-value-index-native-ci-report.mjs";
import {
	checkedRecordValueIndexNativeRoutes, checkedRecordValueIndexNativeSelection
} from "./checked-record-value-index-native-fixture.mjs";
import {
	checkedRecordValueIndexHostedOriginal
	, checkedRecordValueIndexNativeEvidenceSources
} from "./checked-record-value-index-hosted-evidence-sources.mjs";

export const checkedRecordValueIndexNativeEvidence
	= "docs/evidence/checked-record-value-index-native-20261019";
export const checkedRecordValueIndexNativeEvidenceSha256
	= "d91e8dfa214650ed7d3bd31919d51d4f9047e6b610b2eaec06c4be9170d9fa18";
const revisions = Object.freeze({
	producer: "0e2283a4f4c0db48b7bdc7a85d119598a981324b"
	, consumer: "0e2283a4f4c0db48b7bdc7a85d119598a981324b"
	, checker: "0e2283a4f4c0db48b7bdc7a85d119598a981324b"
	, archiver: "bf5441a82f1420b9b4490497c38a9cda3bd14937"
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
 * Verify every retained byte, source snapshot, TAP stream and route result.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkCheckedRecordValueIndexNativeEvidence = async (
	read = readFile
) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const indexBytes = Buffer.from(await read(
			`${checkedRecordValueIndexNativeEvidence}/index.json`));
		assert.equal(sha256(indexBytes), checkedRecordValueIndexNativeEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "consumerCommit", "files", "floor"
			, "hostedRun", "kind", "limitations", "loadCeiling", "producerCommit"
			, "runs", "runtime", "schemaVersion", "selectedSources"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "checked-record-value-index-native-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.consumerCommit, revisions.consumer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.equal(index.floor, "2.38");
		assert.equal(index.loadCeiling, 12);
		assert.deepEqual(index.runtime, {
			arch: "x64", cc: "cc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0"
			, cpp: "c++ (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0"
			, glibc: "2.39", platform: "linux"
		});
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 6
			&& index.limitations.every(item => typeof item === "string" && item));
		let previous = "";
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort()
				, ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(!previous || previous.localeCompare(entry.path) < 0);
			previous = entry.path;
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(
				`${checkedRecordValueIndexNativeEvidence}/${entry.path}`));
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
			, checkedRecordValueIndexNativeEvidenceSources(revisions));
		const expectedPaths = [];
		for(const source of index.selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(get(path), checkedRecordValueIndexHostedOriginal(
				source.revision, source.path), path);
		}
		assert.deepEqual(index.runs.map(run => run.route)
			, checkedRecordValueIndexNativeRoutes);
		const accepted = [];
		for(const run of index.runs)
		{
			assert.deepEqual(Object.keys(run).sort(), [
				"acceptanceTapSha256", "accepted", "controls", "controlsTapSha256"
				, "recordCount", "resultOnly", "reviewed", "route"
				, "verificationSha256"
			].sort());
			const prefix = `${run.route}/records/`, records = new Map();
			for(const [path, value] of files)
				if(path.startsWith(prefix)) records.set(path.slice(prefix.length), value);
			const originalRead = async path => {
				assert.ok(records.has(path), path);
				return records.get(path);
			};
			const acceptanceTap = get(`${run.route}/acceptance.tap`);
			const controlsTap = get(`${run.route}/controls.tap`);
			const before = get(`${run.route}/runtime-before.json`);
			const after = get(`${run.route}/runtime-after.json`);
			assert.deepEqual(after, before, `${run.route} runtime drift`);
			const runtime = json(before, `${run.route}/runtime-before.json`);
			assert.deepEqual(runtime, index.runtime);
			const verification = get(`${run.route}/verification.json`);
			const checked = await checkCheckedRecordValueIndexNativeCiRecords({
				route: run.route, producer: revisions.producer, consumer: revisions.consumer
				, checker: revisions.checker, directory: `/archive/${run.route}/records`
				, "acceptance-tap": `/archive/${run.route}/acceptance.tap`
				, "controls-tap": `/archive/${run.route}/controls.tap`
				, runtime: `/archive/${run.route}/runtime-before.json`, floor: index.floor
			}, {
				acceptanceTap: acceptanceTap.toString(), controlsTap: controlsTap.toString()
				, runtime, paths: [...records.keys()].sort(), read: originalRead
			});
			const selection = checkedRecordValueIndexNativeSelection(run.route);
			assert.deepEqual(run, {
				route: run.route, reviewed: selection.reviewed
				, resultOnly: selection.resultOnly, recordCount: records.size
				, accepted: checked, controls: checked.controls
				, acceptanceTapSha256: sha256(acceptanceTap)
				, controlsTapSha256: sha256(controlsTap)
				, verificationSha256: sha256(verification)
			});
			assert.equal(verification.toString(), canonicalJson(checked));
			expectedPaths.push(`${run.route}/acceptance.tap`
				, `${run.route}/controls.tap`, `${run.route}/runtime-before.json`
				, `${run.route}/runtime-after.json`, `${run.route}/verification.json`
				, ...[...records.keys()].map(path => prefix + path));
			accepted.push(checked);
		}
		assert.deepEqual(Object.keys(index.hostedRun).sort(), [
			"apiRecords", "artifact", "createdAt", "event", "job", "repository"
			, "runAttempt", "runId", "updatedAt", "url", "workflow"
		].sort());
		assert.equal(index.hostedRun.repository, "seanmorris/lean-bridge");
		assert.equal(index.hostedRun.workflow
			, ".github/workflows/checked-record-value-index-native.yml");
		assert.equal(index.hostedRun.runId, 39287533848);
		assert.equal(index.hostedRun.artifact.id, 12205716190);
		assert.equal(index.hostedRun.artifact.bytes, 421929005);
		assert.equal(index.hostedRun.artifact.sha256
			, "9a8e8c5330092241ae6b5c4ff44deac6ba9949efb27fa0dd715fecf244345c2b");
		const archiveHash = createHash("sha256");
		let archiveBytes = 0;
		for(const part of index.hostedRun.artifact.parts)
		{
			assert.deepEqual(Object.keys(part).sort()
				, ["bytes", "offset", "path", "sha256"]);
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
			expectedPaths.push(path);
		}
		expectedPaths.push("hosted/logs/toolchain.log");
		assert.ok(get("hosted/logs/toolchain.log").length > 0);
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			...revisions, accepted, runtime: index.runtime, hostedRun: index.hostedRun
			, files: index.files, supportPromoted: false, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached = checking;
	return checking;
};
