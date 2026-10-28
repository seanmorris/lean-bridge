/**
 * Compiler-free controls for WIT/WASI direct proof erasure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileWitPackageModel } from "../../src/backends/wit/generate.mjs";
import { renderWitHostHeader } from "../../src/backends/wit/copied-host.mjs";
import { directProofErasureReview } from "./direct-proof-erasure-fixture.mjs";

const forbidden = /(?:\bTrue\b|\bproof\b|_before|_after)/iu;
const callerForbidden = /(?:True\.intro|_before|_after)/u;

test("WIT direct proof API exposes one word and no proof slot", () => {
	const model = compileWitPackageModel(directProofErasureReview());
	assert.ok(model.copied);
	assert.equal((model.wit.match(/keep: func\(value: u32\) -> u32;/gu)
		?? []).length, 2);
	assert.doesNotMatch(model.wit, forbidden);
	assert.deepEqual(model.manifest.declarations, [{
		id: "lean:DirectProofErasure.keep", witName: "keep"
	}]);
	assert.equal(model.copied.surface.functions.length, 1);
	assert.equal(model.copied.surface.functions[0].parameters.length, 1);
	const header = renderWitHostHeader(model.copied);
	assert.match(header
		, /directprooferasure_wasmtime_call\([\s\S]*?const wasmtime_component_val_t \*args, size_t count,[\s\S]*?wasmtime_component_val_t \*out\);/u);
	assert.doesNotMatch(header, forbidden);
});

test("WIT direct proof caller supplies one payload and the negative probe supplies three", async () => {
	const source = await readFile(
		"tests/fixtures/direct-proof-erasure-consumers/wit-wasi.c", "utf8"
	);
	assert.match(source
		, /directprooferasure_wasmtime_call\([\s\S]*?session, "keep", &input, 1, &output\)/u);
	assert.match(source, /direct-proof-wit-wasi:%u/u);
	assert.doesNotMatch(source, callerForbidden);
	const installed = await readFile(
		"tests/direct-proof-erasure-wit-installed.test.mjs", "utf8"
	);
	assert.match(installed, /wasmtime_component_val_t args\[3\]/u);
	assert.match(installed
		, /directprooferasure_wasmtime_call\([\s\S]*?session, "keep", args, 3, &output\)/u);
	assert.match(installed
		, /Unknown export, invalid WIT input or 16 MiB conversion limit/u);
});

test("WIT direct proof runner owns both routes and retained verification", async () => {
	const source = await readFile(
		"scripts/run-direct-proof-erasure-wit-ci.sh", "utf8"
	);
	for(const required of [
		"LEAN_BRIDGE_DIRECT_PROOF_WIT_TEST=1"
		, "LEAN_BRIDGE_DIRECT_PROOF_WIT_ROUTES"
		, "LEAN_BRIDGE_DIRECT_PROOF_WIT_OUTPUT"
		, "for route in ordinary reviewed"
		, "check-direct-proof-erasure-wit-ci.mjs"
	]) assert.ok(source.includes(required), required);
	assert.doesNotMatch(source, /continue-on-error/u);
	const workflow = await readFile(
		".github/workflows/consumer-matrix.yml", "utf8"
	);
	for(const required of [
		"id: direct_proof_wit"
		, "bash scripts/run-direct-proof-erasure-wit-ci.sh"
		, "name: direct-proof-erasure-wit-${{ github.sha }}"
		, "steps.direct_proof_wit.outcome != 'success'"
	]) assert.ok(workflow.includes(required), required);
});
