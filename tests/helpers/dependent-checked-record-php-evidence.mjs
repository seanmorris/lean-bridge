/**
 * Authenticate the immutable hosted native-PHP dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkDependentCheckedRecordPhpCiRecords
} from "./dependent-checked-record-php-ci-report.mjs";
import {
	dependentCheckedRecordPhpRoutes, dependentCheckedRecordPhpSelection
} from "./dependent-checked-record-php-fixture.mjs";
import {
	dependentCheckedRecordPhpEvidenceSources
} from "./dependent-checked-record-hosted-evidence-sources.mjs";
import {
	checkZeroPayloadHostedEvidenceArchive
} from "./zero-payload-checked-record-hosted-evidence.mjs";

export const dependentCheckedRecordPhpEvidence
	= "docs/evidence/dependent-checked-record-php-20261021";
export const dependentCheckedRecordPhpEvidenceSha256
	= "7c9dbd914da5d205852565d4c968575c9762fa6560a13faa71e0aa47d65bdc16";
const producer = "6cff3434bff38689ea6bda776ae143057a265ad5";
const revisions = Object.freeze({
	producer, consumer: producer, checker: producer
	, archiver: "9726d5d4ab5a72befcbb904e32b5c8b0390af447"
});
const contract = Object.freeze({
	evidence: dependentCheckedRecordPhpEvidence
	, indexSha256: dependentCheckedRecordPhpEvidenceSha256
	, indexKeys: [
		"archiveCommit", "checkerCommit", "consumerCommit", "files"
		, "hostedRun", "kind", "limitations", "producerCommit", "runs"
		, "runtime", "schemaVersion", "selectedSources", "tools"
	]
	, kind: "dependent-checked-record-php-installed-v1"
	, limitationCount: 7, revisions
	, sources: dependentCheckedRecordPhpEvidenceSources(revisions)
	, routes: dependentCheckedRecordPhpRoutes
	, artifactRoot: "dependent-checked-record-php-ci"
	, retainedLogs: [{
		path: "hosted/logs/toolchain.log"
		, artifact: "dependent-checked-record-php-toolchain.log"
	}]
	, retainedFiles: [{
		path: "hosted/tools.json"
		, artifact: "dependent-checked-record-php-ci/tools.json"
	}]
	, workflow: ".github/workflows/dependent-checked-record-php.yml"
	, runId: 39863597094, jobId: 120120131416
	, artifactId: 12463338839, artifactBytes: 205490438
	, artifactSha256:
		"0d17b855bc9ab2c902677da4fcae118f31f77c15f4ab87fd4ab9a016671e3cee"
	, verifyIndex: async index => {
		assert.deepEqual(index.runtime, {
			arch: "x64", glibc: "2.39", platform: "linux"
		});
		assert.deepEqual(Object.keys(index.tools).sort(), [
			"command", "composer", "composerFlags", "composerVersion"
			, "interpreter", "runtimeFlags", "selected", "tools"
		]);
		assert.equal(index.tools.selected.phpVersion, "8.3.6");
		assert.equal(index.tools.selected.composerVersion, "2.7.1");
		assert.equal(index.tools.interpreter.php.integerBytes, 8);
		assert.equal(index.tools.interpreter.php.zts, 0);
		assert.equal(index.tools.interpreter.run.code, 0);
		assert.equal(index.tools.composerVersion.run.code, 0);
	}
	, verifyRun: async ({ index, run, records, read, tap, verification }) => {
		assert.deepEqual(Object.keys(run).sort(), [
			"accepted", "recordCount", "resultOnly", "reviewed", "route"
			, "tapSha256", "verificationSha256"
		].sort());
		const checked = await checkDependentCheckedRecordPhpCiRecords([
			"--route", run.route, "--producer", revisions.producer
			, "--directory", `/archive/${run.route}/records`
			, "--tap", `/archive/${run.route}/run.tap`
			, "--glibc", "2.38"
			, "--php", index.tools.selected.php
			, "--composer", index.tools.selected.composer
			, "--php-version", index.tools.selected.phpVersion
			, "--composer-version", index.tools.selected.composerVersion
		], { tap: tap.toString(), read, runtime: index.runtime, tools: index.tools });
		assert.equal(verification.toString(), canonicalJson(checked));
		const selection = dependentCheckedRecordPhpSelection(run.route);
		assert.deepEqual(run, {
			route: run.route, reviewed: selection.reviewed
			, resultOnly: selection.resultOnly, recordCount: records.size
			, accepted: checked, tapSha256: sha256(tap)
			, verificationSha256: sha256(verification)
		});
		return checked;
	}
	, verifyRetainedFiles: async ({ index, files }) => {
		const bytes = files["hosted/tools.json"];
		assert.equal(bytes.toString(), canonicalJson(index.tools));
	}
});
let cached;

/**
 * Verify every retained byte, Composer route, source and GitHub record.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkDependentCheckedRecordPhpEvidence = async (
	read = readFile
) => {
	if(read !== readFile)
		return {
			...await checkZeroPayloadHostedEvidenceArchive(contract, read)
			, ...revisions, supportPromoted: false, hostedAcceptance: true
		};
	cached ??= checkZeroPayloadHostedEvidenceArchive(contract, readFile);
	const checked = await cached;
	return {
		...checked, ...revisions
		, runtime: checked.index.runtime
		, tools: checked.index.tools
		, supportPromoted: false, hostedAcceptance: true
	};
};
