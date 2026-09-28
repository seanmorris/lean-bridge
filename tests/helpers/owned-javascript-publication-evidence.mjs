/**
 * Require compiled, signed, relocated owned npm acceptance with bounded claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";

const sdk = "source scripts/env.sh\nLEAN_BRIDGE_OWNED_JS_WASM_BUILD_TEST=1 LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT=/app/build/lean-link-spike-owned-cancel-20260928 EMCC_CORES=2 ";
export const ownedJavaScriptPublicationCommands = Object.freeze({
	publication: sdk + "node --test --test-concurrency=1 tests/owned-javascript-publication.test.mjs"
	, cli: sdk + "node --test tests/owned-javascript-cli.test.mjs"
	, contracts: "node --test tests/component-reproducibility-gate.test.mjs tests/publication-attestation.test.mjs tests/release-receipt.test.mjs tests/owned-javascript-wasm-ci.test.mjs"
	, analyzer: "node --test tests/lean-project-analyzer.test.mjs"
	, copied: "source scripts/env.sh\nnode --test --test-name-pattern='^ordinary component evidence signs' tests/component-publication.test.mjs"
});
export const ownedJavaScriptPublicationScope = Object.freeze({
	ordinaryAndReviewed: true, independentCleanBuilds: true
	, signedPublication: true, standaloneArchiveVerification: true
	, installedNode: true, producerRemoved: true
	, registryTransport: "in-memory", externalRegistryWrites: false
	, injectedReviewedEngineTransport: true
	, nixIsolation: false, dockerIsolation: false, installedSupportPromotions: 0
});

/**
 * Require complete execution logs and concrete installed/signed observations.
 *
 * @param record - Source-bound publication receipt.
 */
export const assertOwnedJavaScriptPublicationExecution = record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedJavaScriptPublicationScope);
	assert.deepEqual(Object.keys(record.runs).sort(), Object.keys(ownedJavaScriptPublicationCommands).sort());
	for(const [name, tests] of [["publication", 3], ["cli", 3], ["contracts", 17], ["analyzer", 15], ["copied", 11]])
	{
		const run = record.runs[name]; assert.equal(run.command, ownedJavaScriptPublicationCommands[name]);
		assert.equal(run.exitCode, 0); assert.equal(sha256(run.text), run.sha256);
		for(const [key, count] of Object.entries({ tests, pass: tests, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
			assert.match(run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
		assert.doesNotMatch(run.text, /^not ok|# SKIP|# TODO/mu);
	}
	const reports = [...record.runs.publication.text.matchAll(/^# (\{[^\n]+)\n/gmu)].map(match => JSON.parse(match[1]));
	assert.deepEqual(reports, [...[false, true].map(reviewed => ({ reviewed
		, cleanBuilds: 2, engineInvocations: reviewed ? 2 : 0
		, injectedTransport: reviewed, actualIsolation: false
		, signedPublication: true, idempotentWrites: 1, standaloneVerification: true
		, installedNode: true, producerRemoved: true, rejectedMutations: 8 }))
	, { unlicensed: true, compiled: true, publicationRejected: true, registryWrites: 0 }]);
	assert.match(record.runs.copied.text, /ordinary component evidence signs, publishes, resumes, and rejects byte or destination drift/u);
	assert.match(record.runs.analyzer.text, /the published analysis schema closes the report and adapter questions/u);
	const cli = [...record.runs.cli.text.matchAll(/^# (\{[^\n]+)\n/gmu)].map(match => JSON.parse(match[1]));
	assert.equal(cli.length, 1); assert.match(cli[0].compilerInputsIdentity, /^[a-f0-9]{64}$/u);
	assert.deepEqual(cli[0].reports, [false, true].map(reviewed => ({ reviewed
		, component: "@owned/" + (reviewed ? "reviewed" : "ordinary")
		, sourceRemoved: true, installedCli: true, installedConsumer: true
		, combinedNative: reviewed })));
};
