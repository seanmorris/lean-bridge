/**
 * Authenticate the immutable hosted zero-payload Ruby archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkZeroPayloadRubyCiRecords
} from "./zero-payload-checked-record-ruby-ci-report.mjs";
import {
	zeroPayloadRubyRoutes
} from "./zero-payload-checked-record-ruby-fixture.mjs";
import {
	zeroPayloadBrowserSelection
} from "./zero-payload-checked-record-browser-fixture.mjs";
import {
	zeroPayloadRubyEvidenceSources
} from "./zero-payload-checked-record-hosted-evidence-sources.mjs";
import {
	checkZeroPayloadHostedEvidenceArchive
} from "./zero-payload-checked-record-hosted-evidence.mjs";

export const zeroPayloadRubyEvidence
	= "docs/evidence/zero-payload-checked-record-ruby-20261021";
export const zeroPayloadRubyEvidenceSha256
	= "670ad0e816662c33d8a5451ddafec96ae7e3423effe09f851c036ba0bbc5a2e8";
const producer = "736ce9d03fc324ed6004aa77de534cd9885bfa83";
const revisions = Object.freeze({
	producer, consumer: producer, checker: producer
	, archiver: "ae553edc16c9ee5606d8375414946b497351f672"
});
const contract = Object.freeze({
	evidence: zeroPayloadRubyEvidence
	, indexSha256: zeroPayloadRubyEvidenceSha256
	, indexKeys: [
		"archiveCommit", "checkerCommit", "consumerCommit", "files"
		, "hostedRun", "interpreter", "kind", "limitations", "producerCommit"
		, "runs", "runtime", "schemaVersion", "selectedSources"
	]
	, kind: "zero-payload-checked-record-ruby-installed-v1"
	, limitationCount: 7
	, revisions, sources: zeroPayloadRubyEvidenceSources(revisions)
	, routes: zeroPayloadRubyRoutes
	, artifactRoot: "zero-payload-checked-record-ruby-ci"
	, artifactToolchainLog: "zero-payload-checked-record-ruby-toolchain.log"
	, workflow: ".github/workflows/zero-payload-checked-record-ruby.yml"
	, runId: 39588425786, jobId: 119183491153, artifactId: 12343731732
	, artifactBytes: 200364775
	, artifactSha256: "7dc47839a92561f091cf53a2a3c11d8a2fdac5d65151f0db55a6bf632dcbea41"
	, verifyIndex: async index => {
		assert.deepEqual(index.runtime, {
			arch: "x64", glibc: "2.39", platform: "linux"
		});
		assert.equal(index.interpreter.command
			, "/opt/hostedtoolcache/Ruby/3.3.12/x64/bin/ruby");
		assert.deepEqual(index.interpreter.identity, {
			bytes: 222952
			, sha256: "5705533003a8ca00e6359e2430ddf7a1737eb439983e1e1a4236d0396ec8771e"
		});
		assert.deepEqual(index.interpreter.run, {
			code: 0, stderr: ""
			, stdout: "{\"engine\":\"ruby\",\"version\":\"3.3.12\",\"platform\":\"x86_64-linux\"}"
		});
	}
	, verifyRun: async ({ index, run, records, read, tap, verification }) => {
		assert.deepEqual(Object.keys(run).sort(), [
			"accepted", "recordCount", "resultOnly", "reviewed", "route"
			, "tapSha256", "verificationSha256"
		].sort());
		const checked = await checkZeroPayloadRubyCiRecords([
			"--route", run.route, "--producer", revisions.producer
			, "--directory", `/archive/${run.route}/records`
			, "--tap", `/archive/${run.route}/run.tap`
			, "--glibc", run.accepted.floor, "--ruby", index.interpreter.command
		], {
			tap: tap.toString(), read, runtime: index.runtime
			, interpreter: index.interpreter
		});
		const selection = zeroPayloadBrowserSelection(run.route);
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
 * Verify every retained byte, route, source, host record and interpreter.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkZeroPayloadRubyEvidence = async (read = readFile) => {
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
