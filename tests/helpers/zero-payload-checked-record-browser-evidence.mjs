/**
 * Authenticate the immutable hosted zero-payload npm/browser archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkZeroPayloadBrowserCiRecords
} from "./zero-payload-checked-record-browser-ci-report.mjs";
import {
	zeroPayloadBrowserEngines, zeroPayloadBrowserRoutes
	, zeroPayloadBrowserSelection
} from "./zero-payload-checked-record-browser-fixture.mjs";
import {
	zeroPayloadBrowserEvidenceSources
} from "./zero-payload-checked-record-hosted-evidence-sources.mjs";
import {
	checkZeroPayloadHostedEvidenceArchive
} from "./zero-payload-checked-record-hosted-evidence.mjs";

export const zeroPayloadBrowserEvidence
	= "docs/evidence/zero-payload-checked-record-browser-20261021";
export const zeroPayloadBrowserEvidenceSha256
	= "90f9686218060b004135226c51ce7977a6426497a348aefafa37a17e9f9bf4f0";
const revision = "736ce9d03fc324ed6004aa77de534cd9885bfa83";
const revisions = Object.freeze({
	producer: revision, npmChecker: revision, consumer: revision
	, checker: revision, archiver: revision
});
const browserVersions = checked => Object.fromEntries(
	zeroPayloadBrowserEngines.map(engine => {
		const versions = new Set(checked.browser.reports.flatMap(report =>
			report.observations.filter(item => item.engine === engine)
				.map(item => item.observation.hostVersion)));
		assert.equal(versions.size, 1, `${engine} version identity`);
		return [engine, [...versions][0]];
	})
);
const retainedRoutePaths = Object.freeze([
	"acceptance.tap", "controls.tap", "runtime-before.json"
	, "runtime-after.json", "verification.json"
]);
const contract = Object.freeze({
	evidence: zeroPayloadBrowserEvidence
	, indexSha256: zeroPayloadBrowserEvidenceSha256
	, indexKeys: [
		"archiveCommit", "browserVersions", "checkerCommit", "consumerCommit"
		, "files", "hostedRun", "kind", "limitations", "loadCeiling"
		, "npmCheckerCommit", "producerCommit", "runs", "runtime"
		, "schemaVersion", "selectedSources"
	]
	, kind: "zero-payload-checked-record-browser-installed-v1"
	, revisions, sources: zeroPayloadBrowserEvidenceSources(revisions)
	, routes: zeroPayloadBrowserRoutes
	, retainedRoutePaths
	, artifactRoot: "zero-payload-checked-record-browser-ci"
	, artifactRecordPath: (route, path) =>
		`zero-payload-checked-record-browser-ci/records/${route}/${path}`
	, retainedLogs: [
		{ path: "hosted/logs/engine.log"
			, artifact: "zero-payload-checked-record-browser-engine.log" }
		, { path: "hosted/logs/runtime.log"
			, artifact: "zero-payload-checked-record-browser-runtime.log" }
	]
	, workflow: ".github/workflows/zero-payload-checked-record-browser.yml"
	, runId: 39588425879, jobId: 119183026811, artifactId: 12342149147
	, artifactBytes: 7116596
	, artifactSha256: "7c2cb7ad669cb889105302ad79d833a5a183b460e4d58d8b9cd3203acb2667ab"
	, verifyIndex: async index => {
		assert.equal(index.npmCheckerCommit, revisions.npmChecker);
		assert.equal(index.loadCeiling, 8);
		assert.deepEqual(index.runtime, {
			arch: "x64", node: "v22.23.3", platform: "linux"
		});
		assert.deepEqual(index.browserVersions, {
			chromium: "151.0.7922.34", firefox: "153.0", webkit: "26.5"
		});
	}
	, verifyRun: async ({ index, run, records, read, retained }) => {
		assert.deepEqual(Object.keys(run).sort(), [
			"acceptanceTapSha256", "accepted", "controls"
			, "controlsTapSha256", "recordCount", "resultOnly", "reviewed"
			, "route", "verificationSha256"
		].sort());
		const runtimeBefore = JSON.parse(retained["runtime-before.json"]);
		const runtimeAfter = JSON.parse(retained["runtime-after.json"]);
		assert.deepEqual(runtimeBefore, index.runtime);
		assert.deepEqual(runtimeAfter, runtimeBefore);
		const checked = await checkZeroPayloadBrowserCiRecords({
			route: run.route, producer: revisions.producer
			, "npm-checker": revisions.npmChecker, consumer: revisions.consumer
			, checker: revisions.checker
			, directory: `/archive/${run.route}/records`
			, "acceptance-tap": `/archive/${run.route}/acceptance.tap`
			, "controls-tap": `/archive/${run.route}/controls.tap`
			, runtime: `/archive/${run.route}/runtime-before.json`
		}, {
			acceptanceTap: retained["acceptance.tap"].toString()
			, controlsTap: retained["controls.tap"].toString()
			, runtime: runtimeBefore, paths: [...records.keys()].sort(), read
		});
		assert.deepEqual(browserVersions(checked), index.browserVersions);
		const selection = zeroPayloadBrowserSelection(run.route);
		assert.deepEqual(run, {
			route: run.route, reviewed: selection.reviewed
			, resultOnly: selection.resultOnly, recordCount: records.size
			, accepted: checked, controls: checked.controls
			, acceptanceTapSha256: sha256(retained["acceptance.tap"])
			, controlsTapSha256: sha256(retained["controls.tap"])
			, verificationSha256: sha256(retained["verification.json"])
		});
		assert.equal(retained["verification.json"].toString()
			, canonicalJson(checked));
		return checked;
	}
});
let cached;

/**
 * Verify every retained byte, source snapshot, route and GitHub API record.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkZeroPayloadBrowserEvidence = async (read = readFile) => {
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
