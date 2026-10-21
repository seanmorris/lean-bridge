/**
 * Authenticate the immutable hosted zero-payload .NET archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	zeroPayloadDotnetNegativeControls
} from "./zero-payload-checked-record-dotnet-controls.mjs";
import {
	zeroPayloadDotnetRoutes, zeroPayloadDotnetSelection
} from "./zero-payload-checked-record-dotnet-fixture.mjs";
import {
	zeroPayloadDotnetEvidenceSources
} from "./zero-payload-checked-record-hosted-evidence-sources.mjs";
import {
	checkZeroPayloadHostedEvidenceArchive
} from "./zero-payload-checked-record-hosted-evidence.mjs";

export const zeroPayloadDotnetEvidence
	= "docs/evidence/zero-payload-checked-record-dotnet-20261021";
export const zeroPayloadDotnetEvidenceSha256
	= "0268c8ef8f9b247db6a880346484db5ef154007db21af3e7677f61884c507891";
const revision = "a6173cade3bbe158baa1a5695e3e93e1037359b0";
const revisions = Object.freeze({
	producer: revision, consumer: revision, checker: revision
	, archiver: "45adeda636c236b1fb5bccf451266804bfe2ae4d"
});
const contract = Object.freeze({
	evidence: zeroPayloadDotnetEvidence
	, indexSha256: zeroPayloadDotnetEvidenceSha256
	, indexKeys: [
		"archiveCommit", "checkerCommit", "consumerCommit", "files", "floor"
		, "hostedRun", "kind", "limitations", "loadCeiling", "producerCommit"
		, "runs", "runtime", "schemaVersion", "selectedSources", "tools"
	]
	, kind: "zero-payload-checked-record-dotnet-installed-v1"
	, revisions, sources: zeroPayloadDotnetEvidenceSources(revisions)
	, routes: zeroPayloadDotnetRoutes
	, artifactRoot: "zero-payload-checked-record-dotnet-ci"
	, artifactToolchainLog: "zero-payload-checked-record-dotnet-toolchain.log"
	, workflow: ".github/workflows/zero-payload-checked-record-dotnet.yml"
	, runId: 39561655735, jobId: 119094106896, artifactId: 12329431983
	, artifactBytes: 205261045
	, artifactSha256: "77f66059e6ab3c3988559fc0616d7e4f828d7b99b20b0b6aabe36d7c8b1b707e"
	, verifyIndex: async index => {
		assert.deepEqual(index.runtime, {
			arch: "x64"
			, glibc: {
				code: 0, stderr: "", stdout: "glibc 2.39\n"
			}
			, platform: "linux"
		});
		assert.equal(index.floor, "2.38");
		assert.equal(index.loadCeiling, 6);
		assert.deepEqual(Object.keys(index.tools).sort(), [
			"command", "interpreter", "measurements", "sdk"
		]);
		assert.equal(index.tools.sdk.version, "8.0.424");
		assert.equal(index.tools.measurements.length, 3);
		assert.ok(index.tools.measurements.every(item => !Object.hasOwn(item, "cwd")
			&& item.command === index.tools.command && item.run.code === 0));
	}
	, verifyRun: async ({ index, run, records, read, tap, verification }) => {
		assert.deepEqual(Object.keys(run).sort(), [
			"accepted", "controls", "recordCount", "resultOnly", "reviewed"
			, "route", "tapSha256", "verificationSha256"
		].sort());
		const options = {
			route: run.route, producer: revisions.producer
			, consumer: revisions.consumer, directory: `/archive/${run.route}/records`
			, tap: `/archive/${run.route}/run.tap`, glibc: index.floor
			, dotnet: index.tools.command, tapSource: tap.toString()
		};
		const originals = new Map();
		for(const path of records.keys()) originals.set(path, await read(path));
		const controlled = await zeroPayloadDotnetNegativeControls(
			originals, options, index.tools.interpreter);
		const { accepted, ...controls } = controlled;
		const selection = zeroPayloadDotnetSelection(run.route);
		assert.deepEqual(run, {
			route: run.route, reviewed: selection.reviewed
			, resultOnly: selection.resultOnly, recordCount: records.size
			, accepted, controls, tapSha256: sha256(tap)
			, verificationSha256: sha256(verification)
		});
		assert.equal(verification.toString(), canonicalJson({
			...accepted, controls
		}));
		return accepted;
	}
});
let cached;

/**
 * Verify every retained byte, source snapshot, route and GitHub API record.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkZeroPayloadDotnetEvidence = async (read = readFile) => {
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
