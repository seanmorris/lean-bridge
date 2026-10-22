/**
 * Authenticate the immutable hosted Perl dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkDependentCheckedRecordPerlCiRecords
} from "./dependent-checked-record-perl-ci-report.mjs";
import {
	dependentCheckedRecordPerlRoutes
} from "./dependent-checked-record-perl-fixture.mjs";
import {
	dependentCheckedRecordSelection
} from "./dependent-checked-record-browser-fixture.mjs";
import {
	dependentCheckedRecordPerlEvidenceSources
} from "./dependent-checked-record-hosted-evidence-sources.mjs";
import {
	checkZeroPayloadHostedEvidenceArchive
} from "./zero-payload-checked-record-hosted-evidence.mjs";

export const dependentCheckedRecordPerlEvidence
	= "docs/evidence/dependent-checked-record-perl-20261021";
export const dependentCheckedRecordPerlEvidenceSha256
	= "53bdc2212215d7f569b5158c436a002d6a16f9903be033c378ed7ef31f17d95f";
const producer = "d2f3e5c869d84b77c228b2efebe18d86172d81b1";
const revisions = Object.freeze({
	producer, consumer: producer, checker: producer
	, archiver: "bde83efb0f81e0a7b74bf58c8c1886dbaa5784de"
});
const contract = Object.freeze({
	evidence: dependentCheckedRecordPerlEvidence
	, indexSha256: dependentCheckedRecordPerlEvidenceSha256
	, indexKeys: [
		"archiveCommit", "checkerCommit", "consumerCommit", "files"
		, "hostedRun", "interpreters", "kind", "limitations"
		, "producerCommit", "runs", "runtime", "schemaVersion"
		, "selectedSources"
	]
	, kind: "dependent-checked-record-perl-installed-v1"
	, limitationCount: 7
	, revisions, sources: dependentCheckedRecordPerlEvidenceSources(revisions)
	, routes: dependentCheckedRecordPerlRoutes
	, artifactRoot: "dependent-checked-record-perl-ci"
	, artifactToolchainLog: "dependent-checked-record-perl-toolchain.log"
	, workflow: ".github/workflows/dependent-checked-record-perl.yml"
	, runId: 39664026059, jobId: 119444182158
	, artifactId: 12379110462, artifactBytes: 206238177
	, artifactSha256:
		"449aa1679a518c51287ee4cdaf63790b34509a38e7a72eec33be0ca2ce14ee35"
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
			assert.deepEqual(Object.keys(interpreter).sort(), [
				"command", "configuration", "executable", "identity"
			]);
			assert.match(interpreter.executable.sha256, /^[a-f0-9]{64}$/u);
			assert.ok(interpreter.executable.bytes > 0);
			assert.equal(interpreter.identity.ptrsize, "8");
			assert.equal(interpreter.identity.ivsize, "8");
			assert.equal(interpreter.identity.version
				, interpreter.configuration.slice(0, 6));
			assert.equal(interpreter.identity.useithreads
				, interpreter.configuration.endsWith("-threaded")
					? "define" : null);
		}
	}
	, verifyRun: async ({ index, run, records, read, tap, verification }) => {
		assert.deepEqual(Object.keys(run).sort(), [
			"accepted", "recordCount", "resultOnly", "reviewed", "route"
			, "tapSha256", "verificationSha256"
		].sort());
		const observed = JSON.parse(verification);
		assert.equal(verification.toString(), canonicalJson(observed));
		const checked = await checkDependentCheckedRecordPerlCiRecords({
			route: run.route, producer: revisions.producer
			, directory: `/archive/${run.route}/records`
			, glibc: run.accepted.floor, maxLoad: run.accepted.maxLoad
			, tap: tap.toString(), read
			, paths: [...records.keys()].sort(), runtime: index.runtime
			, interpreters: index.interpreters
		});
		const selection = dependentCheckedRecordSelection(run.route);
		assert.deepEqual(run, {
			route: run.route, reviewed: selection.reviewed
			, resultOnly: selection.resultOnly, recordCount: records.size
			, accepted: checked, tapSha256: sha256(tap)
			, verificationSha256: sha256(verification)
		});
		assert.deepEqual(observed, checked);
		return checked;
	}
});
let cached;

/**
 * Verify every retained byte, source snapshot, route, ABI and GitHub record.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkDependentCheckedRecordPerlEvidence = async (
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
