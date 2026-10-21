/**
 * Authenticate the immutable hosted Python dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	checkDependentCheckedRecordPythonCiRecords
} from "./dependent-checked-record-python-ci-report.mjs";
import {
	dependentCheckedRecordPythonRoutes
	, dependentCheckedRecordPythonSelection
} from "./dependent-checked-record-python-fixture.mjs";
import {
	dependentCheckedRecordPythonEvidenceSources
} from "./dependent-checked-record-hosted-evidence-sources.mjs";
import {
	checkZeroPayloadHostedEvidenceArchive
} from "./zero-payload-checked-record-hosted-evidence.mjs";

export const dependentCheckedRecordPythonEvidence
	= "docs/evidence/dependent-checked-record-python-20261021";
export const dependentCheckedRecordPythonEvidenceSha256
	= "155bbc1b1ad4a2a2b24aef87d4683050e5fd3ecca051fd86a91a1d70f4a04d4a";
const producer = "d2f3e5c869d84b77c228b2efebe18d86172d81b1";
const revisions = Object.freeze({
	producer, consumer: producer, checker: producer
	, archiver: "7dd9083c276e904052cc44f774f7a19322175d5f"
});
const contract = Object.freeze({
	evidence: dependentCheckedRecordPythonEvidence
	, indexSha256: dependentCheckedRecordPythonEvidenceSha256
	, indexKeys: [
		"archiveCommit", "checkerCommit", "consumerCommit", "files"
		, "hostedRun", "kind", "limitations", "producerCommit", "runs"
		, "runtime", "schemaVersion", "selectedSources"
	]
	, kind: "dependent-checked-record-python-installed-v1"
	, limitationCount: 7
	, revisions, sources: dependentCheckedRecordPythonEvidenceSources(revisions)
	, routes: dependentCheckedRecordPythonRoutes
	, artifactRoot: "dependent-checked-record-python-ci"
	, retainedLogs: [{
		path: "hosted/logs/engine.log"
		, artifact: "dependent-checked-record-python-engine.log"
	}]
	, workflow: ".github/workflows/dependent-checked-record-python.yml"
	, runId: 39664026329, jobId: 119444186623
	, artifactId: 12386335597, artifactBytes: 206523055
	, artifactSha256:
		"a58c8270dfca69edfde6adcb7c4107a1eae6f5d79f8d0997e9ba4e60b2faf665"
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
		const checked = await checkDependentCheckedRecordPythonCiRecords([
			"--route", run.route, "--producer", revisions.producer
			, "--directory", `/archive/${run.route}/records`
			, "--tap", `/archive/${run.route}/run.tap`
			, "--glibc", run.accepted.floor
		], { tap: tap.toString(), read, runtime: index.runtime });
		const selection = dependentCheckedRecordPythonSelection(run.route);
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
 * Verify every retained byte, route, source, wheel, runtime and GitHub record.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkDependentCheckedRecordPythonEvidence = async (
	read = readFile
) => {
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
