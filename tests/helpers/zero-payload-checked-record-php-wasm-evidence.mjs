/**
 * Authenticate the immutable hosted zero-payload PHP-Wasm archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	assertZeroPayloadPhpWasmCompilerTap, checkZeroPayloadPhpWasmCiRecords
} from "./zero-payload-checked-record-php-wasm-ci-report.mjs";
import {
	checkZeroPayloadPhpWasmModel
} from "./zero-payload-checked-record-php-wasm-fixture.mjs";
import {
	zeroPayloadPhpRoutes
} from "./zero-payload-checked-record-php-fixture.mjs";
import {
	zeroPayloadPhpWasmEvidenceSources
} from "./zero-payload-checked-record-hosted-evidence-sources.mjs";
import {
	checkZeroPayloadHostedEvidenceArchive
} from "./zero-payload-checked-record-hosted-evidence.mjs";

export const zeroPayloadPhpWasmEvidence
	= "docs/evidence/zero-payload-checked-record-php-wasm-20261021";
export const zeroPayloadPhpWasmEvidenceSha256
	= "3e9d3dbe6630c3512749465488ed0fa1d7c08f0ec11501d40837a69e7756a7a9";
const producer = "6d063783673068077fece2bcdd98009796ff67a9";
const revisions = Object.freeze({
	producer, consumer: producer, checker: producer
	, archiver: "0e8b0f36182a5ae90bf47da2439faae3e3a60b49"
});
const parse = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), label);
	return value;
};

const compilerFiles = index => {
	const files = index.files.filter(file => file.path.startsWith("compiler/"));
	assert.deepEqual(files.map(file => file.path).sort(), [
		"compiler/check.log", "compiler/run.tap"
		, ...zeroPayloadPhpRoutes.flatMap(route => [
			`compiler/records/${route}/adapters.lean`
			, `compiler/records/${route}/generated.c`
			, `compiler/records/${route}/model.json`
			, `compiler/records/${route}/provider.c`
		])
	].sort());
	return files.map(file => ({
		path: file.path
		, artifact: `zero-payload-checked-record-php-wasm-ci/${file.path}`
	}));
};

const contract = index => Object.freeze({
	evidence: zeroPayloadPhpWasmEvidence
	, indexSha256: zeroPayloadPhpWasmEvidenceSha256
	, indexKeys: [
		"archiveCommit", "checkerCommit", "compiler", "consumerCommit", "files"
		, "hostedRun", "kind", "limitations", "producerCommit", "runs"
		, "runtime", "schemaVersion", "selectedSources"
	]
	, kind: "zero-payload-checked-record-php-wasm-installed-v1"
	, limitationCount: 7
	, revisions, sources: zeroPayloadPhpWasmEvidenceSources(revisions)
	, routes: zeroPayloadPhpRoutes
	, artifactRoot: "zero-payload-checked-record-php-wasm-ci"
	, retainedRoutePaths: ["run.tap", "check.log"]
	, retainedLogs: [{
		path: "hosted/logs/host.log"
		, artifact: "zero-payload-checked-record-php-wasm-host.log"
	}
	, {
		path: "hosted/logs/runtime.log"
		, artifact: "zero-payload-checked-record-php-wasm-runtime.log"
	}]
	, retainedFiles: [{
		path: "hosted/runtime/runtime.json"
		, artifact: "zero-payload-checked-record-php-wasm-input/php-wasm-runtime/runtime.json"
	}
	, ...compilerFiles(index)]
	, workflow: ".github/workflows/zero-payload-checked-record-php-wasm.yml"
	, runId: 39621064577
	, jobId: 119294264118
	, artifactId: 12356309200
	, artifactBytes: 7918879
	, artifactSha256: "74bfd6d50ede6833277e85000347a00b5b0f18ea5621627277128d49100e3ec3"
	, verifyIndex: async retained => {
		assert.equal(retained.runtime.schemaVersion, 1);
		assert.equal(retained.runtime.profile, "php-wasm-copied-v1");
		assert.equal(retained.runtime.pointerBits, 32);
		assert.equal(retained.runtime.pins.emscriptenVersion, "3.1.68");
		assert.equal(retained.runtime.pins.phpVersion, "8.4.1");
		assert.deepEqual(retained.compiler.routes, zeroPayloadPhpRoutes);
		assert.equal(retained.compiler.observations.length, zeroPayloadPhpRoutes.length);
		assert.match(retained.compiler.tapSha256, /^[a-f0-9]{64}$/u);
	}
	, verifyRetainedFiles: async ({ index: retained, files }) => {
		const runtime = Buffer.from(files["hosted/runtime/runtime.json"]);
		assert.deepEqual(parse(runtime, "runtime.json"), retained.runtime);
		const tap = Buffer.from(files["compiler/run.tap"]);
		assertZeroPayloadPhpWasmCompilerTap(tap.toString());
		assert.equal(sha256(tap), retained.compiler.tapSha256);
		assert.equal(Buffer.from(files["compiler/check.log"]).toString()
			, "Four fresh-Lean zero-payload PHP-Wasm compiler tests passed without skips.\n");
		const observations = [...tap.toString().matchAll(/^# (\{.*\})$/gmu)]
			.map(match => JSON.parse(match[1]));
		assert.deepEqual(observations, retained.compiler.observations);
		for(const [position, route] of zeroPayloadPhpRoutes.entries())
		{
			const prefix = `compiler/records/${route}/`;
			const model = parse(Buffer.from(files[prefix + "model.json"])
				, `${route}/model.json`);
			checkZeroPayloadPhpWasmModel(model, route);
			assert.equal(sha256(files[prefix + "generated.c"])
				, observations[position].generatedCSha256, route);
			for(const path of ["adapters.lean", "provider.c"])
				assert.ok(Buffer.from(files[prefix + path]).length > 0, `${route}/${path}`);
		}
	}
	, verifyRun: async ({ run, records, read, retained, tap }) => {
		const verification = retained["check.log"];
		assert.deepEqual(Object.keys(run).sort(), [
			"accepted", "recordCount", "route", "tapSha256"
			, "verificationSha256"
		].sort());
		const checked = await checkZeroPayloadPhpWasmCiRecords({
			route: run.route, producer: revisions.producer
			, directory: `/archive/${run.route}/records`
			, tap: `/archive/${run.route}/run.tap`
		}, { tap: tap.toString(), read });
		assert.deepEqual(run, {
			route: run.route, recordCount: records.size, accepted: checked
			, tapSha256: sha256(tap), verificationSha256: sha256(verification)
		});
		assert.equal(verification.toString(), canonicalJson(checked));
		return checked;
	}
});

let cached;

/**
 * Verify every retained byte, compiler probe, installed route and API record.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkZeroPayloadPhpWasmEvidence = async (read = readFile) => {
	const index = parse(Buffer.from(await read(
		`${zeroPayloadPhpWasmEvidence}/index.json`)), "index.json");
	const verify = () => checkZeroPayloadHostedEvidenceArchive(contract(index), read);
	if(read !== readFile)
		return { ...await verify(), ...revisions
			, supportPromoted: false, hostedAcceptance: true };
	cached ??= verify();
	return { ...await cached, ...revisions
		, supportPromoted: false, hostedAcceptance: true };
};
