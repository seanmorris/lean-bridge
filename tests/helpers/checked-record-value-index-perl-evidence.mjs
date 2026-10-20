/**
 * Authenticate the immutable hosted Perl value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexPerlCiRecords
} from "./checked-record-value-index-perl-ci-report.mjs";
import {
	checkedRecordValueIndexPerlRoutes, checkedRecordValueIndexPerlSelection
} from "./checked-record-value-index-perl-fixture.mjs";
import {
	checkedRecordValueIndexPerlConfigurations
} from "./checked-record-value-index-perl-install.mjs";
import {
	checkedRecordValueIndexHostedOriginal
	, checkedRecordValueIndexPerlEvidenceSources
} from "./checked-record-value-index-hosted-evidence-sources.mjs";

export const checkedRecordValueIndexPerlEvidence
	= "docs/evidence/checked-record-value-index-perl-20261019";
export const checkedRecordValueIndexPerlEvidenceSha256
	= "ffb4b76ea9e79a3035f6b84c586101c034e0f29dad67ddd79b225e7e9f75b2a9";
const revisions = Object.freeze({
	producer: "167ee182dc760c6d6f4a40765f94941741f40938"
	, consumer: "167ee182dc760c6d6f4a40765f94941741f40938"
	, checker: "167ee182dc760c6d6f4a40765f94941741f40938"
	, archiver: "99ebea35d6eaf3f7a5a0d53a5e855f2348b8c25b"
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
const expectedInterpreters = Object.freeze([
	{
		configuration: "5.36.3-threaded", bytes: 3981264
		, sha256: "acfdcae55702c361e1022655c19244d35b5b6f6a67f4b10f8762f6efa0db0dfe"
		, identity: {
			archname: "x86_64-linux-thread-multi", ivsize: "8", ptrsize: "8"
			, useithreads: "define", usemultiplicity: "define", version: "5.36.3"
		}
	}
	, {
		configuration: "5.36.3-unthreaded", bytes: 3853384
		, sha256: "f8b4020c96ac4c55cb2b07fd60d43ece91f79f94ce2a5ee3fc232a2fe8dfab07"
		, identity: {
			archname: "x86_64-linux", ivsize: "8", ptrsize: "8"
			, useithreads: null, usemultiplicity: null, version: "5.36.3"
		}
	}
	, {
		configuration: "5.38.2-threaded", bytes: 4067760
		, sha256: "c2ac13b8d18279263aabf637c341e54e46eb9bfb2a9977cb62beec81cd0812f9"
		, identity: {
			archname: "x86_64-linux-thread-multi", ivsize: "8", ptrsize: "8"
			, useithreads: "define", usemultiplicity: "define", version: "5.38.2"
		}
	}
	, {
		configuration: "5.38.2-unthreaded", bytes: 3931296
		, sha256: "57acb9ffc143d8610219ebd716fed5a5405d4903f550ce1cc14c624c3cf68e47"
		, identity: {
			archname: "x86_64-linux", ivsize: "8", ptrsize: "8"
			, useithreads: null, usemultiplicity: null, version: "5.38.2"
		}
	}
]);
let cached;

/**
 * Verify every retained byte, source snapshot, TAP stream and route result.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkCheckedRecordValueIndexPerlEvidence = async (
	read = readFile
) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const indexBytes = Buffer.from(await read(
			`${checkedRecordValueIndexPerlEvidence}/index.json`));
		assert.equal(sha256(indexBytes), checkedRecordValueIndexPerlEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "consumerCommit", "files", "hostedRun"
			, "interpreters", "kind", "limitations", "producerCommit", "runs"
			, "runtime", "schemaVersion", "selectedSources"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "checked-record-value-index-perl-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.consumerCommit, revisions.consumer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.deepEqual(index.runtime, {
			platform: "linux", arch: "x64", glibc: "2.39"
		});
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 6
			&& index.limitations.every(item => typeof item === "string" && item));
		assert.deepEqual(index.interpreters.map(item => item.configuration)
			, checkedRecordValueIndexPerlConfigurations);
		for(let offset = 0; offset < expectedInterpreters.length; offset += 1)
		{
			const observed = index.interpreters[offset];
			const expected = expectedInterpreters[offset];
			assert.deepEqual(Object.keys(observed).sort(), [
				"command", "configuration", "executable", "identity"
			]);
			assert.equal(observed.configuration, expected.configuration);
			assert.match(observed.command, new RegExp(
				`/perl/${expected.configuration}/bin/perl$`, "u"));
			assert.deepEqual(observed.executable, {
				bytes: expected.bytes, sha256: expected.sha256
			});
			assert.deepEqual(observed.identity, expected.identity);
		}
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
				`${checkedRecordValueIndexPerlEvidence}/${entry.path}`));
			assert.equal(value.length, entry.bytes, entry.path);
			assert.equal(sha256(value), entry.sha256, entry.path);
			files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
		};
		assert.deepEqual(index.selectedSources
			, checkedRecordValueIndexPerlEvidenceSources(revisions));
		const expectedPaths = [], artifactMembers = [];
		for(const source of index.selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(get(path), checkedRecordValueIndexHostedOriginal(
				source.revision, source.path), path);
		}
		assert.deepEqual(index.runs.map(run => run.route)
			, checkedRecordValueIndexPerlRoutes);
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
				assert.ok(records.has(path), path); return records.get(path);
			};
			const tap = get(`${run.route}/run.tap`);
			const verification = get(`${run.route}/verification.json`);
			const original = json(verification, `${run.route}/verification.json`);
			const checked = await checkCheckedRecordValueIndexPerlCiRecords({
				route: run.route, producer: revisions.producer
				, directory: `/archive/${run.route}/records`
				, tap: tap.toString(), glibc: original.floor
				, maxLoad: original.maxLoad, read: originalRead
				, paths: [...records.keys()].sort(), runtime: index.runtime
				, interpreters: index.interpreters
			});
			const selection = checkedRecordValueIndexPerlSelection(run.route);
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
			const artifactPrefix = `checked-record-value-index-perl-ci/${run.route}`;
			artifactMembers.push(`${artifactPrefix}/run.tap`
				, `${artifactPrefix}/verification.json`
				, ...[...records.keys()].map(path =>
					`${artifactPrefix}/records/${run.route}/${path}`));
			accepted.push(checked);
		}
		assert.deepEqual(Object.keys(index.hostedRun).sort(), [
			"apiRecords", "artifact", "createdAt", "event", "job", "repository"
			, "runAttempt", "runId", "updatedAt", "url", "workflow"
		].sort());
		assert.equal(index.hostedRun.repository, "seanmorris/lean-bridge");
		assert.equal(index.hostedRun.workflow
			, ".github/workflows/checked-record-value-index-perl.yml");
		assert.equal(index.hostedRun.runId, 39349265084);
		assert.equal(index.hostedRun.artifact.id, 12232698994);
		assert.equal(index.hostedRun.artifact.bytes, 206500779);
		assert.equal(index.hostedRun.artifact.sha256
			, "4d37ca5865a6c8bde1c8708f19da9bbdb0be49b8d195ea0fd2624fb3c8497d69");
		assert.equal(index.hostedRun.artifact.apiDigest
			, `sha256:${index.hostedRun.artifact.sha256}`);
		assert.equal(index.hostedRun.artifact.name
			, `checked-record-value-index-perl-${revisions.producer}`);
		artifactMembers.push("checked-record-value-index-perl-toolchain.log");
		assert.equal(new Set(index.hostedRun.artifact.members).size
			, index.hostedRun.artifact.members.length);
		assert.deepEqual([...index.hostedRun.artifact.members].sort()
			, artifactMembers.sort());
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
			assert.equal(value.length, detail.bytes, path);
			assert.equal(sha256(value), detail.sha256, path); expectedPaths.push(path);
		}
		expectedPaths.push("hosted/logs/toolchain.log");
		assert.ok(get("hosted/logs/toolchain.log").length > 0);
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			...revisions, accepted, runtime: index.runtime
			, interpreters: index.interpreters, hostedRun: index.hostedRun
			, files: index.files, supportPromoted: false, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached = checking;
	return checking;
};
