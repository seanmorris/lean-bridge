/**
 * Authenticate the immutable recursive checked-record Perl evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	assertRecursiveCheckedRecordPerlCiTap
	, recursiveCheckedRecordPerlRecordPaths
} from "./recursive-checked-record-perl-ci-report.mjs";
import { assertRecursiveCheckedRecordPerlRecords } from "./recursive-checked-record-perl-records.mjs";
import {
	recursiveCheckedRecordPerlEvidence
	, recursiveCheckedRecordPerlEvidenceCases
	, recursiveCheckedRecordPerlEvidenceSources
	, recursiveCheckedRecordPerlOriginal
	, recursiveCheckedRecordPerlProducer
} from "./recursive-checked-record-perl-provenance.mjs";

export { recursiveCheckedRecordPerlEvidence } from "./recursive-checked-record-perl-provenance.mjs";
export const recursiveCheckedRecordPerlEvidenceSha256
	= "ecd4bb3e3d6740d071ee8b4b927e25fcb26e5c78028c3fca141fb290e8386e84";

const safePath = path => typeof path === "string" && !path.startsWith("/")
	&& path.split("/").every(part => part && part !== "." && part !== ".."
		&& /^[A-Za-z0-9_.+@:-]+$/u.test(part));
const json = (bytes, path) => {
	const value = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(value), path);
	return value;
};
const duration = tap => {
	const matches = [...tap.toString().matchAll(/^# duration_ms ([0-9]+(?:\.[0-9]+)?)$/gmu)];
	assert.equal(matches.length, 1); return Number(matches[0][1]);
};
const identity = item => ({ path: item.path, bytes: item.bytes, sha256: item.sha256 });
let cached;

/**
 * Reconcile every retained source, non-binary record and authenticated handoff identity.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 */
