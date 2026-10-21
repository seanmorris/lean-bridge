/**
 * Authenticate the immutable hosted zero-payload Perl archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkZeroPayloadPerlCiRecords
} from "./zero-payload-checked-record-perl-ci-report.mjs";
import {
	zeroPayloadPerlRoutes, zeroPayloadPerlSelection
} from "./zero-payload-checked-record-perl-fixture.mjs";
import {
	zeroPayloadPerlEvidenceSources
} from "./zero-payload-checked-record-hosted-evidence-sources.mjs";
import {
	checkZeroPayloadHostedEvidenceArchive
} from "./zero-payload-checked-record-hosted-evidence.mjs";

export const zeroPayloadPerlEvidence
	= "docs/evidence/zero-payload-checked-record-perl-20261021";
export const zeroPayloadPerlEvidenceSha256
	= "97417bd624ec2d48c6a5920438b6e91e751fa438e947324929791c52304a072b";
const producer = "736ce9d03fc324ed6004aa77de534cd9885bfa83";
const revisions = Object.freeze({
	producer, consumer: producer, checker: producer
	, archiver: "3c7d0e55c81ab352561592ff6456ac26f59896bc"
});
const contract = Object.freeze({
	evidence: zeroPayloadPerlEvidence
	, indexSha256: zeroPayloadPerlEvidenceSha256
	, indexKeys: [
		"archiveCommit", "checkerCommit", "consumerCommit", "files"
		, "hostedRun", "interpreters", "kind", "limitations"
		, "producerCommit", "runs", "runtime", "schemaVersion"
		, "selectedSources"
	]
	, kind: "zero-payload-checked-record-perl-installed-v1"
	, limitationCount: 7
	, revisions, sources: zeroPayloadPerlEvidenceSources(revisions)
	, routes: zeroPayloadPerlRoutes
	, artifactRoot: "zero-payload-checked-record-perl-ci"
	, artifactToolchainLog: "zero-payload-checked-record-perl-toolchain.log"
	, workflow: ".github/workflows/zero-payload-checked-record-perl.yml"
	, runId: 39588425122, jobId: 119183019358, artifactId: 12344196352
	, artifactBytes: 206468739
	, artifactSha256: "5e6a07d350b290afc1ea3a7d6d401021a629eed3bda0219a1b4afc4d586ee72d"
	, verifyIndex: async index => {
		assert.deepEqual(index.runtime, {
			arch: "x64", glibc: "2.39", platform: "linux"
		});
		assert.deepEqual(index.interpreters.map(item => item.configuration), [
			"5.36.3-threaded", "5.36.3-unthreaded"
			, "5.38.2-threaded", "5.38.2-unthreaded"
		]);
		for(const interpreter of index.interpreters)
		{
			assert.match(interpreter.command, /\/bin\/perl$/u);
			assert.match(interpreter.executable.sha256, /^[a-f0-9]{64}$/u);
			assert.ok(interpreter.executable.bytes > 0);
		}
	}
	, verifyRun: async ({ index, run, records, read, tap, verification }) => {
		assert.deepEqual(Object.keys(run).sort(), [
			"accepted", "recordCount", "resultOnly", "reviewed", "route"
			, "tapSha256", "verificationSha256"
		].sort());
		const checked = await checkZeroPayloadPerlCiRecords({
			route: run.route, producer: revisions.producer
			, directory: `/archive/${run.route}/records`
			, glibc: run.accepted.floor, maxLoad: run.accepted.maxLoad
			, tap: tap.toString(), read, paths: [...records.keys()].sort()
			, runtime: index.runtime, interpreters: index.interpreters
		});
		const selection = zeroPayloadPerlSelection(run.route);
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
 * Verify every retained byte, source, route, ABI and GitHub host record.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkZeroPayloadPerlEvidence = async (read = readFile) => {
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
