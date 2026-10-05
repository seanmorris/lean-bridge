/**
 * Sanitized synthetic conversion failures do not count as installed Lean evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { renderWitConversions, witConversionPrelude } from "../src/backends/wit/copied-conversions.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { snapshotWasmtimeCapi } from "../src/build/native-wit-projection.mjs";
import { witCompoundFaultIr, witCompoundFaultSource } from "./helpers/wit-compound-faults.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("WIT compound conversions release partial values and scratch after injected failures", { skip: process.env.LEAN_BRIDGE_WIT_COMPOUND_TEST !== "1", timeout: 120_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-compound-conversions-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const sdk = join(root, "wasmtime"), environment = nativeFixtureEnvironment(["wit-wasi"]);
	await snapshotWasmtimeCapi(environment.LEAN_BRIDGE_WASMTIME_C_API, sdk);
	const ir = witCompoundFaultIr(), model = compileCopiedWitModel(ir), source = witCompoundFaultSource(model);
	const conversions = witConversionPrelude + renderWitConversions(model), header = generateCBindingPackage(ir)["include/probe.h"];
	await saveLakeFile(root, "probe.h", header);
	await saveLakeFile(root, "conversions.h", conversions);
	await saveLakeFile(root, "probe.c", source);
	const compilerOptions = ["-std=c11", "-g", "-O1", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "-fsanitize=address,undefined", "-fno-omit-frame-pointer", "-fno-pie", "-no-pie"];
	await runCopied("cc", [...compilerOptions, "-I", join(sdk, "include"), "probe.c", "-L", join(sdk, "lib"), `-Wl,-rpath,${join(sdk, "lib")}`, "-lwasmtime", "-o", "probe"], root, environment);
	const result = await runCopied(join(root, "probe"), [], root, { PATH: "/unavailable", ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1", UBSAN_OPTIONS: "halt_on_error=1" });
	assert.equal(result.stderr, "");
	const observation = JSON.parse(result.stdout);
	assert.equal(observation.scratchFailures, 4); assert.equal(observation.malformedOutputs, 8);
	assert.equal(observation.inactivePayloads, 3); assert.equal(observation.liveAllocations, 0);
	assert.ok(observation.budgetFailures > 500);
	t.diagnostic(JSON.stringify(observation));
	const report = { schemaVersion: 1, synthetic: true, compilerOptions
		, sanitizers: ["address", "undefined", "leak"]
		, sourceSha256: sha256(source), conversionsSha256: sha256(conversions)
		, headerSha256: sha256(header)
		, executableSha256: sha256(await readFile(join(root, "probe")))
		, observation };
	const output = resolve("build/compounds/wit-conversions.json");
	await saveLakeFile(dirname(output), output.split("/").at(-1), canonicalJson(report));
});
