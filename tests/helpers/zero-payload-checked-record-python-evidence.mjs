/**
 * Authenticate the immutable hosted zero-payload Python archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	checkZeroPayloadPythonCiRecords
} from "./zero-payload-checked-record-python-ci-report.mjs";
import {
	zeroPayloadPythonRoutes
} from "./zero-payload-checked-record-python-fixture.mjs";
import {
	zeroPayloadBrowserSelection
} from "./zero-payload-checked-record-browser-fixture.mjs";
import {
	zeroPayloadPythonEvidenceSources
} from "./zero-payload-checked-record-hosted-evidence-sources.mjs";
import {
	checkZeroPayloadHostedEvidenceArchive
} from "./zero-payload-checked-record-hosted-evidence.mjs";

export const zeroPayloadPythonEvidence
	= "docs/evidence/zero-payload-checked-record-python-20261021";
export const zeroPayloadPythonEvidenceSha256
	= "4b89c65f711f6e0a8f5fb53d4b8f62112e88d4cf33e8e1e42c28e8a34d5ea04f";
const producer = "736ce9d03fc324ed6004aa77de534cd9885bfa83";
const revisions = Object.freeze({
	producer, consumer: producer, checker: producer
	, archiver: "ae553edc16c9ee5606d8375414946b497351f672"
});
const contract = Object.freeze({
	evidence: zeroPayloadPythonEvidence
	, indexSha256: zeroPayloadPythonEvidenceSha256
	, indexKeys: [
		"archiveCommit", "checkerCommit", "consumerCommit", "files"
		, "hostedRun", "kind", "limitations", "producerCommit", "runs"
		, "runtime", "schemaVersion", "selectedSources"
	]
	, kind: "zero-payload-checked-record-python-installed-v1"
	, limitationCount: 7
	, revisions, sources: zeroPayloadPythonEvidenceSources(revisions)
	, routes: zeroPayloadPythonRoutes
	, artifactRoot: "zero-payload-checked-record-python-ci"
	, retainedLogs: [{
		path: "hosted/logs/engine.log"
		, artifact: "zero-payload-checked-record-python-engine.log"
	}]
	, workflow: ".github/workflows/zero-payload-checked-record-python.yml"
	, runId: 39588425854, jobId: 119183022029, artifactId: 12343095184
	, artifactBytes: 206653470
	, artifactSha256: "8156fc63822b4409398b3340f7f328c06256d6adabbff142ae1b24d052f56386"
	, verifyIndex: async index => {
		assert.deepEqual(index.runtime, {
			arch: "x64", glibc: "2.39", platform: "linux"
		});
	}
	, verifyRun: async ({ index, run, records, read, tap, verification }) => {
		assert.deepEqual(Object.keys(run).sort(), [
			"accepted", "recordCount", "resultOnly", "reviewed", "route"
			, "tapSha256", "verificationSha256"
		].sort());
		const checked = await checkZeroPayloadPythonCiRecords([
			"--route", run.route, "--producer", revisions.producer
			, "--directory", `/archive/${run.route}/records`
			, "--tap", `/archive/${run.route}/run.tap`
			, "--glibc", run.accepted.floor
		], { tap: tap.toString(), read, runtime: index.runtime });
		const selection = zeroPayloadBrowserSelection(run.route);
		assert.deepEqual(run, {
			route: run.route, reviewed: selection.reviewed
			, resultOnly: selection.resultOnly, recordCount: records.size
			, accepted: checked, tapSha256: sha256(tap)
			, verificationSha256: sha256(verification)
		});
		const observed = JSON.parse(verification);
		assert.deepEqual(observed, checked);
		assert.equal(verification.toString()
			, `${JSON.stringify(observed, null, 2)}\n`);
		return checked;
	}
});
let cached;

/**
 * Verify every retained byte, route, source and GitHub host record.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkZeroPayloadPythonEvidence = async (read = readFile) => {
	if(read !== readFile)
		return {
			...await checkZeroPayloadHostedEvidenceArchive(contract, read)
			, ...revisions, supportPromoted: false, hostedAcceptance: true
		};
	cached ??= checkZeroPayloadHostedEvidenceArchive(contract, readFile);
	return {
		...await cached, ...revisions
		, supportPromoted: false, hostedAcceptance: true
	};
};
