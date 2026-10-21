/**
 * Authenticate the immutable hosted Rust dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	dependentCheckedRecordRustCiReader
	, checkDependentCheckedRecordRustCiRecords
} from "./dependent-checked-record-rust-ci-report.mjs";
import {
	dependentCheckedRecordRustRoutes
} from "./dependent-checked-record-rust-fixture.mjs";
import {
	dependentCheckedRecordSelection
} from "./dependent-checked-record-browser-fixture.mjs";
import {
	dependentCheckedRecordHostedOriginal
	, dependentCheckedRecordRustEvidenceSources
} from "./dependent-checked-record-hosted-evidence-sources.mjs";

export const dependentCheckedRecordRustEvidence
	= "docs/evidence/dependent-checked-record-rust-20261021";
export const dependentCheckedRecordRustEvidenceSha256
	= "72338890cb5b3be545196b9267887cb097bfa4758f7909b6323e49da11b6b197";
const revisions = Object.freeze({
	producer: "d2f3e5c869d84b77c228b2efebe18d86172d81b1"
	, consumer: "d2f3e5c869d84b77c228b2efebe18d86172d81b1"
	, checker: "d2f3e5c869d84b77c228b2efebe18d86172d81b1"
	, archiver: "9949ea979f9a3fd4ccf0db4d2fb0006c088cfc29"
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
 * Verify every retained byte, route replay, crate, dependency closure, source
 * snapshot and the complete original hosted artifact.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkDependentCheckedRecordRustEvidence = async (
	read = readFile
) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const indexBytes = Buffer.from(await read(
			`${dependentCheckedRecordRustEvidence}/index.json`));
		assert.equal(sha256(indexBytes)
			, dependentCheckedRecordRustEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "consumerCommit", "files"
			, "hostedRun", "kind", "limitations", "producerCommit", "runs"
			, "runtime", "schemaVersion", "selectedSources", "toolchain"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "dependent-checked-record-rust-installed-v1");
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
		assert.ok(Array.isArray(index.limitations)
			&& index.limitations.length === 7
			&& index.limitations.every(item => typeof item === "string" && item));
		let previous = "";
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort()
				, ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(!previous || previous.localeCompare(entry.path) < 0
				, entry.path);
			previous = entry.path;
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(
				`${dependentCheckedRecordRustEvidence}/${entry.path}`));
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
			, dependentCheckedRecordRustEvidenceSources(revisions));
		const expectedPaths = [];
		for(const source of index.selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(get(path), dependentCheckedRecordHostedOriginal(
				source.revision, source.path), path);
		}
		assert.deepEqual(index.runs.map(run => run.route)
			, dependentCheckedRecordRustRoutes);
		const accepted = [], artifactMembers = [];
		for(const run of index.runs)
		{
			assert.deepEqual(Object.keys(run).sort(), [
				"accepted", "recordCount", "resultOnly", "reviewed", "route"
				, "tapSha256", "verificationSha256"
			].sort());
			const prefix = `${run.route}/records/`, records = new Map();
			for(const [path, value] of files)
				if(path.startsWith(prefix))
					records.set(path.slice(prefix.length), value);
			assert.equal(records.size, run.recordCount);
			const originalRead = async path => {
				assert.ok(records.has(path), path);
				return records.get(path);
			};
			const retainedRead = await dependentCheckedRecordRustCiReader(
				originalRead);
			const tapPath = `${run.route}/run.tap`;
			const verificationPath = `${run.route}/verification.json`;
			const tap = get(tapPath), verification = get(verificationPath);
			const original = json(verification, verificationPath);
			assert.deepEqual(original.runtime, index.runtime);
			assert.deepEqual(original.toolchain, index.toolchain);
			const checked = await checkDependentCheckedRecordRustCiRecords({
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
			const selection = dependentCheckedRecordSelection(run.route);
			assert.deepEqual([run.reviewed, run.resultOnly]
				, [selection.reviewed, selection.resultOnly]);
			expectedPaths.push(tapPath, verificationPath
				, ...[...records.keys()].map(path => prefix + path));
			artifactMembers.push(
				...[...records.keys()].map(path =>
					`dependent-checked-record-rust-ci/${run.route}/records/${run.route}/${path}`)
				, `dependent-checked-record-rust-ci/${run.route}/run.tap`
				, `dependent-checked-record-rust-ci/${run.route}/verification.json`
			);
			accepted.push(checked);
		}
		assert.deepEqual(Object.keys(index.hostedRun).sort(), [
			"apiRecords", "artifact", "createdAt", "event", "job", "repository"
			, "runAttempt", "runId", "updatedAt", "url", "workflow"
		].sort());
		assert.equal(index.hostedRun.repository, "seanmorris/lean-bridge");
		assert.equal(index.hostedRun.workflow
			, ".github/workflows/dependent-checked-record-rust.yml");
		assert.equal(index.hostedRun.runId, 39664026659);
		assert.equal(index.hostedRun.runAttempt, 1);
		assert.equal(index.hostedRun.job.id, 119444178199);
		assert.equal(index.hostedRun.artifact.id, 12378146701);
		assert.equal(index.hostedRun.artifact.bytes, 210758943);
		assert.equal(index.hostedRun.artifact.sha256
			, "b37d5d0ed7e043754890206399472251a82ba79ccde24e4ba83586e2cfbc7767");
		assert.equal(index.hostedRun.artifact.apiDigest
			, `sha256:${index.hostedRun.artifact.sha256}`);
		assert.deepEqual([...index.hostedRun.artifact.members].sort(), [
			...artifactMembers, "dependent-checked-record-rust-toolchain.log"
		].sort());
		const archiveHash = createHash("sha256");
		let archiveBytes = 0;
		for(const part of index.hostedRun.artifact.parts)
		{
			assert.deepEqual(Object.keys(part).sort(), [
				"bytes", "offset", "path", "sha256"
			]);
			const value = get(part.path);
			assert.equal(value.length, part.bytes, part.path);
			assert.equal(sha256(value), part.sha256, part.path);
			assert.equal(part.offset, archiveBytes, part.path);
			archiveHash.update(value);
			archiveBytes += value.length;
			expectedPaths.push(part.path);
		}
		assert.equal(archiveBytes, index.hostedRun.artifact.bytes);
		assert.equal(archiveHash.digest("hex")
			, index.hostedRun.artifact.sha256);
		for(const [name, detail] of Object.entries(index.hostedRun.apiRecords))
		{
			const path = `hosted/api/${name}.json`, value = get(path);
			assert.deepEqual(Object.keys(detail).sort(), ["bytes", "sha256"]);
			assert.equal(value.length, detail.bytes, path);
			assert.equal(sha256(value), detail.sha256, path);
			JSON.parse(value);
			expectedPaths.push(path);
		}
		expectedPaths.push("hosted/logs/toolchain.log");
		assert.ok(get("hosted/logs/toolchain.log").length > 0);
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			...revisions, accepted, runtime: index.runtime
			, toolchain: index.toolchain, hostedRun: index.hostedRun
			, files: index.files, supportPromoted: false
			, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached = checking;
	return checking;
};
