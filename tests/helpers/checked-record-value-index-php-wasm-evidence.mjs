/**
 * Authenticate the immutable hosted PHP-Wasm value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	assertCheckedRecordValueIndexPhpWasmCompilerTap
	, checkCheckedRecordValueIndexPhpWasmCiRecords
} from "./checked-record-value-index-php-wasm-ci-report.mjs";
import {
	checkedRecordValueIndexBrowserRoutes
} from "./checked-record-value-index-browser-fixture.mjs";
import {
	checkCheckedRecordValueIndexPhpWasmModel
} from "./checked-record-value-index-php-wasm-fixture.mjs";
import {
	checkedRecordValueIndexHostedOriginal
	, checkedRecordValueIndexPhpWasmEvidenceSources
} from "./checked-record-value-index-hosted-evidence-sources.mjs";

export const checkedRecordValueIndexPhpWasmEvidence
	= "docs/evidence/checked-record-value-index-php-wasm-20261020";
export const checkedRecordValueIndexPhpWasmEvidenceSha256
	= "049131f6a2ef0059dd3808252f980a12c5cf780d72677420f3107d285e26ba6f";
const revisions = Object.freeze({
	producer: "54c5b0f5f299ed7bf8cfa51179d89e83a32a6f70"
	, consumer: "54c5b0f5f299ed7bf8cfa51179d89e83a32a6f70"
	, checker: "54c5b0f5f299ed7bf8cfa51179d89e83a32a6f70"
	, archiver: "352c592c2bd85481d996759b812d597bc54b5354"
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
 * Verify every retained byte, source closure, compiler probe, installed route,
 * runtime record, and the original hosted artifact.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkCheckedRecordValueIndexPhpWasmEvidence = async (
	read = readFile
) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const indexBytes = Buffer.from(await read(
			`${checkedRecordValueIndexPhpWasmEvidence}/index.json`));
		assert.equal(sha256(indexBytes), checkedRecordValueIndexPhpWasmEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "compiler", "consumerCommit"
			, "files", "hostedRun", "kind", "limitations", "producerCommit"
			, "runs", "runtime", "schemaVersion", "selectedSources"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "checked-record-value-index-php-wasm-installed-v1");
		assert.equal(index.producerCommit, revisions.producer);
		assert.equal(index.consumerCommit, revisions.consumer);
		assert.equal(index.checkerCommit, revisions.checker);
		assert.equal(index.archiveCommit, revisions.archiver);
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
				`${checkedRecordValueIndexPhpWasmEvidence}/${entry.path}`));
			assert.equal(value.length, entry.bytes, entry.path);
			assert.equal(sha256(value), entry.sha256, entry.path);
			files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path);
			assert.ok(Buffer.isBuffer(value), path);
			return value;
		};
		const expectedPaths = [];
		assert.deepEqual(index.selectedSources
			, checkedRecordValueIndexPhpWasmEvidenceSources(revisions));
		for(const source of index.selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(get(path), checkedRecordValueIndexHostedOriginal(
				source.revision, source.path), path);
		}

		assert.deepEqual(index.compiler.routes, checkedRecordValueIndexBrowserRoutes);
		const compilerTap = get("compiler/run.tap");
		assertCheckedRecordValueIndexPhpWasmCompilerTap(compilerTap.toString());
		assert.equal(index.compiler.tapSha256, sha256(compilerTap));
		const compilerObservations = [...compilerTap.toString()
			.matchAll(/^# (\{.*\})$/gmu)].map(match => JSON.parse(match[1]));
		assert.deepEqual(index.compiler.observations, compilerObservations);
		assert.equal(get("compiler/check.log").toString()
			, "Four fresh-Lean value-index PHP-Wasm compiler tests passed without skips.\n");
		expectedPaths.push("compiler/run.tap", "compiler/check.log");
		for(const observation of compilerObservations)
		{
			const prefix = `compiler/records/${observation.route}/`;
			const expected = ["adapters.lean", "generated.c", "model.json", "provider.c"];
			const model = json(get(prefix + "model.json")
				, prefix + "model.json");
			checkCheckedRecordValueIndexPhpWasmModel(model, observation.route);
			assert.equal(sha256(get(prefix + "generated.c"))
				, observation.generatedCSha256, observation.route);
			expectedPaths.push(...expected.map(path => prefix + path));
		}

		assert.deepEqual(index.runs.map(run => run.route)
			, checkedRecordValueIndexBrowserRoutes);
		const accepted = [];
		for(const run of index.runs)
		{
			assert.deepEqual(Object.keys(run).sort(), [
				"accepted", "recordCount", "route", "tapSha256"
				, "verificationSha256"
			].sort());
			const prefix = `${run.route}/records/`, records = new Map();
			for(const [path, value] of files)
				if(path.startsWith(prefix)) records.set(path.slice(prefix.length), value);
			assert.equal(records.size, run.recordCount);
			const tapPath = `${run.route}/run.tap`;
			const verificationPath = `${run.route}/check.log`;
			const tap = get(tapPath), verification = get(verificationPath);
			const original = json(verification, verificationPath);
			const checked = await checkCheckedRecordValueIndexPhpWasmCiRecords({
				route: run.route, producer: revisions.producer
				, directory: `/archive/${run.route}/records`, tap: tapPath
			}, {
				tap: tap.toString()
				, read: async path => {
					const value = records.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
				}
			});
			assert.deepEqual(original, checked);
			assert.deepEqual(run.accepted, checked);
			assert.equal(run.tapSha256, sha256(tap));
			assert.equal(run.verificationSha256, sha256(verification));
			const report = json(records.get("report.json"), `${run.route}/report.json`);
			assert.deepEqual(report.phpWasm.runtime, index.runtime);
			expectedPaths.push(tapPath, verificationPath
				, ...[...records.keys()].map(path => prefix + path));
			accepted.push(checked);
		}
		const runtimePath = "hosted/runtime/runtime.json";
		assert.deepEqual(json(get(runtimePath), runtimePath), index.runtime);
		expectedPaths.push(runtimePath);

		assert.equal(index.hostedRun.repository, "seanmorris/lean-bridge");
		assert.equal(index.hostedRun.workflow
			, ".github/workflows/checked-record-value-index-php-wasm.yml");
		assert.equal(index.hostedRun.runId, 39370772629);
		assert.equal(index.hostedRun.runAttempt, 1);
		assert.equal(index.hostedRun.job.id, 118457915890);
		assert.equal(index.hostedRun.artifact.id, 12241424497);
		assert.equal(index.hostedRun.artifact.bytes, 7940255);
		assert.equal(index.hostedRun.artifact.sha256
			, "83a5df27619c017a00d0e53023da3db958b1cdb8adac0ebce3b83ff363a7fe9b");
		assert.equal(index.hostedRun.artifact.apiDigest
			, `sha256:${index.hostedRun.artifact.sha256}`);
		assert.ok(Array.isArray(index.hostedRun.artifact.members)
			&& index.hostedRun.artifact.members.length === 221);
		assert.equal(new Set(index.hostedRun.artifact.members).size
			, index.hostedRun.artifact.members.length);
		assert.ok(index.hostedRun.artifact.members.every(safePath));
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
		for(const path of ["hosted/logs/host.log", "hosted/logs/runtime.log"])
		{
			assert.ok(get(path).length > 0); expectedPaths.push(path);
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			...revisions, accepted, runtime: index.runtime
			, hostedRun: index.hostedRun, files: index.files
			, supportPromoted: false, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached = checking;
	return checking;
};
