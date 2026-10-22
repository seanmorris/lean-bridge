/**
 * Authenticate the immutable hosted Java/Kotlin dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkDependentCheckedRecordJvmCiRecords
} from "./dependent-checked-record-jvm-ci-report.mjs";
import {
	dependentCheckedRecordJvmRoutes, dependentCheckedRecordJvmSelection
} from "./dependent-checked-record-jvm-fixture.mjs";
import {
	dependentCheckedRecordJvmEvidenceSources
} from "./dependent-checked-record-hosted-evidence-sources.mjs";
import {
	checkZeroPayloadHostedEvidenceArchive
} from "./zero-payload-checked-record-hosted-evidence.mjs";

export const dependentCheckedRecordJvmEvidence
	= "docs/evidence/dependent-checked-record-jvm-20261021";
export const dependentCheckedRecordJvmEvidenceSha256
	= "99b84eee8602f98df6ccd842e4ca955f63f577a576643e088e4d29891b59162a";
const producer = "e1899c46c9169c93419e230a9efba9892963c7f2";
const revisions = Object.freeze({
	producer, consumer: producer, checker: producer
	, archiver: "b05e78d1a8e9f02c1625109bac566b3127b735ea"
});
const toolDigests = Object.freeze({
	java: "ea70a093b69c865f31ce1179d3a7b8e6f0a128092e3cbf6941f9a5159bc9536e"
	, javac: "7d3e3f26e61afe89b815484daaab3e74508761f02060413bb295465354ecd54b"
	, kotlinc: "64d62a197fbec5f32f77c6724cce33ead4034b2ec3f873c056cde19fe00f324e"
});
const contract = Object.freeze({
	evidence: dependentCheckedRecordJvmEvidence
	, indexSha256: dependentCheckedRecordJvmEvidenceSha256
	, indexKeys: [
		"archiveCommit", "checkerCommit", "consumerCommit", "files"
		, "hostedRun", "kind", "limitations", "producerCommit", "runs"
		, "runtime", "schemaVersion", "selectedSources", "tools"
	]
	, kind: "dependent-checked-record-jvm-installed-v1"
	, limitationCount: 7
	, revisions, sources: dependentCheckedRecordJvmEvidenceSources(revisions)
	, routes: dependentCheckedRecordJvmRoutes
	, artifactRoot: "dependent-checked-record-jvm-ci"
	, retainedLogs: [{
		path: "hosted/logs/toolchain.log"
		, artifact: "dependent-checked-record-jvm-toolchain.log"
	}]
	, workflow: ".github/workflows/dependent-checked-record-jvm.yml"
	, runId: 39688929761, jobId: 119529962221
	, artifactId: 12389961820, artifactBytes: 205412653
	, artifactSha256:
		"e9706bc546d52a43808004645e6be94a2eac14b56d52bd4b4a1e75fd04d19d4d"
	, verifyIndex: async index => {
		assert.deepEqual(index.runtime, {
			arch: "x64", glibc: "2.39", platform: "linux"
		});
		assert.deepEqual(Object.keys(index.tools).sort(), [
			"java", "javac", "kotlinc"
		]);
		for(const name of Object.keys(toolDigests))
			assert.equal(index.tools[name].sha256, toolDigests[name], name);
		assert.match(index.tools.java.version, /^openjdk 22\.0\.2 /u);
		assert.equal(index.tools.javac.version, "javac 22.0.2");
		assert.equal(index.tools.kotlinc.version
			, "info: kotlinc-jvm 2.2.0 (JRE 22.0.2+9)");
		assert.equal(Object.keys(index.tools.kotlinc.compilerFiles).length, 57);
		for(const digest of Object.values(index.tools.kotlinc.compilerFiles))
			assert.match(digest, /^[a-f0-9]{64}$/u);
	}
	, verifyRun: async ({ index, run, records, read, tap, verification }) => {
		assert.deepEqual(Object.keys(run).sort(), [
			"accepted", "recordCount", "resultOnly", "reviewed", "route"
			, "tapSha256", "verificationSha256"
		].sort());
		const checked = await checkDependentCheckedRecordJvmCiRecords({
			route: run.route, producer: revisions.producer
			, consumer: revisions.consumer
			, directory: `/archive/${run.route}/records`
			, tap: `/archive/${run.route}/run.tap`, glibc: run.accepted.floor
			, java: index.tools.java.command, javac: index.tools.javac.command
			, kotlinc: index.tools.kotlinc.command
		}, {
			tap: tap.toString(), read, runtime: index.runtime, tools: index.tools
			, archiveSha256: run.accepted.archiveSha256
		});
		const selection = dependentCheckedRecordJvmSelection(run.route);
		assert.deepEqual(run, {
			route: run.route, reviewed: selection.reviewed
			, resultOnly: selection.resultOnly, recordCount: records.size
			, accepted: checked, tapSha256: sha256(tap)
			, verificationSha256: sha256(verification)
		});
		assert.equal(verification.toString(), canonicalJson(checked));
		return checked;
	}
});
let cached;

/**
 * Verify every retained byte, route, Maven package, source and GitHub record.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkDependentCheckedRecordJvmEvidence = async (
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
