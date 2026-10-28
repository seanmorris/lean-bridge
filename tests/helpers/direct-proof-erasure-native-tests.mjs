/**
 * Compiler-free controls for the direct proof-erasure native package lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createNativeModel } from "../../src/build/native-model.mjs";
import { generateCopiedNativeCalls } from "../../src/backends/c/native-copied-values.mjs";
import { generateCBindingPackage } from "../../src/backends/c/generate.mjs";
import { compilePrimitiveCSurface } from "../../src/backends/c/primitive-surface.mjs";
import { generateCppBindingPackage } from "../../src/backends/cpp/generate.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { directProofErasureReview } from "./direct-proof-erasure-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { nativeMetadataFixture } from "./native-metadata.mjs";

const invalid = {
	c: `#include "directprooferasure.h"
int main(void) {
  uint32_t output = 0;
  directprooferasure_error error = {0};
  return (int)directprooferasure_keep(true, 0, &output, &error);
}
`
	, cpp: `#include "directprooferasure.hpp"
namespace api = lean_bridge::directprooferasure;
int main() { return (int)api::keep(true, 0); }
`
};

test("native direct proof callers expose one word and refuse proof arguments", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-direct-proof-native-static-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = directProofErasureReview();
	const files = { ...generateCBindingPackage(ir), ...generateCppBindingPackage(ir) };
	for(const [path, source] of Object.entries(files))
		await saveLakeFile(root, path, source);
	const headers = {
		c: files["include/directprooferasure.h"]
		, cpp: files["include/directprooferasure.hpp"]
	};
	const model = structuredClone(createNativeModel({
		...nativeMetadataFixture()
		, component: { id: "directprooferasure@1.0.0"
			, name: "directprooferasure", version: "1.0.0" }
	}));
	model.bindingIr = ir;
	model.exports[0].name = "DirectProofErasure.keep";
	const provider = generateCopiedNativeCalls(
		model, compilePrimitiveCSurface(model.bindingIr));
	assert.match(headers.c
		, /directprooferasure_status directprooferasure_keep\(uint32_t value, uint32_t \*out, directprooferasure_error \*error\);/u);
	assert.match(headers.cpp, /inline uint32_t keep\(uint32_t value\)/u);
	assert.match(provider
		, /uint32_t _lb_value = lb_[a-f0-9]+\(lb_copy_0_in\(&value\)\);/u);
	assert.match(provider
		, /int _lb_status = lb_copy_0_out\(_lb_value, &_lb_result, &_lb_budget\);/u);
	assert.doesNotMatch(provider, /uint32_t value = lb_[a-f0-9]+/u);
	for(const header of Object.values(headers))
		assert.doesNotMatch(header, /(?:\bTrue\b|\bproof\b|_before|_after)/iu);
	for(const profile of ["c", "cpp"])
	{
		const source = await readFile(
			`tests/fixtures/direct-proof-erasure-consumers/${profile}.${profile}`
		);
		await saveLakeFile(root, `consumer.${profile}`, source);
		await runCopied(profile === "c" ? "/usr/bin/cc" : "/usr/bin/c++", [
			`-std=${profile === "c" ? "c11" : "c++20"}`
			, "-Wall", "-Wextra", "-Werror", "-fsyntax-only"
			, "-I", "include", `consumer.${profile}`
		], root, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
		await saveLakeFile(root, `invalid.${profile}`, invalid[profile]);
		await assert.rejects(runCopied(
			profile === "c" ? "/usr/bin/cc" : "/usr/bin/c++"
			, [`-std=${profile === "c" ? "c11" : "c++20"}`
				, "-Wall", "-Wextra", "-Werror", "-fsyntax-only"
				, "-I", "include", `invalid.${profile}`]
			, root, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" }
		), error => /(?:too many arguments|no matching function|requires 1 argument|candidate)/iu
			.test(error.details?.stderr ?? ""));
	}
});

test("native direct proof runner owns both routes and retained verification", async () => {
	const source = await readFile("scripts/run-direct-proof-erasure-native-ci.sh", "utf8");
	for(const required of [
		"LEAN_BRIDGE_DIRECT_PROOF_NATIVE_TEST=1"
		, "LEAN_BRIDGE_DIRECT_PROOF_NATIVE_ROUTES"
		, "LEAN_BRIDGE_DIRECT_PROOF_NATIVE_OUTPUT"
		, "for route in ordinary reviewed"
		, "check-direct-proof-erasure-native-ci.mjs"
	]) assert.ok(source.includes(required), required);
	assert.doesNotMatch(source, /continue-on-error/u);
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const nativeStart = workflow.indexOf("\n  native-consumers:");
	const nativeJob = workflow.slice(nativeStart
		, workflow.indexOf("\n  managed-consumers:", nativeStart));
	assert.ok(nativeStart >= 0);
	assert.ok(nativeJob.indexOf("Free hosted runner disk before native builds")
		< nativeJob.indexOf("Check out the exact revision"));
	assert.match(nativeJob
		, /sudo rm -rf \/usr\/share\/dotnet .*\/opt\/hostedtoolcache\/CodeQL/u);
	for(const required of [
		"id: direct_proof_native"
		, "bash scripts/run-direct-proof-erasure-native-ci.sh"
		, "name: direct-proof-erasure-native-${{ github.sha }}"
		, "steps.direct_proof_native.outcome != 'success'"
	]) assert.ok(workflow.includes(required), required);
});
