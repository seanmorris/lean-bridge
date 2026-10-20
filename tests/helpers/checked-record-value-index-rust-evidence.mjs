/**
 * Authenticate the immutable hosted Rust value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkedRecordValueIndexRustCiReader
	, checkCheckedRecordValueIndexRustCiRecords
} from "./checked-record-value-index-rust-ci-report.mjs";
import {
	checkedRecordValueIndexRustRoutes
} from "./checked-record-value-index-rust-fixture.mjs";
import {
	checkedRecordValueIndexBrowserSelection
} from "./checked-record-value-index-browser-fixture.mjs";
import {
	checkedRecordValueIndexHostedOriginal
	, checkedRecordValueIndexRustEvidenceSources
} from "./checked-record-value-index-hosted-evidence-sources.mjs";

export const checkedRecordValueIndexRustEvidence
	= "docs/evidence/checked-record-value-index-rust-20261020";
export const checkedRecordValueIndexRustEvidenceSha256
	= "38312f1cc0d63b51343477f5a0f1681b39eff75308e9c80f710e6524183232ea";
const revisions = Object.freeze({
	producer: "019b6896f876878c9547305d7f755a54c62a03ff"
	, consumer: "019b6896f876878c9547305d7f755a54c62a03ff"
	, checker: "019b6896f876878c9547305d7f755a54c62a03ff"
	, archiver: "019b6896f876878c9547305d7f755a54c62a03ff"
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
 * Verify every retained byte, source snapshot, route replay, crate,
 * dependency closure, and the complete original hosted artifact.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkCheckedRecordValueIndexRustEvidence = async (
	read = readFile
) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const indexBytes = Buffer.from(await read(
			`${checkedRecordValueIndexRustEvidence}/index.json`));
		assert.equal(sha256(indexBytes), checkedRecordValueIndexRustEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "consumerCommit", "files"
			, "hostedRun", "kind", "limitations", "producerCommit", "runs"
			, "runtime", "schemaVersion", "selectedSources", "toolchain"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "checked-record-value-index-rust-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.consumerCommit, revisions.consumer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
		assert.deepEqual(index.runtime, {
			platform: "linux", arch: "x64", glibc: "2.39"
		});
		assert.deepEqual(Object.keys(index.toolchain).sort(), ["cargo", "rustc"]);
		for(const name of ["cargo", "rustc"])
		{
			assert.match(index.toolchain[name].command
				, new RegExp(`/\\.toolchains/rust-1\\.90\\.0/bin/${name}$`, "u"));
			assert.match(index.toolchain[name].sha256, /^[a-f0-9]{64}$/u);
			assert.ok(Number.isSafeInteger(index.toolchain[name].bytes)
				&& index.toolchain[name].bytes > 0);
			assert.equal(index.toolchain[name].run.code, 0);
			assert.equal(index.toolchain[name].run.stderr, "");
			assert.match(index.toolchain[name].run.stdout
				, new RegExp(`^${name} 1\\.90\\.0 `, "u"));
		}
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 6
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
				`${checkedRecordValueIndexRustEvidence}/${entry.path}`));
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
			, checkedRecordValueIndexRustEvidenceSources(revisions));
		const expectedPaths = [];
		for(const source of index.selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(get(path), checkedRecordValueIndexHostedOriginal(
				source.revision, source.path), path);
		}
		assert.deepEqual(index.runs.map(run => run.route)
			, checkedRecordValueIndexRustRoutes);
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
			const retainedRead = await checkedRecordValueIndexRustCiReader(originalRead);
			const tapPath = `${run.route}/run.tap`;
			const verificationPath = `${run.route}/verification.json`;
			const tap = get(tapPath), verification = get(verificationPath);
			const original = json(verification, verificationPath);
			assert.deepEqual(original.runtime, index.runtime);
			assert.deepEqual(original.toolchain, index.toolchain);
			const checked = await checkCheckedRecordValueIndexRustCiRecords({
				route: run.route, producer: revisions.producer
				, directory: `/archive/${run.route}/records`, tap: tapPath
				, glibc: original.floor, rustc: index.toolchain.rustc.command
				, cargo: index.toolchain.cargo.command
			}, {
				tap: tap.toString(), read: retainedRead, runtime: index.runtime
				, toolchain: index.toolchain
			});
			assert.deepEqual(original, checked);
			assert.deepEqual(run.accepted, checked);
			assert.equal(run.tapSha256, sha256(tap));
			assert.equal(run.verificationSha256, sha256(verification));
			const selection = checkedRecordValueIndexBrowserSelection(run.route);
			assert.deepEqual([run.reviewed, run.resultOnly]
				, [selection.reviewed, selection.resultOnly]);
			expectedPaths.push(tapPath, verificationPath
				, ...[...records.keys()].map(path => prefix + path));
			artifactMembers.push(
				...[...records.keys()].map(path =>
					`checked-record-value-index-rust-ci/${run.route}/records/${run.route}/${path}`)
				, `checked-record-value-index-rust-ci/${run.route}/run.tap`
				, `checked-record-value-index-rust-ci/${run.route}/verification.json`
			);
			accepted.push(checked);
		}
		assert.deepEqual(Object.keys(index.hostedRun).sort(), [
			"apiRecords", "artifact", "createdAt", "event", "job", "repository"
			, "runAttempt", "runId", "updatedAt", "url", "workflow"
		].sort());
		assert.equal(index.hostedRun.repository, "seanmorris/lean-bridge");
		assert.equal(index.hostedRun.workflow
			, ".github/workflows/checked-record-value-index-rust.yml");
		assert.equal(index.hostedRun.runId, 39379254943);
		assert.equal(index.hostedRun.runAttempt, 1);
		assert.equal(index.hostedRun.job.id, 118484326631);
		assert.equal(index.hostedRun.artifact.id, 12245482092);
		assert.equal(index.hostedRun.artifact.bytes, 210911594);
		assert.equal(index.hostedRun.artifact.sha256
			, "b70ff14ce1d0e4c5b66d1806bf85934071d03d5999537d7a19b11475efcfd1fc");
		assert.equal(index.hostedRun.artifact.apiDigest
			, `sha256:${index.hostedRun.artifact.sha256}`);
		assert.deepEqual([...index.hostedRun.artifact.members].sort(), [
			...artifactMembers, "checked-record-value-index-rust-toolchain.log"
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
			...revisions, accepted, runtime: index.runtime, toolchain: index.toolchain
			, hostedRun: index.hostedRun, files: index.files
			, supportPromoted: false, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached = checking;
	return checking;
};
