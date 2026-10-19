/**
 * Authenticate the immutable hosted native-PHP value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexPhpCiRecords
} from "./checked-record-value-index-php-ci-report.mjs";
import {
	checkCheckedRecordValueIndexPhpControls
} from "./checked-record-value-index-php-controls.mjs";
import {
	checkedRecordValueIndexPhpRoutes, checkedRecordValueIndexPhpSelection
} from "./checked-record-value-index-php-fixture.mjs";
import {
	checkedRecordValueIndexHostedOriginal
	, checkedRecordValueIndexPhpEvidenceSources
} from "./checked-record-value-index-hosted-evidence-sources.mjs";

export const checkedRecordValueIndexPhpEvidence
	= "docs/evidence/checked-record-value-index-php-20261019";
export const checkedRecordValueIndexPhpEvidenceSha256
	= "cc707f049a1beb59a8e2fb0d9324baa45e39515f50e5c6ac1d11772673d1642e";
const revisions = Object.freeze({
	producer: "55bf01a8351c55aae64bd7d5e8ed695cd9bde78c"
	, consumer: "55bf01a8351c55aae64bd7d5e8ed695cd9bde78c"
	, checker: "55bf01a8351c55aae64bd7d5e8ed695cd9bde78c"
	, archiver: "f3776db652eff126411c9a52173beb34a0c5bc90"
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
 * Verify every retained byte, source snapshot, route replay and negative
 * control without treating a hosted green check as sufficient evidence.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkCheckedRecordValueIndexPhpEvidence = async (read = readFile) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const indexBytes = Buffer.from(await read(`${checkedRecordValueIndexPhpEvidence}/index.json`));
		assert.equal(sha256(indexBytes), checkedRecordValueIndexPhpEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "consumerCommit", "files", "hostedRun"
			, "kind", "limitations", "producerCommit", "runs", "runtime", "schemaVersion"
			, "selectedSources", "tools"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "checked-record-value-index-php-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.consumerCommit, revisions.consumer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.deepEqual(index.runtime, { platform: "linux", arch: "x64", glibc: "2.39" });
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 6
			&& index.limitations.every(item => typeof item === "string" && item));
		let previous = "";
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(!previous || previous.localeCompare(entry.path) < 0); previous = entry.path;
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(`${checkedRecordValueIndexPhpEvidence}/${entry.path}`));
			assert.equal(value.length, entry.bytes, entry.path);
			assert.equal(sha256(value), entry.sha256, entry.path); files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
		};
		assert.deepEqual(index.selectedSources, checkedRecordValueIndexPhpEvidenceSources(revisions));
		const expectedPaths = [];
		for(const source of index.selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`; expectedPaths.push(path);
			assert.deepEqual(get(path), checkedRecordValueIndexHostedOriginal(source.revision, source.path), path);
		}
		const tools = json(get("hosted/tools.json"), "hosted/tools.json");
		assert.deepEqual(index.tools, tools);
		assert.deepEqual(Object.keys(tools.selected).sort(), [
			"composer", "composerVersion", "php", "phpVersion"
		]);
		expectedPaths.push("hosted/tools.json");
		assert.deepEqual(index.runs.map(run => run.route), checkedRecordValueIndexPhpRoutes);
		const accepted = [], controls = [];
		for(const run of index.runs)
		{
			assert.deepEqual(Object.keys(run).sort(), [
				"accepted", "recordCount", "resultOnly", "reviewed", "route", "tapSha256"
				, "verificationSha256"
			].sort());
			const prefix = `${run.route}/records/`, records = new Map();
			for(const [path, value] of files)
				if(path.startsWith(prefix)) records.set(path.slice(prefix.length), value);
			const originalRead = async path => {
				assert.ok(records.has(path), path); return records.get(path);
			};
			const tap = get(`${run.route}/run.tap`), verification = get(`${run.route}/verification.json`);
			const original = json(verification, `${run.route}/verification.json`);
			const args = [
				"--route", run.route, "--producer", revisions.producer
				, "--directory", `/archive/${run.route}/records`
				, "--tap", `/archive/${run.route}/run.tap`
				, "--glibc", original.floor, "--php", tools.selected.php
				, "--composer", tools.selected.composer
				, "--php-version", tools.selected.phpVersion
				, "--composer-version", tools.selected.composerVersion
			];
			const checked = await checkCheckedRecordValueIndexPhpCiRecords(args, {
				tap: tap.toString(), read: originalRead, runtime: index.runtime, tools
			});
			const selection = checkedRecordValueIndexPhpSelection(run.route);
			assert.deepEqual(run, {
				route: run.route, reviewed: selection.reviewed
				, resultOnly: selection.resultOnly
				, recordCount: records.size, accepted: checked, tapSha256: sha256(tap)
				, verificationSha256: sha256(verification)
			});
			assert.equal(verification.toString(), canonicalJson(checked));
			controls.push(await checkCheckedRecordValueIndexPhpControls(records, {
				route: run.route, producerCommit: revisions.producer, runtime: index.runtime
				, floor: original.floor, phpVersion: tools.selected.phpVersion
				, composerVersion: tools.selected.composerVersion, tools
			}));
			expectedPaths.push(`${run.route}/run.tap`, `${run.route}/verification.json`
				, ...[...records.keys()].map(path => prefix + path));
			accepted.push(checked);
		}
		assert.deepEqual(Object.keys(index.hostedRun).sort(), [
			"apiRecords", "artifact", "createdAt", "event", "job", "repository"
			, "runAttempt", "runId", "updatedAt", "url", "workflow"
		].sort());
		assert.equal(index.hostedRun.repository, "seanmorris/lean-bridge");
		assert.equal(index.hostedRun.workflow, ".github/workflows/checked-record-value-index-php.yml");
		assert.equal(index.hostedRun.runId, 39318504656);
		assert.equal(index.hostedRun.artifact.id, 12220100407);
		assert.equal(index.hostedRun.artifact.bytes, 205661639);
		assert.equal(index.hostedRun.artifact.sha256, "be7f534d80ae9903b0dcee66bd97807495bb1594ccdfc7f96dc41111ff33000a");
		const archiveHash = createHash("sha256"); let archiveBytes = 0;
		for(const part of index.hostedRun.artifact.parts)
		{
			assert.deepEqual(Object.keys(part).sort(), ["bytes", "offset", "path", "sha256"]);
			const value = get(part.path); assert.equal(value.length, part.bytes, part.path);
			assert.equal(sha256(value), part.sha256, part.path);
			assert.equal(part.offset, archiveBytes, part.path);
			archiveHash.update(value); archiveBytes += value.length; expectedPaths.push(part.path);
		}
		assert.equal(archiveBytes, index.hostedRun.artifact.bytes);
		assert.equal(archiveHash.digest("hex"), index.hostedRun.artifact.sha256);
		for(const [name, detail] of Object.entries(index.hostedRun.apiRecords))
		{
			const path = `hosted/api/${name}.json`, value = get(path);
			assert.deepEqual(Object.keys(detail).sort(), ["bytes", "sha256"]);
			assert.equal(value.length, detail.bytes, path); assert.equal(sha256(value), detail.sha256, path);
			expectedPaths.push(path);
		}
		expectedPaths.push("hosted/logs/toolchain.log");
		assert.ok(get("hosted/logs/toolchain.log").length > 0);
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			...revisions, accepted, controls, runtime: index.runtime, tools: index.tools
			, hostedRun: index.hostedRun, files: index.files
			, supportPromoted: false, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached = checking;
	return checking;
};
