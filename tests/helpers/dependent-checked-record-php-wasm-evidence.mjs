/**
 * Authenticate the immutable hosted PHP-Wasm dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	assertDependentCheckedRecordPhpWasmCompilerTap
	, checkDependentCheckedRecordPhpWasmCiRecords
} from "./dependent-checked-record-php-wasm-ci-report.mjs";
import {
	dependentCheckedRecordRoutes, dependentCheckedRecordSelection
} from "./dependent-checked-record-browser-fixture.mjs";
import {
	checkDependentCheckedRecordPhpWasmModel
} from "./dependent-checked-record-php-wasm-fixture.mjs";
import {
	dependentCheckedRecordPhpWasmEvidenceSources
} from "./dependent-checked-record-hosted-evidence-sources.mjs";
import {
	checkZeroPayloadHostedEvidenceArchive
} from "./zero-payload-checked-record-hosted-evidence.mjs";

export const dependentCheckedRecordPhpWasmEvidence
	= "docs/evidence/dependent-checked-record-php-wasm-20261021";
export const dependentCheckedRecordPhpWasmEvidenceSha256
	= "948cbee670d29c1ba97dc64ceb1771b7c74b0f23f7ba1d09091826939e455091";
const producer = "b869fb3f1cbf320c3cb453058f4a7bdf095a49c1";
const revisions = Object.freeze({
	producer, consumer: producer, checker: producer
	, archiver: "764e6a5443eb8d838d634c592aa8f88b6a2c9f3c"
});
const compilerPaths = dependentCheckedRecordRoutes.flatMap(route => [
	"adapters.lean", "generated.c", "model.json", "provider.c"
].map(name => ({
	path: `compiler/records/${route}/${name}`
	, artifact: `dependent-checked-record-php-wasm-ci/compiler/records/${route}/${name}`
})));
const contract = Object.freeze({
	evidence: dependentCheckedRecordPhpWasmEvidence
	, indexSha256: dependentCheckedRecordPhpWasmEvidenceSha256
	, indexKeys: [
		"archiveCommit", "checkerCommit", "compiler", "consumerCommit", "files"
		, "hostedRun", "kind", "limitations", "producerCommit", "runs"
		, "runtime", "schemaVersion", "selectedSources"
	]
	, kind: "dependent-checked-record-php-wasm-installed-v1"
	, limitationCount: 6, revisions
	, sources: dependentCheckedRecordPhpWasmEvidenceSources(revisions)
	, routes: dependentCheckedRecordRoutes
	, artifactRoot: "dependent-checked-record-php-wasm-ci"
	, retainedRoutePaths: ["run.tap", "check.log"]
	, retainedLogs: [
		{ path: "hosted/logs/host.log"
			, artifact: "dependent-checked-record-php-wasm-host.log" }
		, { path: "hosted/logs/runtime.log"
			, artifact: "dependent-checked-record-php-wasm-runtime.log" }
	]
	, retainedFiles: [
		{ path: "compiler/run.tap"
			, artifact: "dependent-checked-record-php-wasm-ci/compiler/run.tap" }
		, { path: "compiler/check.log"
			, artifact: "dependent-checked-record-php-wasm-ci/compiler/check.log" }
		, ...compilerPaths
		, { path: "hosted/runtime/runtime.json"
			, artifact: "dependent-checked-record-php-wasm-input/php-wasm-runtime/runtime.json" }
	]
	, workflow: ".github/workflows/dependent-checked-record-php-wasm.yml"
	, runId: 39857552688, jobId: 120100093905
	, artifactId: 12464147584, artifactBytes: 7796672
	, artifactSha256:
		"8182772e57122f2a8316021e8c46606fe5d64aff4d599ab114053e159a7d9f3f"
	, verifyIndex: async index => {
		assert.equal(index.runtime.schemaVersion, 1);
		assert.equal(index.runtime.profile, "php-wasm-copied-v1");
		assert.equal(index.runtime.pointerBits, 32);
		assert.equal(index.runtime.pins.phpVersion, "8.4.1");
		assert.equal(index.runtime.pins.emscriptenVersion, "3.1.68");
		assert.deepEqual(index.compiler.routes, dependentCheckedRecordRoutes);
		assert.equal(index.compiler.observations.length
			, dependentCheckedRecordRoutes.length);
		assert.match(index.compiler.tapSha256, /^[a-f0-9]{64}$/u);
		for(const [position, observation] of index.compiler.observations.entries())
		{
			const route = dependentCheckedRecordRoutes[position];
			assert.deepEqual(observation, {
				route, module: "DependentRecords"
				, exports: dependentCheckedRecordSelection(route).expected
					.declarations.length
				, pointerBits: 32, generatedCSha256: observation.generatedCSha256
				, sourceCompilationOnly: true, installedAcceptance: false
			});
			assert.match(observation.generatedCSha256, /^[a-f0-9]{64}$/u);
		}
	}
	, verifyRun: async ({ run, records, read, retained, tap }) => {
		assert.deepEqual(Object.keys(run).sort(), [
			"accepted", "recordCount", "resultOnly", "reviewed", "route"
			, "tapSha256", "verificationSha256"
		].sort());
		const checked = await checkDependentCheckedRecordPhpWasmCiRecords({
			route: run.route, producer: revisions.producer
			, directory: `/archive/${run.route}/records`
			, tap: `/archive/${run.route}/run.tap`
		}, { tap: tap.toString(), read });
		const verification = retained["check.log"];
		assert.equal(verification.toString(), canonicalJson(checked));
		const selection = dependentCheckedRecordSelection(run.route);
		assert.deepEqual(run, {
			route: run.route, reviewed: selection.reviewed
			, resultOnly: selection.resultOnly, recordCount: records.size
			, accepted: checked, tapSha256: sha256(tap)
			, verificationSha256: sha256(verification)
		});
		return checked;
	}
	, verifyRetainedFiles: async ({ index, files }) => {
		const tap = files["compiler/run.tap"];
		assertDependentCheckedRecordPhpWasmCompilerTap(tap.toString());
		assert.equal(sha256(tap), index.compiler.tapSha256);
		assert.equal(files["compiler/check.log"].toString()
			, "Four fresh-Lean dependent PHP-Wasm compiler tests passed without skips.\n");
		const observations = [...tap.toString().matchAll(/^# (\{.*\})$/gmu)]
			.map(match => JSON.parse(match[1]));
		assert.deepEqual(observations, index.compiler.observations);
		for(const [position, route] of dependentCheckedRecordRoutes.entries())
		{
			const prefix = `compiler/records/${route}/`;
			const modelBytes = files[prefix + "model.json"];
			const model = JSON.parse(modelBytes);
			assert.equal(modelBytes.toString(), canonicalJson(model), route);
			checkDependentCheckedRecordPhpWasmModel(model, route);
			assert.equal(sha256(files[prefix + "generated.c"])
				, observations[position].generatedCSha256, route);
			for(const name of ["adapters.lean", "provider.c"])
				assert.ok(files[prefix + name].length > 0, `${route}/${name}`);
		}
		const runtimeBytes = files["hosted/runtime/runtime.json"];
		assert.equal(runtimeBytes.toString(), canonicalJson(index.runtime));
	}
});
let cached;

/**
 * Verify every retained byte, PHP-Wasm route, compiler record and GitHub fact.
 *
 * @param read - Repository-relative archive byte reader.
 */
export const checkDependentCheckedRecordPhpWasmEvidence = async (
	read = readFile
) => {
	const checked = read === readFile
		? await (cached ??= checkZeroPayloadHostedEvidenceArchive(contract, readFile))
		: await checkZeroPayloadHostedEvidenceArchive(contract, read);
	return {
		...checked, ...revisions, runtime: checked.index.runtime
		, compiler: checked.index.compiler
		, supportPromoted: false, hostedAcceptance: true
	};
};
