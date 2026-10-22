/**
 * Authenticate the immutable hosted .NET dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	dependentCheckedRecordDotnetNegativeControls
} from "./dependent-checked-record-dotnet-controls.mjs";
import {
	dependentCheckedRecordDotnetRoutes
	, dependentCheckedRecordDotnetSelection
} from "./dependent-checked-record-dotnet-fixture.mjs";
import {
	dependentCheckedRecordDotnetEvidenceSources
} from "./dependent-checked-record-hosted-evidence-sources.mjs";
import {
	checkZeroPayloadHostedEvidenceArchive
} from "./zero-payload-checked-record-hosted-evidence.mjs";

export const dependentCheckedRecordDotnetEvidence
	= "docs/evidence/dependent-checked-record-dotnet-20261021";
export const dependentCheckedRecordDotnetEvidenceSha256
	= "d2ec61bbd52061c90a6fc4ead14c8cbc3477df24c002b8fe8ce94b665762af92";
const producer = "b869fb3f1cbf320c3cb453058f4a7bdf095a49c1";
const revisions = Object.freeze({
	producer, consumer: producer, checker: producer
	, archiver: "11eeb5895a9eba94b5888b70a453ee3d14353b3d"
});
const contract = Object.freeze({
	evidence: dependentCheckedRecordDotnetEvidence
	, indexSha256: dependentCheckedRecordDotnetEvidenceSha256
	, indexKeys: [
		"archiveCommit", "checkerCommit", "consumerCommit", "files", "floor"
		, "hostedRun", "kind", "limitations", "producerCommit"
		, "resourceCeiling", "runs", "runtime", "schemaVersion"
		, "selectedSources", "toolchain"
	]
	, kind: "dependent-checked-record-dotnet-installed-v1"
	, limitationCount: 7
	, revisions, sources: dependentCheckedRecordDotnetEvidenceSources(revisions)
	, routes: dependentCheckedRecordDotnetRoutes
	, artifactRoot: "dependent-checked-record-dotnet-ci"
	, retainedLogs: [{
		path: "hosted/logs/toolchain.log"
		, artifact: "dependent-checked-record-dotnet-toolchain.log"
	}]
	, workflow: ".github/workflows/dependent-checked-record-dotnet.yml"
	, runId: 39857550512, jobId: 120100087128
	, artifactId: 12460139373, artifactBytes: 205151638
	, artifactSha256:
		"6ba3a249732301becca41f162f0f4191ed19256f1975d9e5c6237ecc2861e3d1"
	, verifyIndex: async index => {
		assert.deepEqual(index.runtime, {
			arch: "x64"
			, glibc: { code: 0, stderr: "", stdout: "glibc 2.39\n" }
			, platform: "linux"
		});
		assert.equal(index.floor, "2.38");
		assert.equal(index.resourceCeiling, 6);
		assert.deepEqual(Object.keys(index.toolchain).sort(), [
			"command", "interpreter", "measurements", "sdk"
		]);
		assert.equal(index.toolchain.sdk.version, "8.0.424");
		assert.equal(index.toolchain.measurements.length, 3);
		assert.ok(index.toolchain.measurements.every(item =>
			!Object.hasOwn(item, "cwd")
			&& item.command === index.toolchain.command && item.run.code === 0));
	}
	, verifyRun: async ({ index, run, records, read, tap, verification }) => {
		assert.deepEqual(Object.keys(run).sort(), [
			"accepted", "controls", "mode", "recordCount", "route"
			, "tapSha256", "verificationSha256"
		].sort());
		const options = {
			route: run.route, producer: revisions.producer
			, consumer: revisions.consumer
			, directory: `/archive/${run.route}/records`
			, tap: `/archive/${run.route}/run.tap`, glibc: index.floor
			, dotnet: index.toolchain.command, tapSource: tap.toString()
		};
		const originals = new Map();
		for(const path of records.keys()) originals.set(path, await read(path));
		const controlled = await dependentCheckedRecordDotnetNegativeControls(
			originals, options, index.toolchain.interpreter);
		const { accepted, ...controls } = controlled;
		const selection = dependentCheckedRecordDotnetSelection(run.route);
		assert.deepEqual(run, {
			route: run.route, mode: selection.resultOnly ? "result-only" : "full"
			, recordCount: records.size, accepted, controls
			, tapSha256: sha256(tap)
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
 * Verify every retained byte, route, NuGet package, source and GitHub record.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkDependentCheckedRecordDotnetEvidence = async (
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
