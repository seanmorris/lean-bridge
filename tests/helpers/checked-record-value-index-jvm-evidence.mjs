/**
 * Authenticate the immutable hosted value-index Java/Kotlin archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexJvmCiRecords
} from "./checked-record-value-index-jvm-ci-report.mjs";
import {
	checkedRecordValueIndexJvmRoutes, checkedRecordValueIndexJvmSelection
} from "./checked-record-value-index-jvm-fixture.mjs";
import {
	checkedRecordValueIndexHostedOriginal
	, checkedRecordValueIndexJvmEvidenceSources
} from "./checked-record-value-index-hosted-evidence-sources.mjs";

export const checkedRecordValueIndexJvmEvidence
	= "docs/evidence/checked-record-value-index-jvm-20261019";
export const checkedRecordValueIndexJvmEvidenceSha256
	= "7c6304bf2c5867a78c71026996683ab075aed8e5286e005b6395d66e57075b20";
const revisions = Object.freeze({
	producer: "df22aa02bea72c3de550f15ab00b2a89b70f279e"
	, consumer: "df22aa02bea72c3de550f15ab00b2a89b70f279e"
	, checker: "df22aa02bea72c3de550f15ab00b2a89b70f279e"
	, archiver: "02d4347ee26bfc06eecee3f00ba4faf4be427a9a"
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
export const checkCheckedRecordValueIndexJvmEvidence = async (
	read = readFile
) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const indexBytes = Buffer.from(await read(
			`${checkedRecordValueIndexJvmEvidence}/index.json`));
		assert.equal(sha256(indexBytes), checkedRecordValueIndexJvmEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "consumerCommit", "files"
			, "hostedRun", "kind", "limitations", "producerCommit"
			, "runs", "runtime", "schemaVersion", "selectedSources", "tools"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "checked-record-value-index-jvm-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.consumerCommit, revisions.consumer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.deepEqual(index.runtime, {
			platform: "linux", arch: "x64", glibc: "2.39"
		});
		assert.deepEqual(Object.keys(index.tools).sort(), [
			"java", "javac", "kotlinc"
		]);
		assert.equal(index.tools.javac.version, "javac 22.0.2");
		assert.match(index.tools.java.version, /^openjdk 22\.0\.2 /u);
		assert.match(index.tools.kotlinc.version
			, /^info: kotlinc-jvm 2\.2\.0 \(JRE 22\.0\.2/u);
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
				`${checkedRecordValueIndexJvmEvidence}/${entry.path}`));
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
			, checkedRecordValueIndexJvmEvidenceSources(revisions));
		const expectedPaths = [];
		for(const source of index.selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(get(path), checkedRecordValueIndexHostedOriginal(
				source.revision, source.path), path);
		}
		assert.deepEqual(index.runs.map(run => run.route)
			, checkedRecordValueIndexJvmRoutes);
		const accepted = [];
		for(const run of index.runs)
		{
			assert.deepEqual(Object.keys(run).sort(), [
				"accepted", "recordCount", "resultOnly", "reviewed", "route"
				, "tapSha256", "verificationSha256"
			].sort());
			const prefix = `${run.route}/records/`, records = new Map();
			for(const [path, value] of files)
				if(path.startsWith(prefix)) records.set(path.slice(prefix.length), value);
			const originalRead = async path => {
				assert.ok(records.has(path), path);
				return records.get(path);
			};
			const tap = get(`${run.route}/run.tap`);
			const verification = get(`${run.route}/verification.json`);
			const original = json(verification, `${run.route}/verification.json`);
			const checked = await checkCheckedRecordValueIndexJvmCiRecords({
				route: run.route, producer: revisions.producer, consumer: revisions.consumer
				, directory: `/archive/${run.route}/records`
				, tap: `/archive/${run.route}/run.tap`, glibc: original.floor
				, java: index.tools.java.command, javac: index.tools.javac.command
				, kotlinc: index.tools.kotlinc.command
			}, {
				tap: tap.toString(), read: originalRead, runtime: index.runtime
				, tools: index.tools, archiveSha256: original.archiveSha256
			});
			const selection = checkedRecordValueIndexJvmSelection(run.route);
			assert.deepEqual(run, {
				route: run.route, reviewed: selection.reviewed
				, resultOnly: selection.resultOnly, recordCount: records.size
				, accepted: checked, tapSha256: sha256(tap)
				, verificationSha256: sha256(verification)
			});
			assert.equal(verification.toString(), canonicalJson(checked));
			expectedPaths.push(`${run.route}/run.tap`
				, `${run.route}/verification.json`
				, ...[...records.keys()].map(path => prefix + path));
			accepted.push(checked);
		}
		assert.deepEqual(Object.keys(index.hostedRun).sort(), [
			"apiRecords", "artifact", "createdAt", "event", "job", "repository"
			, "runAttempt", "runId", "updatedAt", "url", "workflow"
		].sort());
		assert.equal(index.hostedRun.repository, "seanmorris/lean-bridge");
		assert.equal(index.hostedRun.workflow
			, ".github/workflows/checked-record-value-index-jvm.yml");
		assert.equal(index.hostedRun.runId, 39213054169);
		assert.equal(index.hostedRun.artifact.id, 12169642246);
		assert.equal(index.hostedRun.artifact.bytes, 205735533);
		assert.equal(index.hostedRun.artifact.sha256
			, "db8293fc2d4a3147483fdcd46770f60fe9f54f5edd4314cb0705da50bfb17f7e");
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
			...revisions, accepted, runtime: index.runtime, tools: index.tools
			, hostedRun: index.hostedRun, files: index.files
			, supportPromoted: false, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached = checking;
	return checking;
};
