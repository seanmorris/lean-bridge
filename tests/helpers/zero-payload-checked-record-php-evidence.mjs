/**
 * Authenticate the immutable hosted zero-payload native-PHP archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkZeroPayloadPhpCiRecords
} from "./zero-payload-checked-record-php-ci-report.mjs";
import {
	zeroPayloadPhpRoutes
} from "./zero-payload-checked-record-php-fixture.mjs";
import {
	zeroPayloadBrowserSelection
} from "./zero-payload-checked-record-browser-fixture.mjs";
import {
	zeroPayloadPhpEvidenceSources
} from "./zero-payload-checked-record-hosted-evidence-sources.mjs";
import {
	checkZeroPayloadHostedEvidenceArchive
} from "./zero-payload-checked-record-hosted-evidence.mjs";

export const zeroPayloadPhpEvidence
	= "docs/evidence/zero-payload-checked-record-php-20261021";
export const zeroPayloadPhpEvidenceSha256
	= "0c14e36be0a912d31cddb75dbb883fe312c8a55b717a0f94a25cc9c30829fc08";
const producer = "736ce9d03fc324ed6004aa77de534cd9885bfa83";
const revisions = Object.freeze({
	producer, consumer: producer, checker: producer
	, archiver: "ae553edc16c9ee5606d8375414946b497351f672"
});
const contract = Object.freeze({
	evidence: zeroPayloadPhpEvidence
	, indexSha256: zeroPayloadPhpEvidenceSha256
	, indexKeys: [
		"archiveCommit", "checkerCommit", "consumerCommit", "files"
		, "hostedRun", "kind", "limitations", "producerCommit", "runs"
		, "runtime", "schemaVersion", "selectedSources", "tools"
	]
	, kind: "zero-payload-checked-record-php-installed-v1"
	, limitationCount: 7
	, revisions, sources: zeroPayloadPhpEvidenceSources(revisions)
	, routes: zeroPayloadPhpRoutes
	, artifactRoot: "zero-payload-checked-record-php-ci"
	, artifactToolchainLog: "zero-payload-checked-record-php-toolchain.log"
	, retainedFiles: [{
		path: "hosted/tools.json"
		, artifact: "zero-payload-checked-record-php-ci/tools.json"
	}]
	, workflow: ".github/workflows/zero-payload-checked-record-php.yml"
	, runId: 39588427478, jobId: 119183027416, artifactId: 12342822535
	, artifactBytes: 205635654
	, artifactSha256: "71d4914954caadbc1f8f54c31cb1eeb1185a850980311e6d547df051eb58629b"
	, verifyIndex: async index => {
		assert.deepEqual(index.runtime, {
			arch: "x64", glibc: "2.39", platform: "linux"
		});
		assert.equal(index.tools.selected.phpVersion, "8.3.6");
		assert.equal(index.tools.selected.composerVersion, "2.7.1");
		assert.equal(index.tools.command, "/usr/bin/php8.3");
		assert.equal(index.tools.composer, "/usr/bin/composer");
	}
	, verifyRetainedFiles: async ({ index, files }) => {
		const bytes = files["hosted/tools.json"];
		const tools = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(tools));
		assert.deepEqual(tools, index.tools);
	}
	, verifyRun: async ({ index, run, records, read, tap, verification }) => {
		assert.deepEqual(Object.keys(run).sort(), [
			"accepted", "recordCount", "resultOnly", "reviewed", "route"
			, "tapSha256", "verificationSha256"
		].sort());
		const checked = await checkZeroPayloadPhpCiRecords([
			"--route", run.route, "--producer", revisions.producer
			, "--directory", `/archive/${run.route}/records`
			, "--tap", `/archive/${run.route}/run.tap`
			, "--glibc", run.accepted.floor, "--php", index.tools.command
			, "--composer", index.tools.composer
			, "--php-version", index.tools.selected.phpVersion
			, "--composer-version", index.tools.selected.composerVersion
		], { tap: tap.toString(), read, runtime: index.runtime, tools: index.tools });
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
 * Verify every retained byte, route, source, host record and tool identity.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkZeroPayloadPhpEvidence = async (read = readFile) => {
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
