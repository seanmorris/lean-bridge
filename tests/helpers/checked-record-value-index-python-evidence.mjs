/**
 * Authenticate the immutable hosted Python value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexPythonCiRecords
} from "./checked-record-value-index-python-ci-report.mjs";
import {
	checkedRecordValueIndexPythonMinors, checkedRecordValueIndexPythonRoutes
	, checkedRecordValueIndexPythonSelection
} from "./checked-record-value-index-python-fixture.mjs";
import {
	checkedRecordValueIndexHostedOriginal
	, checkedRecordValueIndexPythonEvidenceSources
} from "./checked-record-value-index-hosted-evidence-sources.mjs";

export const checkedRecordValueIndexPythonEvidence
	= "docs/evidence/checked-record-value-index-python-20261020";
export const checkedRecordValueIndexPythonEvidenceSha256
	= "f06a15fd17e5a78c62c7d3a2e4fd0bc07d5acc1e96dfbf95f42d3203d88aa8c7";
const revisions = Object.freeze({
	producer: "55bf01a8351c55aae64bd7d5e8ed695cd9bde78c"
	, consumer: "55bf01a8351c55aae64bd7d5e8ed695cd9bde78c"
	, checker: "55bf01a8351c55aae64bd7d5e8ed695cd9bde78c"
	, archiver: "ddcf369747f1ae3ac8770c236cec7e60f0edd488"
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
const prettyJson = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), `${JSON.stringify(value, null, 2)}\n`, label);
	return value;
};
let cached;

const checkRouteRecords = (records, route, sources) => {
	const get = path => {
		const value = records.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
	};
	const selection = checkedRecordValueIndexPythonSelection(route);
	const report = json(get("report.json"), `${route}/report.json`);
	assert.deepEqual(json(get("configuration.json"), `${route}/configuration.json`)
		, selection.configuration);
	assert.deepEqual(json(get("expected.binding-ir.json"), `${route}/expected.binding-ir.json`)
		, selection.expected);
	assert.deepEqual(json(get("runtime.json"), `${route}/runtime.json`), report.runtime);
	assert.deepEqual(json(get("interpreters.json"), `${route}/interpreters.json`)
		, report.interpreters);
	const source = path => {
		const key = `sources/producer/tests/fixtures/onboarding/checked-record-value-indices/${path}`;
		const value = sources.get(key); assert.ok(Buffer.isBuffer(value), key); return value;
	};
	const configuration = get("configuration.json"), expected = get("expected.binding-ir.json");
	for(const [index, build] of report.builds.entries())
	{
		const prefix = `build-${index}/`, author = json(get(prefix + "author-inputs.json")
			, `${route}/${prefix}author-inputs.json`);
		const generated = new Map([
			["lean-bridge.exports.json", configuration]
			, ...(selection.reviewed ? [["api.binding-ir.json", expected]] : [])
		]);
		const expectedNames = [
			"CheckedRecordValueIndices.lean", "LICENSE", "lakefile.toml"
			, "lean-bridge.exports.json", "lean-toolchain", "package.json"
			, ...(selection.reviewed ? ["api.binding-ir.json"] : [])
		].sort();
		assert.deepEqual(author.map(item => item.path).sort(), expectedNames);
		for(const item of author)
		{
			assert.deepEqual(Object.keys(item).sort(), ["ctime", "mode", "mtime", "path", "sha256"]);
			assert.equal(item.mode, 33188); assert.ok(Number.isFinite(item.ctime) && item.ctime >= 0);
			assert.ok(Number.isFinite(item.mtime) && item.mtime >= 0);
			const bytes = generated.get(item.path) ?? source(item.path);
			assert.equal(item.sha256, sha256(bytes), item.path);
			if(generated.has(item.path) || item.path === "CheckedRecordValueIndices.lean")
				assert.deepEqual(get(prefix + item.path), bytes, `${prefix}${item.path}`);
		}
		const receipt = get(prefix + "package-set-receipt.json");
		assert.equal(sha256(receipt), build.receiptSha256, `${prefix}receipt`);
		json(receipt, `${route}/${prefix}package-set-receipt.json`);
	}
	const callerPath = "sources/consumer/tests/fixtures/checked-record-value-index-python/python.py";
	assert.ok(Buffer.isBuffer(sources.get(callerPath)), callerPath);
	assert.equal(new Set(report.reports.map(item => item.consumerSha256)).size, 1);
	assert.equal(report.reports[0].consumerSha256, sha256(sources.get(callerPath)));
	assert.deepEqual(report.reports.map(item => item.minor), checkedRecordValueIndexPythonMinors);
	const wheel = json(get("wheel.json"), `${route}/wheel.json`);
	const archive = get(`handoff/${wheel.archive.path}`);
	assert.equal(archive.length, wheel.archive.bytes);
	assert.equal(sha256(archive), wheel.archive.sha256);
	assert.equal(wheel.archive.sha256, report.builds[0].archives[wheel.archive.path]);
	assert.equal(wheel.archive.sha256, report.builds[1].archives[wheel.archive.path]);
	const retained = new Set(wheel.retained), packaged = Object.keys(wheel.files);
	assert.ok([...retained].every(path => Object.hasOwn(wheel.files, path)));
	assert.deepEqual(packaged.filter(path => !retained.has(path)).sort()
		, Object.keys(wheel.evidence.libraries).map(name =>
			`lean_checkedrecordvalueindices/native/linux-x64/${name}`).sort());
	for(const path of wheel.retained)
	{
		const detail = wheel.files[path];
		const bytes = get(`package/${path}`);
		assert.equal(bytes.length, detail.bytes, path); assert.equal(sha256(bytes), detail.sha256, path);
	}
	const handoffReceipt = get("handoff/package-set-receipt.json");
	json(handoffReceipt, `${route}/handoff/package-set-receipt.json`);
	assert.equal(get("handoff/package-set-receipt.json.sha256").toString()
		, `${sha256(handoffReceipt)}  package-set-receipt.json\n`);
	for(const item of report.reports)
	{
		const prefix = `${item.minor}/`;
		const baseline = json(get(prefix + "baseline.json"), `${route}/${prefix}baseline.json`);
		const environment = json(get(prefix + "environment.json"), `${route}/${prefix}environment.json`);
		assert.equal(baseline.baselineSha256, item.baselineSha256);
		assert.equal(baseline.expectedSha256, item.baselineSha256);
		assert.equal(sha256(canonicalJson(baseline.entries)), item.baselineSha256);
		assert.equal(environment.baselineSha256, item.baselineSha256);
		assert.equal(environment.expectedSha256, item.environmentSha256);
		assert.equal(sha256(canonicalJson(environment.entries)), item.environmentSha256);
		const pip = json(get(prefix + "pip.json"), `${route}/${prefix}pip.json`);
		assert.ok(pip.arguments.includes("--no-index") && pip.arguments.includes("--no-deps"));
		const metadata = json(get(prefix + "pip-metadata.json"), `${route}/${prefix}pip-metadata.json`);
		assert.ok(Object.values(metadata).some(value => typeof value === "string"
			&& value.includes(wheel.archive.sha256)), `${prefix}wheel identity`);
	}
	return { wheel, report };
};

/**
 * Verify every retained byte, source snapshot, route replay and package record
 * without treating a hosted green check as sufficient evidence.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkCheckedRecordValueIndexPythonEvidence = async (read = readFile) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const indexBytes = Buffer.from(await read(`${checkedRecordValueIndexPythonEvidence}/index.json`));
		assert.equal(sha256(indexBytes), checkedRecordValueIndexPythonEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"archiveCommit", "checkerCommit", "consumerCommit", "files", "hostedRun"
			, "kind", "limitations", "producerCommit", "runs", "runtime", "schemaVersion"
			, "selectedSources"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "checked-record-value-index-python-installed-v1");
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
			const value = Buffer.from(await read(`${checkedRecordValueIndexPythonEvidence}/${entry.path}`));
			assert.equal(value.length, entry.bytes, entry.path);
			assert.equal(sha256(value), entry.sha256, entry.path); files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
		};
		assert.deepEqual(index.selectedSources, checkedRecordValueIndexPythonEvidenceSources(revisions));
		const expectedPaths = [], sources = new Map();
		for(const source of index.selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`, value = get(path);
			expectedPaths.push(path); sources.set(path, value);
			assert.deepEqual(value, checkedRecordValueIndexHostedOriginal(source.revision, source.path), path);
		}
		assert.deepEqual(index.runs.map(run => run.route), checkedRecordValueIndexPythonRoutes);
		const accepted = [], packages = [], artifactMembers = [];
		for(const run of index.runs)
		{
			assert.deepEqual(Object.keys(run).sort(), [
				"accepted", "recordCount", "resultOnly", "reviewed", "route", "tapSha256"
				, "verificationSha256"
			].sort());
			const prefix = `${run.route}/records/`, records = new Map();
			for(const [path, value] of files)
				if(path.startsWith(prefix)) records.set(path.slice(prefix.length), value);
			assert.equal(records.size, run.recordCount);
			const originalRead = async path => {
				assert.ok(records.has(path), path); return records.get(path);
			};
			const tapPath = `${run.route}/run.tap`, verificationPath = `${run.route}/verification.json`;
			const tap = get(tapPath), verification = get(verificationPath);
			const original = prettyJson(verification, verificationPath);
			const checked = await checkCheckedRecordValueIndexPythonCiRecords([
				"--route", run.route, "--producer", revisions.producer
				, "--directory", `/archive/${run.route}/records`
				, "--tap", `/archive/${run.route}/run.tap`, "--glibc", original.floor
			], { tap: tap.toString(), read: originalRead, runtime: index.runtime });
			assert.deepEqual(original, checked); assert.deepEqual(run.accepted, checked);
			assert.equal(run.tapSha256, sha256(tap));
			assert.equal(run.verificationSha256, sha256(verification));
			const selection = checkedRecordValueIndexPythonSelection(run.route);
			assert.deepEqual([run.reviewed, run.resultOnly]
				, [selection.reviewed, selection.resultOnly]);
			packages.push(checkRouteRecords(records, run.route, sources));
			expectedPaths.push(tapPath, verificationPath
				, ...[...records.keys()].map(path => prefix + path));
			artifactMembers.push(
				... [...records.keys()].map(path => `checked-record-value-index-python-ci/${run.route}/records/${run.route}/${path}`)
				, `checked-record-value-index-python-ci/${run.route}/run.tap`
				, `checked-record-value-index-python-ci/${run.route}/verification.json`
			);
			accepted.push(checked);
		}
		assert.deepEqual(Object.keys(index.hostedRun).sort(), [
			"apiRecords", "artifact", "createdAt", "event", "job", "repository"
			, "runAttempt", "runId", "updatedAt", "url", "workflow"
		].sort());
		assert.equal(index.hostedRun.repository, "seanmorris/lean-bridge");
		assert.equal(index.hostedRun.workflow, ".github/workflows/checked-record-value-index-python.yml");
		assert.equal(index.hostedRun.runId, 39318504598);
		assert.equal(index.hostedRun.artifact.id, 12220917624);
		assert.equal(index.hostedRun.artifact.bytes, 206682676);
		assert.equal(index.hostedRun.artifact.sha256
			, "127d78df4bad6429e0d3c0483107d39ca3894449443d3b1b39474f159be60884");
		assert.deepEqual([...index.hostedRun.artifact.members].sort(), [
			...artifactMembers, "checked-record-value-index-python-engine.log"
		].sort());
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
		expectedPaths.push("hosted/logs/engine.log");
		assert.ok(get("hosted/logs/engine.log").length > 0);
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			...revisions, accepted, packages, runtime: index.runtime
			, hostedRun: index.hostedRun, files: index.files
			, supportPromoted: false, hostedAcceptance: true
		};
	})();
	if(read === readFile) cached = checking;
	return checking;
};