export const checkRecursiveCheckedRecordPerlEvidence = async (read = readFile) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const indexBytes = Buffer.from(await read(recursiveCheckedRecordPerlEvidence + "/index.json"));
		assert.equal(sha256(indexBytes), recursiveCheckedRecordPerlEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"files", "kind", "limitations", "producerCommit", "runs"
			, "schemaVersion", "selectedSources"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "recursive-checked-record-perl-installed-v1");
		assert.equal(index.producerCommit, recursiveCheckedRecordPerlProducer);
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 7
			&& index.limitations.every(item => typeof item === "string" && item.length > 0));
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(
				recursiveCheckedRecordPerlEvidence + "/" + entry.path
			));
			assert.equal(value.length, entry.bytes, entry.path);
			assert.equal(sha256(value), entry.sha256, entry.path); files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
		};
		const selectedSources = await recursiveCheckedRecordPerlEvidenceSources();
		const expectedPaths = [];
		assert.deepEqual(index.selectedSources, selectedSources);
		for(const path of selectedSources)
		{
			const retained = "sources/" + path; expectedPaths.push(retained);
			assert.deepEqual(get(retained), recursiveCheckedRecordPerlOriginal(
				recursiveCheckedRecordPerlProducer, path
			), path);
		}
		assert.deepEqual(index.runs.map(run => run.name)
			, recursiveCheckedRecordPerlEvidenceCases);
		const checked = [];
		for(const run of index.runs)
		{
			assert.deepEqual(Object.keys(run).sort(), [
				"builds", "configurations", "durationMs", "executions", "fixture"
				, "floor", "installModes", "maxLoad", "name", "omittedArchives"
				, "records", "reportSha256", "retainedHandoff", "route", "runtime"
				, "tapSha256", "verificationSha256"
			].sort());
			const base = `${run.name}/producer/`, recordsBase = `${run.name}/records/`;
			const tap = get(base + "run.tap");
			const verificationBytes = get(base + "verification.json");
			const verification = json(verificationBytes, base + "verification.json");
			assertRecursiveCheckedRecordPerlCiTap(tap.toString(), run.name);
			assert.equal(run.durationMs, duration(tap));
			assert.equal(run.tapSha256, sha256(tap));
			assert.equal(run.verificationSha256, sha256(verificationBytes));
			assert.deepEqual(Object.keys(verification).sort(), [
				"builds", "configurations", "executions", "fixture", "floor", "handoff"
				, "installModes", "maxLoad", "name", "producerCommit", "records"
				, "reportSha256", "route", "runtime", "schemaVersion"
			].sort());
			assert.equal(verification.schemaVersion, 1);
			assert.equal(verification.producerCommit, recursiveCheckedRecordPerlProducer);
			for(const key of [
				"name", "route", "fixture", "floor", "maxLoad", "runtime"
				, "configurations", "installModes", "builds", "executions", "reportSha256"
			]) assert.deepEqual(run[key], verification[key], `${run.name} ${key}`);
			assert.deepEqual(verification.runtime, {
				platform: "linux", arch: "x64", glibc: verification.runtime.glibc
			});
			assert.ok(Number(verification.runtime.glibc.split(".")[1])
				>= Number(verification.floor.split(".")[1]));
			const recordPaths = recursiveCheckedRecordPerlRecordPaths(run.name);
			assert.deepEqual(verification.records.map(item => item.path), recordPaths);
			assert.equal(run.records, recordPaths.length);
			for(const item of verification.records)
			{
				assert.deepEqual(Object.keys(item).sort(), ["bytes", "path", "sha256"]);
				const bytes = get(recordsBase + item.path);
				assert.equal(bytes.length, item.bytes, item.path);
				assert.equal(sha256(bytes), item.sha256, item.path);
				expectedPaths.push(recordsBase + item.path);
			}
			const report = await assertRecursiveCheckedRecordPerlRecords({
				name: run.name, read: path => Promise.resolve(get(recordsBase + path))
			});
			assert.equal(report.producerCommit, recursiveCheckedRecordPerlProducer);
			assert.equal(report.glibcMinimumVersion, run.floor);
			assert.equal(report.loadCeiling, run.maxLoad);
			assert.deepEqual(report.configurations, run.configurations);
			assert.deepEqual(report.installModes, run.installModes);
			assert.equal(report.builds.length, run.builds);
			assert.equal(report.reports.length * 2, run.executions);
			assert.equal(sha256(canonicalJson(report)), run.reportSha256);
			const retained = verification.handoff.filter(item =>
				!item.path.startsWith("handoff/archives/")
			);
			const omitted = verification.handoff.filter(item =>
				item.path.startsWith("handoff/archives/")
			);
			assert.deepEqual(run.retainedHandoff, retained);
			assert.deepEqual(run.omittedArchives, omitted);
			assert.equal(retained.length, 2); assert.equal(omitted.length, 2);
			for(const item of retained)
			{
				const bytes = get(recordsBase + item.path);
				assert.deepEqual(identity({ path: item.path, bytes: bytes.length
					, sha256: sha256(bytes) }), item);
				expectedPaths.push(recordsBase + item.path);
			}
			const receiptBytes = get(recordsBase + "handoff/package-set-receipt.json");
			const receipt = json(receiptBytes, `${run.name} package-set receipt`);
			validatePackageSetReceipt(receipt);
			assert.deepEqual(receipt, json(get(recordsBase
				+ "build-0/package-set-receipt.json"), `${run.name} build receipt`));
			assert.equal(get(recordsBase + "handoff/package-set-receipt.json.sha256").toString()
				, `${sha256(receiptBytes)}  package-set-receipt.json\n`);
			const archives = receipt.packages.flatMap(pkg => pkg.artifacts.map(item => ({
				path: "handoff/" + item.path, bytes: item.bytes, sha256: item.sha256
			})));
			assert.deepEqual([...omitted].sort((left, right) => left.path.localeCompare(right.path))
				, archives.sort((left, right) => left.path.localeCompare(right.path)));
			expectedPaths.push(base + "run.tap", base + "verification.json");
			checked.push({ ...verification, report });
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			producerCommit: index.producerCommit, selections: checked
			, files: index.files, selectedSources: index.selectedSources
			, installedProfiles: ["perl"], supportPromoted: false
			, hostedAcceptance: false
		};
	})();
	if(read === readFile) cached = checking;
	return checking;
};
