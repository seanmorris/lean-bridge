/**
 * Native WIT callback reply ownership, sanitizer and allocation-failure checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { renderWitHostHeader, renderWitHostSource } from "../src/backends/wit/copied-host.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { brokerHeader } from "../src/backends/native/runtime-broker.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { witStructuredFaultProbe } from "./helpers/wit-structured-callable-faults.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("structured WIT callback arenas clear at every failure and retain sibling buffers", { skip: process.env.LEAN_BRIDGE_WIT_STRUCTURED_CALLABLE_TEST !== "1", timeout: 180_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-structured-faults-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = structuredCallableReviewedIr(), model = compileCopiedWitModel(ir, {}, { callables: true });
	const files = generateCBindingPackage(ir);
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
	await saveLakeFile(root, "include/structured_wasmtime.h", renderWitHostHeader(model));
	await saveLakeFile(root, "include/lean_bridge_native_runtime.h", brokerHeader);
	const source = renderWitHostSource(model, new Uint8Array([0]));
	await saveLakeFile(root, "host.c", source);
	const consumer = await witStructuredFaultProbe(model);
	await saveLakeFile(root, "probe.c", consumer);
	const sdk = resolve(process.env.LEAN_BRIDGE_WASMTIME_C_API ?? ".toolchains/wasmtime42");
	const flags = ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG"
		, "-pthread", "-g", "-O1", "-ffunction-sections", "-fdata-sections"
		, "-Wl,--gc-sections", "-I", join(root, "include")
		, "-I", join(root, "internal"), "-I", join(sdk, "include"), "probe.c"
		, ...Object.keys(files).filter(path => path.endsWith(".c"))
		, "-L", join(sdk, "lib"), `-Wl,-rpath,${join(sdk, "lib")}`, "-lwasmtime"];
	await runCopied("cc", [...flags, "-o", "probe"], root, process.env);
	const observation = JSON.parse((await runCopied(join(root, "probe"), [], root, process.env)).stdout);
	assert.equal(observation.live, 0); assert.ok(observation.injected > 100); t.diagnostic(JSON.stringify(observation));
	await runCopied("cc", [...flags, "-fsanitize=address,undefined", "-fno-omit-frame-pointer", "-o", "sanitized"], root, process.env);
	const sanitized = JSON.parse((await runCopied(join(root, "sanitized"), [], root, { ...process.env, ASAN_OPTIONS: "detect_leaks=1:abort_on_error=1" })).stdout);
	assert.deepEqual(sanitized, observation);
	for(const [name, mutant] of [
		["missing-reference", source.replace("++owner->references; value->owner", "value->owner")]
		, ["retained-construction-reference", source.replaceAll(/(lb_result_attach_\d+\(&converted, owner\)); lb_shared_result_release\(owner\);/gu, "$1;")]
	]) {
		assert.notEqual(mutant, source); await saveLakeFile(root, "host.c", mutant);
		await runCopied("cc", [...flags, "-fsanitize=address,undefined", "-fno-omit-frame-pointer", "-o", name], root, process.env);
		await assert.rejects(runCopied(join(root, name), [], root, { ...process.env, ASAN_OPTIONS: "detect_leaks=1:abort_on_error=1" })
			, name === "missing-reference" ? /heap-use-after-free/u : /live == baseline/u, name);
	}
	await saveLakeFile("build/structured-callables", "wit-faults.json", canonicalJson({ schemaVersion: 1
		, sourceSha256: sha256(source)
		, consumerSha256: sha256(consumer)
		, normal: observation, sanitized
		, missingReferenceRejected: true
		, retainedConstructionReferenceRejected: true }));
});
