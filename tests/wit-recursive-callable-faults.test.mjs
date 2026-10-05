/**
 * Allocation-failure and sanitizer checks at the recursive WIT callback boundary.
 * Synthetic native stubs never count as installed Lean execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCallableWitGraphModel } from "../src/backends/wit/callable-graph-model.mjs";
import { renderWitGraphCallableHostHeader, renderWitGraphCallableHostSource } from "../src/backends/wit/callable-graph-host.mjs";
import { generateNativeCallableGraphCalls } from "../src/backends/c/native-callable-graph-calls.mjs";
import { brokerHeader } from "../src/backends/native/runtime-broker.mjs";
import { nativeRecursiveCallableReviewedIr } from "./helpers/native-recursive-callable-fixture.mjs";
import { witRecursiveCallableFaults } from "./helpers/wit-recursive-callable-faults.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("recursive WIT callback arenas release every failed allocation and preserve reply owners", {
	skip: process.env.LEAN_BRIDGE_WIT_RECURSIVE_CALLABLE_FAULT_TEST !== "1"
	, timeout: 600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-recursive-faults-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = nativeRecursiveCallableReviewedIr(), model = compileCallableWitGraphModel(ir);
	const native = generateNativeCallableGraphCalls(ir, model.native.descriptor, { initializer: "initialize_LeanBridgeNative0000000000000000" });
	await saveLakeFile(root, `${model.prefix}-graph.h`, native.header + `\nuint32_t ${model.prefix}_graph_initialize(void);\nint ${model.prefix}_graph_ready(void);\n`);
	await saveLakeFile(root, `${model.prefix}-graph-types.h`, native.typesHeader);
	await saveLakeFile(root, `${model.prefix}-callable-borrows.h`, native.borrowsHeader);
	await saveLakeFile(root, "lean_bridge_native_runtime.h", brokerHeader);
	await saveLakeFile(root, `${model.prefix}_wasmtime.h`, renderWitGraphCallableHostHeader(model));
	const host = renderWitGraphCallableHostSource(model, new Uint8Array([0])), probe = witRecursiveCallableFaults(model);
	await saveLakeFile(root, "host.c", host); await saveLakeFile(root, "probe.c", probe);
	const sdk = resolve(process.env.LEAN_BRIDGE_WASMTIME_C_API ?? ".toolchains/wasmtime42");
	const flags = ["-std=c11", "-O1", "-g", "-Wall", "-Wextra", "-Werror"
		, "-UNDEBUG"
		, "-pthread", "-ffunction-sections", "-fdata-sections", "-Wl,--gc-sections"
		, "-I", root, "-I", join(sdk, "include"), "probe.c"
		, "-L", join(sdk, "lib"), `-Wl,-rpath,${join(sdk, "lib")}`, "-lwasmtime"];
	await runCopied("cc", [...flags, "-o", "probe"], root, process.env);
	const normal = await runCopied(join(root, "probe"), [], root, process.env);
	assert.equal(normal.stderr, ""); const observed = JSON.parse(normal.stdout);
	assert.equal(observed.live, 0); assert.equal(observed.retired, 0);
	assert.ok(observed.injected > 1000); t.diagnostic(JSON.stringify(observed));
	const sanitizers = ["-fsanitize=address,undefined", "-fno-omit-frame-pointer", "-fno-sanitize-recover=all", "-no-pie"];
	const environment = { ...process.env, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1", UBSAN_OPTIONS: "halt_on_error=1" };
	await runCopied("cc", [...flags, ...sanitizers, "-o", "sanitized"], root, process.env);
	const sanitized = await runCopied(join(root, "sanitized"), [], root, environment);
	assert.equal(sanitized.stderr, ""); assert.deepEqual(JSON.parse(sanitized.stdout), observed);
	const mutants = [];
	for(const [name, source, pattern] of [
		["premature-reply-release", host.replaceAll("converted._bridge_owner = owner;", "lb_scope_close(&owner->scope); converted._bridge_owner = owner;"), /heap-use-after-free/]
		, ["missing-reply-owner", host.replaceAll("converted._bridge_owner = owner;", "converted._bridge_owner = NULL;"), /!live && !sample_live/]
	]) {
		assert.notEqual(source, host); await saveLakeFile(root, "host.c", source);
		await runCopied("cc", [...flags, ...sanitizers, "-o", name], root, process.env);
		await assert.rejects(runCopied(join(root, name), [], root, environment), error => {
			assert.equal(error.code, "build-command-failed"); assert.match(error.details.stderr, pattern);
			mutants.push({ name, sourceSha256: sha256(source)
				, stderr: error.details.stderr.replaceAll(root, "<probe>")
				, stdout: error.details.stdout });
			return true;
		});
	}
	await saveLakeFile("build/recursive-callables", "wit-faults.json", canonicalJson({ schemaVersion: 1
		, compiledLean: false, installedPackage: false
		, hostSha256: sha256(host), probeSha256: sha256(probe)
		, observed, sanitized: JSON.parse(sanitized.stdout)
		, diagnostics: { normal: normal.stderr, sanitized: sanitized.stderr }
		, sanitizerFlags: sanitizers
		, sanitizerEnvironment: { ASAN_OPTIONS: environment.ASAN_OPTIONS, UBSAN_OPTIONS: environment.UBSAN_OPTIONS }
		, mutants
		, prematureReplyReleaseRejected: true, missingReplyOwnerRejected: true }));
});
