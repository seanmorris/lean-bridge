/**
 * Authenticate the immutable hosted Ruby value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexRubyCiRecords
} from "./checked-record-value-index-ruby-ci-report.mjs";
import {
	checkedRecordValueIndexRubyRoutes
} from "./checked-record-value-index-ruby-fixture.mjs";
import {
	checkedRecordValueIndexBrowserSelection
} from "./checked-record-value-index-browser-fixture.mjs";
import {
	checkedRecordValueIndexHostedOriginal
	, checkedRecordValueIndexRubyEvidenceSources
} from "./checked-record-value-index-hosted-evidence-sources.mjs";

export const checkedRecordValueIndexRubyEvidence
	= "docs/evidence/checked-record-value-index-ruby-20261020";
export const checkedRecordValueIndexRubyEvidenceSha256
	= "f1caf88b4d1eb543d0b954a7776b773772ed763933fa123942bf459d0d7cbd12";
const revisions = Object.freeze({
	producer: "b122a09dd915faa738c56e277791da77bbbf36f4"
	, consumer: "b122a09dd915faa738c56e277791da77bbbf36f4"
	, checker: "b122a09dd915faa738c56e277791da77bbbf36f4"
	, archiver: "97ada316244c877560c42b5821216a0d19f0dab4"
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
 * Verify every retained byte, source snapshot, route replay, gem, and original
 * hosted artifact without treating a green workflow as sufficient evidence.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkCheckedRecordValueIndexRubyEvidence = async (
	read = readFile
) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const indexBytes = Buffer.from(await read(
			`${checkedRecordValueIndexRubyEvidence}/index.json`));
		assert.equal(sha256(indexBytes), checkedRecordValueIndexRubyEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "consumerCommit", "files"
			, "hostedRun", "interpreter", "kind", "limitations"
			, "producerCommit", "runs", "runtime", "schemaVersion"
			, "selectedSources"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "checked-record-value-index-ruby-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.consumerCommit, revisions.consumer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.deepEqual(index.runtime, {
			platform: "linux", arch: "x64", glibc: "2.39"
		});
		assert.match(index.interpreter.command, /^\/opt\/hostedtoolcache\/Ruby\/3\.3\.12\/x64\/bin\/ruby$/u);
		assert.match(index.interpreter.identity.sha256, /^[a-f0-9]{64}$/u);
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 6
			&& index.limitations.every(item => typeof item === "string" && item));
		let previous = "";
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(!previous || previous.localeCompare(entry.path) < 0);
			previous = entry.path;
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(
				`${checkedRecordValueIndexRubyEvidence}/${entry.path}`));
			assert.equal(value.length, entry.bytes, entry.path);
			assert.equal(sha256(value), entry.sha256, entry.path);
			files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
		};
		assert.deepEqual(index.selectedSources
			, checkedRecordValueIndexRubyEvidenceSources(revisions));
		const expectedPaths = [];
		for(const source of index.selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`, value = get(path);
			expectedPaths.push(path);
			assert.deepEqual(value, checkedRecordValueIndexHostedOriginal(
				source.revision, source.path), path);
		}
		assert.deepEqual(index.runs.map(run => run.route)
			, checkedRecordValueIndexRubyRoutes);
		const accepted = [], artifactMembers = [];
		for(const run of index.runs)
		{
			assert.deepEqual(Object.keys(run).sort(), [
				"accepted", "recordCount", "resultOnly", "reviewed", "route"
				, "tapSha256", "verificationSha256"
			].sort());
			const prefix = `${run.route}/records/`, records = new Map();
			for(const [path, value] of files)
				if(path.startsWith(prefix)) records.set(path.slice(prefix.length), value);
			assert.equal(records.size, run.recordCount);
			const originalRead = async path => {
				assert.ok(records.has(path), path); return records.get(path);
			};
			const tapPath = `${run.route}/run.tap`;
			const verificationPath = `${run.route}/verification.json`;
			const tap = get(tapPath), verification = get(verificationPath);
			const original = json(verification, verificationPath);
			const checked = await checkCheckedRecordValueIndexRubyCiRecords([
				"--route", run.route, "--producer", revisions.producer
				, "--directory", `/archive/${run.route}/records`
				, "--tap", `/archive/${run.route}/run.tap`
				, "--glibc", original.floor
				, "--ruby", index.interpreter.command
			], {
				tap: tap.toString(), read: originalRead, runtime: index.runtime
				, interpreter: index.interpreter
			});
			assert.deepEqual(original, checked); assert.deepEqual(run.accepted, checked);
			assert.equal(run.tapSha256, sha256(tap));
			assert.equal(run.verificationSha256, sha256(verification));
			const selection = checkedRecordValueIndexBrowserSelection(run.route);
			assert.deepEqual([run.reviewed, run.resultOnly]
				, [selection.reviewed, selection.resultOnly]);
			expectedPaths.push(tapPath, verificationPath
				, ...[...records.keys()].map(path => prefix + path));
			artifactMembers.push(
				...[...records.keys()].map(path =>
					`checked-record-value-index-ruby-ci/${run.route}/records/${run.route}/${path}`)
				, `checked-record-value-index-ruby-ci/${run.route}/run.tap`
				, `checked-record-value-index-ruby-ci/${run.route}/verification.json`
			);
			accepted.push(checked);
		}
		assert.deepEqual(Object.keys(index.hostedRun).sort(), [
			"apiRecords", "artifact", "createdAt", "event", "job", "repository"
			, "runAttempt", "runId", "updatedAt", "url", "workflow"
		].sort());
		assert.equal(index.hostedRun.repository, "seanmorris/lean-bridge");
		assert.equal(index.hostedRun.workflow
			, ".github/workflows/checked-record-value-index-ruby.yml");
		assert.equal(index.hostedRun.runId, 39360088323);
		assert.equal(index.hostedRun.artifact.id, 12238516604);
		assert.equal(index.hostedRun.artifact.bytes, 200399565);
		assert.equal(index.hostedRun.artifact.sha256
			, "805e434387f2b04dca75dce5e6dee2dd93e803a885bffaa7ec8c14732fe102e3");
		assert.deepEqual([...index.hostedRun.artifact.members].sort(), [
			...artifactMembers, "checked-record-value-index-ruby-toolchain.log"
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
			assert.equal(sha256(value), detail.sha256, path); expectedPaths.push(path);
		}
		expectedPaths.push("hosted/logs/toolchain.log");
		assert.ok(get("hosted/logs/toolchain.log").length > 0);
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			...revisions, accepted, runtime: index.runtime
			, interpreter: index.interpreter, hostedRun: index.hostedRun
			, files: index.files, supportPromoted: false, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached = checking;
	return checking;
};
