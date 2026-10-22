/**
 * Authenticate the immutable hosted WIT dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { open, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	extractDependentCheckedRecordHostedArtifact
} from "./dependent-checked-record-hosted-archive.mjs";
import {
	dependentCheckedRecordSelection
} from "./dependent-checked-record-browser-fixture.mjs";
import {
	dependentCheckedRecordWitEvidenceSources
} from "./dependent-checked-record-hosted-evidence-sources.mjs";
import {
	checkDependentCheckedRecordWitCiRecords
} from "./dependent-checked-record-wit-ci-report.mjs";
import {
	dependentCheckedRecordWitRoutes
} from "./dependent-checked-record-wit-fixture.mjs";
import {
	inspectDependentCheckedRecordWitHandoff
} from "./dependent-checked-record-wit-handoff.mjs";
import {
	assertNominalSubtypeWitToolRecords
} from "./nominal-subtype-wit-tool-records.mjs";
import {
	checkZeroPayloadHostedEvidenceArchive
} from "./zero-payload-checked-record-hosted-evidence.mjs";

export const dependentCheckedRecordWitEvidence
	= "docs/evidence/dependent-checked-record-wit-20261021";
export const dependentCheckedRecordWitEvidenceSha256
	= "dad34a2e2961fb9008d02e9abe96d5bd0543f47ed2b72405ac8c345a455a109a";
const producer = "9687cccc00a3c0f546925aaa5bcf6c8b6040d367";
const revisions = Object.freeze({
	producer, consumer: producer, checker: producer
	, archiver: "0cb1ddd2c0154444c209af32e0c2181f6e6c49f8"
});
const artifactRoot = "dependent-checked-record-wit-ci";
const artifactTools = `${artifactRoot}/tools.json`;
const contract = Object.freeze({
	evidence: dependentCheckedRecordWitEvidence
	, indexSha256: dependentCheckedRecordWitEvidenceSha256
	, indexKeys: [
		"archiveCommit", "checkerCommit", "consumerCommit", "files"
		, "hostedRun", "kind", "limitations", "producerCommit", "runs"
		, "runtime", "schemaVersion", "selectedSources", "tools"
	]
	, kind: "dependent-checked-record-wit-installed-v1"
	, limitationCount: 7, revisions
	, sources: dependentCheckedRecordWitEvidenceSources(revisions)
	, routes: dependentCheckedRecordWitRoutes
	, artifactRoot
	, artifactOnlyMembers: [artifactTools]
	, artifactToolchainLog: "dependent-checked-record-wit-toolchain.log"
	, workflow: ".github/workflows/dependent-checked-record-wit.yml"
	, runId: 39871962476, jobId: 120148286417
	, artifactId: 12468135063, artifactBytes: 237305042
	, artifactSha256:
		"5e9f4fa3714e456d33ace0a4519511aad8d11106833c6d15f0f541b8d2a70a24"
	, verifyIndex: async index => {
		assert.deepEqual(index.runtime, {
			platform: "linux", arch: "x64", glibc: "2.39"
		});
		assertNominalSubtypeWitToolRecords(index.tools);
		assert.equal(index.hostedRun.runAttempt, 1);
		assert.equal(index.hostedRun.job.name
			, "Four dependent checked-record checked-record routes through Wasmtime");
		assert.equal(index.hostedRun.artifact.name
			, `dependent-checked-record-wit-${producer}`);
	}
	, verifyRun: async ({ index, run, records, read, retained, tap }) => {
		assert.deepEqual(Object.keys(run).sort(), [
			"accepted", "mode", "recordCount", "resultOnly", "reviewed"
			, "route", "tapSha256", "verificationSha256"
		].sort());
		const original = await inspectDependentCheckedRecordWitHandoff(read);
		const selection = dependentCheckedRecordSelection(run.route);
		const mode = selection.resultOnly ? "result-only" : "full";
		const checked = await checkDependentCheckedRecordWitCiRecords({
			route: run.route, mode, producer: revisions.producer
			, directory: `/archive/${run.route}/records`
			, tap: `/archive/${run.route}/run.tap`
			, glibc: "2.38", cc: index.tools.selected.cc
			, "wasm-tools": index.tools.selected.wasmTools
			, "wasmtime-capi": index.tools.selected.wasmtimeCapi
		}, {
			tap: tap.toString(), runtime: index.runtime
			, read: path => original.supplements.get(path) ?? read(path)
			, tools: index.tools
			, archiveSha256: original.archiveSha256
		});
		const verification = retained["verification.json"];
		assert.equal(verification.toString(), canonicalJson(checked));
		assert.deepEqual(run, {
			route: run.route, mode, reviewed: selection.reviewed
			, resultOnly: selection.resultOnly, recordCount: records.size
			, accepted: checked, tapSha256: sha256(tap)
			, verificationSha256: sha256(verification)
		});
		return checked;
	}
	, verifyArtifact: async ({ index, files, parts }) => {
		const temporary = await mkdtemp(join(
			tmpdir(), "lean-bridge-dependent-wit-evidence-"));
		let extracted;
		try
		{
			const zip = join(temporary, "artifact.zip");
			const output = await open(zip, "wx");
			try
			{
				let offset = 0;
				for(const part of parts)
				{
					let written = 0;
					while(written < part.length)
					{
						const result = await output.write(part, written
							, part.length - written, offset + written);
						assert.ok(result.bytesWritten > 0);
						written += result.bytesWritten;
					}
					offset += part.length;
				}
			}
			finally
			{ await output.close(); }
			extracted = await extractDependentCheckedRecordHostedArtifact(zip);
			assert.deepEqual(extracted.entries
				, index.hostedRun.artifact.members);
			const mappings = new Map([
				[artifactTools, Buffer.from(canonicalJson(index.tools))]
				, ["dependent-checked-record-wit-toolchain.log"
					, files.get("hosted/logs/toolchain.log")]
			]);
			for(const run of index.runs)
			{
				for(const name of ["run.tap", "verification.json"])
					mappings.set(`${artifactRoot}/${run.route}/${name}`
						, files.get(`${run.route}/${name}`));
				const prefix = `${run.route}/records/`;
				for(const [path, bytes] of files)
					if(path.startsWith(prefix)) mappings.set(
						`${artifactRoot}/${run.route}/records/${run.route}/${path.slice(prefix.length)}`
						, bytes);
			}
			assert.deepEqual([...mappings.keys()].sort()
				, [...index.hostedRun.artifact.members].sort());
			for(const [path, expected] of mappings)
			{
				assert.ok(Buffer.isBuffer(expected), path);
				assert.deepEqual(await readFile(join(extracted.root, path))
					, expected, path);
			}
		}
		finally
		{
			if(extracted) await rm(extracted.root, { recursive: true });
			await rm(temporary, { recursive: true });
		}
	}
});

let cached;

/**
 * Verify every retained byte, WIT route, source and original artifact member.
 *
 * @param read - Repository-relative evidence byte reader.
 */
export const checkDependentCheckedRecordWitEvidence = async (
	read = readFile
) => {
	const checked = read === readFile
		? await (cached ??= checkZeroPayloadHostedEvidenceArchive(contract, readFile))
		: await checkZeroPayloadHostedEvidenceArchive(contract, read);
	return {
		...checked, ...revisions, runtime: checked.index.runtime
		, tools: checked.index.tools
		, supportPromoted: false, hostedAcceptance: true
	};
};
