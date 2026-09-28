/**
 * Require real compiler analysis, independently compiled API parity and repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedJavaScriptWasmCi, ownedAnalysisTestCommand } from "./owned-javascript-wasm-ci.mjs";

export const ownedAnalysisScope = Object.freeze({
	sourcePaths: ["ordinary-source", "reviewed-ir"], compilerOnly: true
	, relocatedCli: true, exportsPerSourcePath: 51, compiledWasmParity: true
	, injectedProcessTransport: true, testedNixDockerIsolation: false
	, signedPublication: false, transferredInputs: false, anchoredResults: false
	, promotedCells: 0
});
export const ownedAnalysisCommands = Object.freeze({
	execution: "LEAN_BRIDGE_COMPILER_ANALYSIS_TEST=1 LEAN_BRIDGE_OWNED_JS_WASM_BUILD_TEST=1 EMCC_CORES=2 " + ownedAnalysisTestCommand
	, regressions: "LEAN_BRIDGE_COMPILER_ANALYSIS_TEST=1 LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 LEAN_BRIDGE_REVIEWED_SOURCE_TEST=1 node --test --test-concurrency=2 tests/compiler-analysis.test.mjs tests/elaborated-metadata.test.mjs tests/lake-entry-modules.test.mjs tests/reviewed-source-build.test.mjs"
	, ci: "node --test tests/owned-javascript-wasm-ci.test.mjs tests/owned-php-wasm-ci.test.mjs"
	, cleanup: "node --test tests/word-contract.test.mjs tests/component-char-contract.test.mjs tests/component-runtime.test.mjs tests/component-scalar-codec.test.mjs"
});
const assertRun = (run, command, tests, pass, fail) => {
	assert.equal(run.command, command); assert.equal(run.exitCode, fail ? 1 : 0);
	assert.equal(sha256(run.text), run.sha256);
	for(const [key, value] of Object.entries({ tests, pass, fail, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
	assert.doesNotMatch(run.text, /# SKIP|# TODO/u);
	if(!fail) assert.doesNotMatch(run.text, /^not ok/mu);
};

/**
 * Validate actual compiler observations and the original failing checks.
 *
 * @param record - Immutable source-bound milestone receipt.
 */
export const assertOwnedAnalysisExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedAnalysisScope);
	assert.deepEqual(Object.keys(record.runs).sort(), Object.keys(ownedAnalysisCommands).sort());
	for(const [name, tests] of [["execution", 7], ["regressions", 46], ["ci", 4], ["cleanup", 32]])
		assertRun(record.runs[name], ownedAnalysisCommands[name], tests, tests, 0);
	assertRun(record.repair.analysis, "LEAN_BRIDGE_COMPILER_ANALYSIS_TEST=1 node --test --test-concurrency=1 tests/owned-compiler-analysis.test.mjs", 4, 0, 4);
	assert.match(record.repair.analysis.text, /Explicit aggregate ownership requires the ownership-aware semantic model/u);
	assert.match(record.repair.analysis.text, /consumer-upgrade-required/u);
	assertRun(record.repair.word, "node --test tests/word-contract.test.mjs", 6, 5, 1);
	assert.match(record.repair.word.text, /word wire results require canonical width and flags and always release the frame/u);
	const observations = [...record.runs.execution.text.matchAll(/^# (\{[^\n]+)\n/gmu)].map(match => JSON.parse(match[1]));
	assert.equal(observations.length, 4);
	const parity = observations.filter(item => item.relocatedCli);
	const analysis = observations.filter(item => item.compilerOnly);
	assert.deepEqual(parity.map(item => item.reviewed), [false, true]);
	assert.deepEqual(analysis.map(item => item.reviewed), [false, true]);
	for(const item of parity)
	{
		assert.deepEqual(Object.keys(item).sort(), ["reviewed", "relocatedCli", "producerRemoved", "analyzerAdaptersCompiled", "buildProfile", "exports", "sourceApiSha256"].sort());
		assert.equal(item.producerRemoved, true); assert.equal(item.analyzerAdaptersCompiled, false);
		assert.equal(item.buildProfile, "javascript-wasm-owned-v1"); assert.equal(item.exports, 51);
		assert.match(item.sourceApiSha256, /^[a-f0-9]{64}$/u);
	}
	for(const item of analysis) assert.deepEqual(item, {
		reviewed: item.reviewed, exports: 51
		, compilerOnly: true, relocated: true, authenticatedMutationRejections: 11 });
	assertOwnedJavaScriptWasmCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
};
