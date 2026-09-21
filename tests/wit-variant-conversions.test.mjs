/**
 * Sanitized branch and ownership probes, separate from installed Lean evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { renderWitConversions, witConversionPrelude } from "../src/backends/wit/copied-conversions.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { snapshotWasmtimeCapi } from "../src/build/native-wit-projection.mjs";
import { witVariantReviewedIr } from "./helpers/wit-variant-fixture.mjs";
import { witVariantFaultSource } from "./helpers/wit-variant-faults.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("WIT variants release partial selected values on conversion failures", { skip: process.env.LEAN_BRIDGE_WIT_VARIANT_TEST !== "1", timeout: 180_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-variant-conversions-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const sdk = join(root, "wasmtime"), environment = nativeFixtureEnvironment(["wit-wasi"]);
	await snapshotWasmtimeCapi(environment.LEAN_BRIDGE_WASMTIME_C_API, sdk);
	const ir = witVariantReviewedIr(), model = compileCopiedWitModel(ir), source = await witVariantFaultSource(model);
	const conversions = witConversionPrelude + renderWitConversions(model), header = generateCBindingPackage(ir)["include/variants.h"];
	await saveLakeFile(root, "variants.h", header); await saveLakeFile(root, "conversions.h", conversions); await saveLakeFile(root, "probe.c", source);
	const compilerOptions = ["-std=c11", "-g", "-O1", "-Wall", "-Wextra", "-Werror", "-Wno-unused-function", "-UNDEBUG", "-fsanitize=address,undefined", "-fno-omit-frame-pointer", "-fno-pie", "-no-pie"];
	await runCopied("cc", [...compilerOptions, "-I", join(sdk, "include"), "probe.c", "-L", join(sdk, "lib"), `-Wl,-rpath,${join(sdk, "lib")}`, "-lwasmtime", "-o", "probe"], root, environment);
	const result = await runCopied(join(root, "probe"), [], root, { PATH: "/unavailable", ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1", UBSAN_OPTIONS: "halt_on_error=1" });
	assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
	assert.ok(observation.scratchFailures > 5); assert.equal(observation.malformedOutputs, 19);
	assert.equal(observation.inactivePayloads, 22); assert.equal(observation.liveAllocations, 0);
	assert.ok(observation.inputBudgetFailures > 1000); assert.ok(observation.outputBudgetFailures > 1000);
	t.diagnostic(JSON.stringify(observation));
	await saveLakeFile("build/variants", "wit-conversions.json", canonicalJson({ schemaVersion: 1
		, synthetic: true, compilerOptions
		, sanitizers: ["address", "undefined", "leak"]
		, sourceSha256: sha256(source), conversionsSha256: sha256(conversions)
		, headerSha256: sha256(header)
		, executableSha256: sha256(await readFile(join(root, "probe")))
		, observation }));
});
