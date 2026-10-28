/**
 * Compiler-free controls for the managed direct proof-erasure package lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateDotnetBindingPackage } from "../../src/backends/dotnet/generate.mjs";
import { generateJvmBindingPackage } from "../../src/backends/jvm/generate.mjs";
import { directProofErasureReview } from "./direct-proof-erasure-fixture.mjs";

test("managed direct proof APIs expose one word and no proof slot", () => {
	const ir = directProofErasureReview();
	const dotnet = generateDotnetBindingPackage(ir);
	const jvm = generateJvmBindingPackage(ir);
	const sources = {
		dotnet: dotnet["src/LeanBridge.Directprooferasure/Api.cs"]
		, java: jvm["src/main/java/org/leanbridge/directprooferasure/Api.java"]
		, kotlin: jvm[
			"src/main/kotlin/org/leanbridge/directprooferasure/kotlin/Api.kt"
		]
	};
	assert.match(sources.dotnet
		, /public static uint Keep\(uint @value\) => Interop\.Runtime\.Call0\(@value\);/u);
	assert.match(sources.java
		, /public static long keep\(long arg0\) \{ return Runtime\.call0\(arg0\); \}/u);
	assert.match(sources.kotlin
		, /fun `keep`\(arg0: kotlin\.Long\): kotlin\.Long/u);
	for(const source of Object.values(sources))
		assert.doesNotMatch(source, /(?:\bTrue\b|\bproof\b|_before|_after)/iu);
});

test("managed direct proof callers retain the payload and omit proof values", async () => {
	const sources = [];
	for(const path of ["dotnet.cs", "java.java", "kotlin.kt"])
		sources.push(await readFile(
			`tests/fixtures/direct-proof-erasure-consumers/${path}`, "utf8"));
	for(const source of sources)
	{
		assert.match(source, /1005/u);
		assert.doesNotMatch(source, /(?:_before|_after|True\.intro)/u);
	}
	assert.match(sources[0], /Api\.Keep\(value\) != value/u);
	assert.match(sources[1], /Api\.keep\(value\) != value/u);
	assert.match(sources[2], /Api\.keep\(value\.toLong\(\)\) == value\.toLong\(\)/u);
});

test("managed direct proof runner owns routes, groups and retained verification", async () => {
	const source = await readFile(
		"scripts/run-direct-proof-erasure-managed-ci.sh", "utf8"
	);
	for(const required of [
		"<dotnet|jvm>", "LEAN_BRIDGE_DIRECT_PROOF_MANAGED_TEST=1"
		, "LEAN_BRIDGE_DIRECT_PROOF_MANAGED_GROUP"
		, "LEAN_BRIDGE_DIRECT_PROOF_MANAGED_ROUTES"
		, "LEAN_BRIDGE_DIRECT_PROOF_MANAGED_OUTPUT"
		, "for route in ordinary reviewed"
		, "check-direct-proof-erasure-managed-ci.mjs"
	]) assert.ok(source.includes(required), required);
	assert.doesNotMatch(source, /continue-on-error/u);
	const workflow = await readFile(
		".github/workflows/consumer-matrix.yml", "utf8"
	);
	for(const required of [
		"id: direct_proof_managed"
		, "bash scripts/run-direct-proof-erasure-managed-ci.sh \"${{ matrix.profile }}\""
		, "name: direct-proof-erasure-managed-${{ matrix.profile }}-${{ github.sha }}"
		, "steps.direct_proof_managed.outcome != 'success'"
	]) assert.ok(workflow.includes(required), required);
});
