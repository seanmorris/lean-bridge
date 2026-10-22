/**
 * Authenticate the immutable hosted C/C++ dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	checkDependentCheckedRecordNativeCiRecords
} from "./dependent-checked-record-native-ci-report.mjs";
import {
	dependentCheckedRecordNativeRoutes, dependentCheckedRecordNativeSelection
} from "./dependent-checked-record-native-fixture.mjs";
import {
	dependentCheckedRecordNativeEvidenceSources
} from "./dependent-checked-record-hosted-evidence-sources.mjs";
import {
	checkZeroPayloadHostedEvidenceArchive
} from "./zero-payload-checked-record-hosted-evidence.mjs";

export const dependentCheckedRecordNativeEvidence
	= "docs/evidence/dependent-checked-record-native-20261021";
export const dependentCheckedRecordNativeEvidenceSha256
	= "ba64efbdf0237ef967ed57ce752a9fd9c3157ecc00ac7b7ac98c27bc827d0ff7";
const producer = "b869fb3f1cbf320c3cb453058f4a7bdf095a49c1";
const checker = "f6c98627e7bf58fabbae4093636675ebb19ed8fe";
const revisions = Object.freeze({
	producer, consumer: producer, checker, archiver: checker
});
const artifactRoot = "dependent-checked-record-native-ci";
const contract = Object.freeze({
	evidence: dependentCheckedRecordNativeEvidence
	, indexSha256: dependentCheckedRecordNativeEvidenceSha256
	, indexKeys: [
		"archiveCommit", "checkerCommit", "consumerCommit", "files", "floor"
		, "hostedRun", "kind", "limitations", "producerCommit", "runs"
		, "schemaVersion", "selectedSources"
	]
	, kind: "dependent-checked-record-native-installed-v1"
	, limitationCount: 7
	, revisions, sources: dependentCheckedRecordNativeEvidenceSources(revisions)
	, routes: dependentCheckedRecordNativeRoutes, artifactRoot
	, retainedRoutePaths: ["run.tap"]
	, artifactRetainedPath: (route, path) => {
		assert.equal(path, "run.tap");
		return `${artifactRoot}/${route}.tap`;
	}
	, artifactRecordPath: (route, path) =>
		`${artifactRoot}/records/${route}/${path}`
	, workflow: ".github/workflows/dependent-checked-record-native.yml"
	, retainedLogs: [{
		path: "hosted/logs/toolchain.log"
		, artifact: "dependent-checked-record-native-toolchain.log"
	}]
	, runId: 39857552237, jobId: 120100091763
	, artifactId: 12462052085, artifactBytes: 421713996
	, artifactSha256:
		"f858b0867af350856138aa114d06eeaac1f26d3bc7511bc659f6a1bba60e776f"
	, verifyIndex: async index => assert.equal(index.floor, "2.38")
	, verifyRun: async ({ index, run, records, read, tap }) => {
		assert.deepEqual(Object.keys(run).sort(), [
			"accepted", "recordCount", "resultOnly", "reviewed", "route"
			, "tapSha256"
		].sort());
		const checked = await checkDependentCheckedRecordNativeCiRecords({
			route: run.route, producer: revisions.producer
			, checker: revisions.checker
			, directory: `/archive/${run.route}/records`
			, tap: `/archive/${run.route}/run.tap`, floor: index.floor
		}, { tap: tap.toString(), paths: [...records.keys()].sort(), read });
		const selection = dependentCheckedRecordNativeSelection(run.route);
		assert.deepEqual(run, {
			route: run.route, reviewed: selection.reviewed
			, resultOnly: selection.resultOnly, recordCount: records.size
			, accepted: checked, tapSha256: sha256(tap)
		});
		return checked;
	}
});
let cached;

/**
 * Verify every retained byte, route, native package, source and GitHub record.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkDependentCheckedRecordNativeEvidence = async (
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
