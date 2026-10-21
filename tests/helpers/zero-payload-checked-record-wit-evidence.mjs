/**
 * Authenticate the immutable hosted zero-payload WIT archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkZeroPayloadWitCiRecords
} from "./zero-payload-checked-record-wit-ci-report.mjs";
import {
	zeroPayloadWitRoutes
} from "./zero-payload-checked-record-wit-fixture.mjs";
import {
	zeroPayloadBrowserSelection
} from "./zero-payload-checked-record-browser-fixture.mjs";
import {
	inspectZeroPayloadWitHandoff
} from "./zero-payload-checked-record-wit-handoff.mjs";
import {
	zeroPayloadWitEvidenceSources
} from "./zero-payload-checked-record-hosted-evidence-sources.mjs";
import {
	checkZeroPayloadHostedEvidenceArchive
} from "./zero-payload-checked-record-hosted-evidence.mjs";

export const zeroPayloadWitEvidence
	= "docs/evidence/zero-payload-checked-record-wit-20261021";
export const zeroPayloadWitEvidenceSha256
	= "3f5f32536cff627c8f537a733c1aa8cf2b8b599aa74729748e7a5dbb365f8881";
const producer = "736ce9d03fc324ed6004aa77de534cd9885bfa83";
const revisions = Object.freeze({
	producer, consumer: producer, checker: producer
	, archiver: "e92c68019fb78e3add2d506af7719dc40db6e462"
});
const contract = Object.freeze({
	evidence: zeroPayloadWitEvidence
	, indexSha256: zeroPayloadWitEvidenceSha256
	, indexKeys: [
		"archiveCommit", "checkerCommit", "consumerCommit", "files"
		, "hostedRun", "kind", "limitations", "producerCommit", "runs"
		, "runtime", "schemaVersion", "selectedSources", "tools"
	]
	, kind: "zero-payload-checked-record-wit-installed-v1"
	, limitationCount: 7
	, revisions, sources: zeroPayloadWitEvidenceSources(revisions)
	, routes: zeroPayloadWitRoutes
	, artifactRoot: "zero-payload-checked-record-wit-ci"
	, artifactToolchainLog: "zero-payload-checked-record-wit-toolchain.log"
	, retainedFiles: [{
		path: "hosted/tools.json"
		, artifact: "zero-payload-checked-record-wit-ci/tools.json"
	}]
	, workflow: ".github/workflows/zero-payload-checked-record-wit.yml"
	, runId: 39588427412, jobId: 119183027124, artifactId: 12344107815
	, artifactBytes: 237512426
	, artifactSha256: "760eeb5e317ef2ed185f7a94b834bb00036137a0f783573005b980216c9dd29c"
	, verifyIndex: async index => {
		assert.deepEqual(index.runtime, {
			arch: "x64", glibc: "2.39", platform: "linux"
		});
		assert.deepEqual(index.tools.selected, {
			cc: "/usr/bin/x86_64-linux-gnu-gcc-13"
			, wasmTools: "/home/runner/work/lean-bridge/lean-bridge/.toolchains/wasm-tools/bin/wasm-tools"
			, wasmtimeCapi: "/nix/store/6whfb24ddsrlpiscdn9j3rrbvhyp7zan-wasmtime-42.0.1-x86_64-linux-c-api"
		});
		assert.equal(index.tools.wasmtime.version, "42.0.1");
	}
	, verifyRetainedFiles: async ({ index, files }) => {
		const bytes = files["hosted/tools.json"];
		const tools = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(tools));
		assert.deepEqual(tools, index.tools);
	}
	, verifyRun: async ({ index, run, records, read, tap, verification }) => {
		assert.deepEqual(Object.keys(run).sort(), [
			"accepted", "mode", "recordCount", "resultOnly", "reviewed"
			, "route", "tapSha256", "verificationSha256"
		].sort());
		const original = await inspectZeroPayloadWitHandoff(read);
		const selection = zeroPayloadBrowserSelection(run.route);
		const mode = selection.resultOnly ? "result-only" : "full";
		const checked = await checkZeroPayloadWitCiRecords({
			route: run.route, mode, producer: revisions.producer
			, directory: `/archive/${run.route}/records`
			, tap: `/archive/${run.route}/run.tap`, glibc: run.accepted.floor
			, cc: index.tools.selected.cc
			, "wasm-tools": index.tools.selected.wasmTools
			, "wasmtime-capi": index.tools.selected.wasmtimeCapi
		}, {
			tap: tap.toString(), runtime: index.runtime
			, read: path => original.supplements.get(path) ?? read(path)
			, tools: index.tools, archiveSha256: original.archiveSha256
		});
		assert.deepEqual([...records.keys()].sort(), [
			...checked.records.filter(path => !original.supplements.has(path))
			, original.archivePath
		].sort());
		assert.deepEqual(run, {
			route: run.route, mode, reviewed: selection.reviewed
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
 * Verify every retained byte, source, route, tool and GitHub host record.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkZeroPayloadWitEvidence = async (read = readFile) => {
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
