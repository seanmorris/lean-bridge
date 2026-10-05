/**
 * Execute methods and properties through real Wasmtime calls into compiled Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedWitGraphModel } from "../src/backends/wit/owned-graph-model.mjs";
import { generateOwnedWitPackage } from "../src/backends/wit/owned-package.mjs";
import { createCompiledNativeModel } from "../src/build/native-graph-model.mjs";
import { snapshotWasmtimeCapi } from "../src/build/native-wit-projection.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource } from "./helpers/owned-rust-receiver-fixture.mjs";
import { ownedReceiverCopyMacros } from "./helpers/owned-receiver-fixture.mjs";
import { ownedReceiverMutants } from "./helpers/owned-receiver-mutants.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { ownedWitReceiverProbe } from "./helpers/wit-owned-receiver-probe.mjs";
import { ownedWitBorrowNativeSource } from "./helpers/wit-owned-borrow-probe.mjs";
import { rejectOwnedWitBorrowMutants } from "./helpers/wit-owned-borrow-mutants.mjs";

for(const mode of ["ordinary", "reviewed"]) test(`WIT receiver lifetimes execute through compiled Lean (${mode})`, {
	skip: process.env.LEAN_BRIDGE_WIT_OWNED_RECEIVER_TEST !== "1", timeout: 1800000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await ownedRustReceiverConfiguration() }
			: { reviewedIr: ownedRustReceiverReviewedIr() }
		, hostCallbacks: true, sourceSuffix: ownedRustReceiverSource
		, evidenceName: `wit-receivers-${mode}-inputs.json`
	});
	const capabilities = { transferredInputs: true, anchoredResults: true, receiverExports: true };
	const model = compileOwnedWitGraphModel(compiled.model.bindingIr, {}, capabilities);
	assert.equal(model.layout.functions.length, 27);
	assert.equal(model.manifest.graph.resultAnchors.length, 20);
	assert.equal(model.manifest.graph.receiverExports.length, 16);
	await saveLakeFile(compiled.directory, "component.wat", model.wat);
	await saveLakeFile(compiled.directory, "component.wit", model.wit);
	for(const args of [["parse", "component.wat", "-o", "component.wasm"]
		, ["validate", "component.wasm"]
		, ["component", "wit", "component.wit", "--json"]
		, ["component", "wit", "component.wasm", "--json"]])
		await runCopied("wasm-tools", args, compiled.directory, process.env);
	const component = await readFile(join(compiled.directory, "component.wasm"));
	const input = { metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true, ...capabilities };
	const native = createCompiledNativeModel(input, { ownedGraphs: true
		, ownedHostCallbacks: true, ownedInputTransfers: true
		, ownedAnchoredResults: true, ownedReceiverExports: true });
	assert.equal(native.schemaVersion, 10);
	assert.equal(native.ownedGraph.receiverExports.exports.length, 16);
	const generated = generateOwnedWitPackage(input, component);
	assert.equal(generated.carriers.leanSource, compiled.leanSource);
	assert.deepEqual(generated.model.layout, model.layout);
	const sdk = join(compiled.directory, "wasmtime");
	await snapshotWasmtimeCapi(process.env.LEAN_BRIDGE_WASMTIME_C_API ?? resolve(".toolchains/wasmtime42"), sdk);
	const implementation = ownedWitBorrowNativeSource(generated);
	for(const [path, source] of Object.entries(generated.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	await saveLakeFile(compiled.directory, "borrow-copies.h", ownedReceiverCopyMacros(generated.values));
	const source = await ownedWitReceiverProbe(generated);
	for(const fn of generated.values.functions.filter(item => item.receiver === 0))
		assert.match(source, new RegExp(`\\b${fn.cName}\\b`, "u"), fn.name);
	const extra = ["public-api.c", "-lgmp", "-I", join(sdk, "include"), "-L", join(sdk, "lib"), `-Wl,-rpath,${join(sdk, "lib")}`, "-lwasmtime"];
	const normal = await (await compiled.compile(`wit-${mode}-receivers`, source, false, extra))();
	assert.equal(normal.stderr, "");
	const [result, counts] = normal.stdout.trim().split("\n").map(line => JSON.parse(line));
	assert.ok(result.checks > 1000 && result.failures > 0);
	assert.ok(result.beforeFailures > 0 && result.afterFailures > 0);
	assert.equal(result.live, 0); assert.equal(result.identities, 0);
	assert.ok(counts.componentCalls > 100); assert.equal(counts.componentCalls, counts.nativeImports);
	assert.ok(counts.leanCalls > 100 && counts.leanCalls <= counts.nativeImports);
	assert.equal(counts.exports, 27);
	const sanitized = await compiled.compile(`wit-${mode}-receivers-sanitized`, source, true, extra);
	const environment = { LSAN_OPTIONS: "exitcode=0" };
	const cold = await sanitized([], { ...environment, LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
	const exercised = await sanitized([], environment);
	assert.deepEqual(cold.stdout.trim().split("\n").map(line => JSON.parse(line)), [{ cold: true }
		, { componentCalls: 0, nativeImports: 0, leanCalls: 0, exports: 0 }]);
	assert.equal(exercised.stdout, normal.stdout);
	const normalize = text => text.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS").replaceAll(compiled.directory, "<probe>");
	assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	assert.equal(normalize(exercised.stderr), normalize(cold.stderr));
	const mutations = await rejectOwnedWitBorrowMutants(compiled, implementation, source, extra, normal.stdout);
	const offset = ownedReceiverMutants({ ...generated, source: implementation }).find(item => item.name === "receiver-parameter-offset");
	try
	{
		await saveLakeFile(compiled.directory, "public-api.c", offset.source);
		const broken = await compiled.compile("receiver-parameter-offset", source, false, extra);
		await assert.rejects(broken, /borrow C check failed/u);
		mutations.push({ name: offset.name, compiled: true, semanticRejection: true, sourceSha256: sha256(offset.source) });
	}
	finally
	{ await saveLakeFile(compiled.directory, "public-api.c", implementation); }
	const restored = await (await compiled.compile("restored-receivers", source, false, extra))();
	assert.equal(restored.stdout, normal.stdout); assert.equal(restored.stderr, "");
	await saveLakeFile("build/owned-wit-receivers", `${mode}.json`, canonicalJson({
		schemaVersion: 1, mode, input, native, result, counts, mutations
		, sanitizer: "address,undefined"
		, startupLeakBaseline: normalize(cold.stderr)
		, componentBase64: component.toString("base64")
		, componentSha256: sha256(component)
		, sourceSha256: sha256(generated.source), probeSha256: sha256(source)
		, manifest: model.manifest
	}));
	t.diagnostic(JSON.stringify({ mode, ...result, ...counts }));
});
