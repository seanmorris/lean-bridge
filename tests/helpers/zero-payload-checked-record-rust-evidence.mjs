/**
 * Authenticate the immutable hosted zero-payload Rust archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	zeroPayloadBrowserSelection
} from "./zero-payload-checked-record-browser-fixture.mjs";
import {
	zeroPayloadRustCiReader, checkZeroPayloadRustCiRecords
} from "./zero-payload-checked-record-rust-ci-report.mjs";
import {
	zeroPayloadRustRoutes
} from "./zero-payload-checked-record-rust-fixture.mjs";
import {
	zeroPayloadRustEvidenceSources
} from "./zero-payload-checked-record-hosted-evidence-sources.mjs";
import {
	checkZeroPayloadHostedEvidenceArchive
} from "./zero-payload-checked-record-hosted-evidence.mjs";

export const zeroPayloadRustEvidence
	= "docs/evidence/zero-payload-checked-record-rust-20261021";
export const zeroPayloadRustEvidenceSha256
	= "47a71983922b4b079c577de03ea31e5ba94b3a148d0331fe258f26b6682a6903";
const revision = "a6173cade3bbe158baa1a5695e3e93e1037359b0";
const revisions = Object.freeze({
	producer: revision, consumer: revision, checker: revision, archiver: revision
});
const contract = Object.freeze({
	evidence: zeroPayloadRustEvidence
	, indexSha256: zeroPayloadRustEvidenceSha256
	, indexKeys: [
		"archiveCommit", "checkerCommit", "consumerCommit", "files", "hostedRun"
		, "kind", "limitations", "producerCommit", "runs", "runtime"
		, "schemaVersion", "selectedSources", "toolchain"
	]
	, kind: "zero-payload-checked-record-rust-installed-v1"
	, revisions, sources: zeroPayloadRustEvidenceSources(revisions)
	, routes: zeroPayloadRustRoutes
	, artifactRoot: "zero-payload-checked-record-rust-ci"
	, artifactToolchainLog: "zero-payload-checked-record-rust-toolchain.log"
	, workflow: ".github/workflows/zero-payload-checked-record-rust.yml"
	, runId: 39561655967, jobId: 119094108650, artifactId: 12329518106
	, artifactBytes: 210878135
	, artifactSha256: "a5f727dae9dcf0041af6cdea635649c8a3c409270ef188188123943111e125eb"
	, verifyIndex: async index => {
		assert.deepEqual(index.runtime, {
			arch: "x64", glibc: "2.39", platform: "linux"
		});
		assert.deepEqual(Object.keys(index.toolchain).sort(), ["cargo", "rustc"]);
		assert.match(index.toolchain.cargo.run.stdout, /^cargo 1\.90\.0 /u);
		assert.match(index.toolchain.rustc.run.stdout, /^rustc 1\.90\.0 /u);
		assert.equal(index.toolchain.cargo.run.code, 0);
		assert.equal(index.toolchain.rustc.run.code, 0);
	}
	, verifyRun: async ({ index, run, records, read, tap, verification }) => {
		assert.deepEqual(Object.keys(run).sort(), [
			"accepted", "recordCount", "resultOnly", "reviewed", "route"
			, "tapSha256", "verificationSha256"
		].sort());
		const checked = await checkZeroPayloadRustCiRecords({
			route: run.route, producer: revisions.producer
			, directory: `/archive/${run.route}/records`
			, tap: `/archive/${run.route}/run.tap`, glibc: run.accepted.floor
			, rustc: index.toolchain.rustc.command
			, cargo: index.toolchain.cargo.command
		}, {
			tap: tap.toString(), read: await zeroPayloadRustCiReader(read)
			, runtime: index.runtime, toolchain: index.toolchain
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
 * Verify every retained byte, source snapshot, route and GitHub API record.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkZeroPayloadRustEvidence = async (read = readFile) => {
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
