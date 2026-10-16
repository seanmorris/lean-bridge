/**
 * Authenticate the immutable nested checked-record Perl evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	assertNestedCheckedRecordPerlCiTap
	, checkNestedCheckedRecordPerlCiRecords
} from "./nested-checked-record-perl-ci-report.mjs";
import {
	nestedCheckedRecordPerlEvidence
	, nestedCheckedRecordPerlEvidenceCases
	, nestedCheckedRecordPerlEvidenceSources
	, nestedCheckedRecordPerlOriginal
	, nestedCheckedRecordPerlProducer
} from "./nested-checked-record-perl-provenance.mjs";

export { nestedCheckedRecordPerlEvidence } from "./nested-checked-record-perl-provenance.mjs";
export const nestedCheckedRecordPerlEvidenceSha256
	= "3369153c41485db63e24f0267d0bb13e8cdcb849b869a04af52c9878422a152f";

const safePath = path => typeof path === "string"
	&& /^[A-Za-z0-9_.+$/[\]-]+$/u.test(path) && !path.startsWith("/")
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path) => {
	const value = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(value), path);
	return value;
};
const duration = tap => {
	const matches = [...tap.toString().matchAll(/^# duration_ms ([0-9]+(?:\.[0-9]+)?)$/gmu)];
	assert.equal(matches.length, 1); return Number(matches[0][1]);
};
let cached;

/**
 * Reconcile every retained source, record, TAP stream, and verification result.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 */
export const checkNestedCheckedRecordPerlEvidence = async (read = readFile) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const indexBytes = Buffer.from(await read(nestedCheckedRecordPerlEvidence + "/index.json"));
		assert.equal(sha256(indexBytes), nestedCheckedRecordPerlEvidenceSha256);
		const index = json(indexBytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"files", "kind", "limitations", "producerCommit", "runs"
			, "schemaVersion", "selectedSources"
		].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "nested-checked-record-perl-installed-v1");
		assert.equal(index.producerCommit, nestedCheckedRecordPerlProducer);
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 7
			&& index.limitations.every(item => typeof item === "string" && item.length > 0));
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(
				nestedCheckedRecordPerlEvidence + "/" + entry.path
			));
			assert.equal(value.length, entry.bytes, entry.path);
			assert.equal(sha256(value), entry.sha256, entry.path); files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
		};
		const selectedSources = await nestedCheckedRecordPerlEvidenceSources();
		const expectedPaths = [];
		assert.deepEqual(index.selectedSources, selectedSources);
		for(const path of selectedSources)
		{
			const retained = "sources/" + path; expectedPaths.push(retained);
			assert.deepEqual(get(retained), nestedCheckedRecordPerlOriginal(
				nestedCheckedRecordPerlProducer, path
			), path);
		}
		assert.deepEqual(index.runs.map(run => run.name), nestedCheckedRecordPerlEvidenceCases);
		const checked = [];
		for(const run of index.runs)
		{
			assert.deepEqual(Object.keys(run).sort(), [
				"apiMode", "authorRoute", "builds", "configurations", "durationMs"
				, "executions", "floor", "installModes", "name", "records"
				, "reportSha256", "runtime", "tapSha256", "verificationSha256"
			].sort());
			const base = `${run.name}/producer/`;
			const tap = get(base + "run.tap");
			const verificationBytes = get(base + "verification.json");
			const verification = json(verificationBytes, base + "verification.json");
			assertNestedCheckedRecordPerlCiTap(tap.toString(), run.name);
			assert.equal(run.durationMs, duration(tap));
			assert.equal(run.tapSha256, sha256(tap));
			assert.equal(run.verificationSha256, sha256(verificationBytes));
			const prefix = `${run.name}/records/`;
			const paths = verification.records.map(item => item.path);
			const result = await checkNestedCheckedRecordPerlCiRecords({
				name: run.name, producer: nestedCheckedRecordPerlProducer
				, glibc: run.floor, tap: tap.toString(), paths
				, read: path => Promise.resolve(get(prefix + path)), runtime: run.runtime
			});
			assert.deepEqual(verification, result);
			for(const key of [
				"authorRoute", "apiMode", "floor", "runtime", "configurations"
				, "installModes", "builds", "executions", "reportSha256"
			]) assert.deepEqual(run[key], result[key], `${run.name} ${key}`);
			assert.equal(run.records, result.records.length);
			expectedPaths.push(base + "run.tap", base + "verification.json");
			expectedPaths.push(...paths.map(path => prefix + path));
			checked.push(result);
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
