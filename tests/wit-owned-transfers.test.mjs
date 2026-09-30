/**
 * Consuming public owners cross real Component Model calls into compiled Lean.
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
import { snapshotWasmtimeCapi } from "../src/build/native-wit-projection.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedRustTransferConfiguration, ownedRustTransferReviewedIr, ownedRustTransferSource } from "./helpers/owned-rust-transfer-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { ownedWitTransferProbe } from "./helpers/wit-owned-transfer-probe.mjs";

const handles = copy => copy.aliasTarget ? handles(copy.aliasTarget) : copy.resource ? [copy]
	: copy.element ? handles(copy.element) : copy.variant ? copy.cases.flatMap(branch => branch.fields.flatMap(field => handles(field.type)))
		: copy.fields.flatMap(field => handles(field.type));

test("WIT input transfers require explicit capability and retain exact own/borrow types", () => {
	const ir = ownedRustTransferReviewedIr();
	assert.throws(() => compileOwnedWitGraphModel(ir), /call-scoped input borrows/u);
	const model = compileOwnedWitGraphModel(ir, {}, { transferredInputs: true });
	assert.equal(model.layout.functions.length, 26);
	assert.equal(model.manifest.graph.inputTransfers.length, 20);
	assert.ok(!model.manifest.deferred.includes("transferred-inputs"));
	for(const fn of model.functions) for(const [i, parameter] of fn.parameters.entries())
	{
		const transferred = !fn.resource && fn.declaration.parameters[i].ownership === "transfer";
		for(const handle of handles(parameter.copy)) assert.equal(handle.borrowed, !transferred);
	}
	const enabled = compileOwnedWitGraphModel(ownedAggregateReviewedIr(), {}, { transferredInputs: true });
	const borrowed = compileOwnedWitGraphModel(ownedAggregateReviewedIr());
	for(const key of ["layout", "manifest", "wit", "wat"]) assert.deepEqual(enabled[key], borrowed[key]);
});

for(const mode of ["ordinary", "reviewed"]) test(`WIT consuming owners invalidate before real Lean callback reentry (${mode})`, {
	skip: process.env.LEAN_BRIDGE_WIT_OWNED_TRANSFER_TEST !== "1", timeout: 1200000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await ownedRustTransferConfiguration() } : { reviewedIr: ownedRustTransferReviewedIr() }
		, hostCallbacks: true, sourceSuffix: ownedRustTransferSource
		, evidenceName: `wit-transfers-${mode}-inputs.json`
	});
	const model = compileOwnedWitGraphModel(compiled.model.bindingIr, {}, { transferredInputs: true });
	await saveLakeFile(compiled.directory, "component.wat", model.wat);
	await saveLakeFile(compiled.directory, "component.wit", model.wit);
	await runCopied("wasm-tools", ["parse", "component.wat", "-o", "component.wasm"], compiled.directory, process.env);
	await runCopied("wasm-tools", ["validate", "component.wasm"], compiled.directory, process.env);
	await runCopied("wasm-tools", ["component", "wit", "component.wit", "--json"], compiled.directory, process.env);
	const component = await readFile(join(compiled.directory, "component.wasm"));
	const input = { metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component
		, hostCallbacks: true, transferredInputs: true };
	const generated = generateOwnedWitPackage(input, component);
	assert.equal(generated.carriers.leanSource, compiled.leanSource);
	assert.deepEqual(generated.model.layout, model.layout);
	const sdk = join(compiled.directory, "wasmtime");
	await snapshotWasmtimeCapi(process.env.LEAN_BRIDGE_WASMTIME_C_API ?? resolve(".toolchains/wasmtime42"), sdk);
	const invoke = "wasmtime_error_t *error = wasmtime_component_func_call(";
	let observed = generated.source;
	assert.equal(observed.split(invoke).length, 2);
	observed = observed.replace(invoke, "++test_component_calls; " + invoke);
	const entry = "wasmtime_component_val_t *results, size_t result_count) {\n  (void)type;";
	assert.equal(observed.split(entry).length, generated.model.functions.length + 1);
	observed = observed.replaceAll(entry, entry + " ++test_native_imports;");
	for(const fn of [...generated.layout.functions, ...generated.layout.callbacks])
	{
		const call = `status = ${fn.symbol}(host->native, `;
		assert.equal(observed.split(call).length, 2);
		const index = generated.layout.functions.indexOf(fn);
		observed = observed.replace(call, `++test_lean_calls; ${index < 0 ? "" : `test_exports |= UINT64_C(1) << ${index}; `}` + call);
		assert.ok(!observed.includes(`status = ${fn.symbol}(&active->native, `), "Public export bypassed WIT");
	}
	const implementation = `#include <stddef.h>
#include <stdint.h>
extern void *owned_test_allocate(size_t);
extern void owned_test_free(void *);
#define LB_OWNED_ALLOC owned_test_allocate
#define LB_OWNED_FREE owned_test_free
static size_t test_component_calls, test_native_imports, test_lean_calls;
static uint64_t test_exports;
${observed}
size_t owned_test_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  return snapshot.live_identities;
}
size_t owned_test_component_calls(void) { return test_component_calls; }
size_t owned_test_native_imports(void) { return test_native_imports; }
size_t owned_test_lean_calls(void) { return test_lean_calls; }
size_t owned_test_exports(void) {
  size_t count = 0;
  for (uint64_t bits = test_exports; bits; bits >>= 1) count += bits & 1;
  return count;
}
`;
	for(const [path, source] of Object.entries(generated.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	const copy = name => {
		const id = generated.values.functions.find(fn => fn.name === name).parameters[0];
		return generated.values.copies.find(fn => fn.id === id).cName;
	};
	await saveLakeFile(compiled.directory, "transfer-copies.h", [
		["OPTION", "echoOption"], ["ARRAY", "echoArray"], ["LIST", "echoList"]
		, ["RESULT", "echoResult"], ["TUPLE", "echoTuple"]
		, ["ROW", "echoRow"], ["NESTED", "echoNested"]]
		.map(([macro, name]) => `#define COPY_${macro} ${copy(name)}\n`).join(""));
	const source = await ownedWitTransferProbe(generated);
	const extra = ["public-api.c", "-lgmp", "-I", join(sdk, "include"), "-L", join(sdk, "lib"), `-Wl,-rpath,${join(sdk, "lib")}`, "-lwasmtime"];
	const run = await compiled.compile("owned-wit-transfers", source, false, extra);
	const normal = await run(); assert.equal(normal.stderr, "");
	const [report, counts] = normal.stdout.trim().split("\n").map(line => JSON.parse(line));
	assert.ok(report.checks > 1000); assert.ok(report.beforeFailures > 0); assert.ok(report.afterFailures > 0);
	assert.equal(report.live, 0); assert.equal(report.identities, 0);
	assert.ok(counts.componentCalls > 100); assert.equal(counts.componentCalls, counts.nativeImports);
	assert.ok(counts.leanCalls > 100 && counts.leanCalls <= counts.nativeImports);
	assert.equal(counts.exports, 26);
	t.diagnostic(JSON.stringify({ mode, ...report, ...counts }));
	const sanitized = await compiled.compile("owned-wit-transfers-sanitized", source, true, extra);
	const environment = { LSAN_OPTIONS: "exitcode=0" };
	const cold = await sanitized([], { ...environment, LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
	const exercised = await sanitized([], environment);
	assert.deepEqual(cold.stdout.trim().split("\n").map(line => JSON.parse(line)), [{ cold: true }
		, { componentCalls: 0, nativeImports: 0, leanCalls: 0, exports: 0 }]);
	assert.equal(exercised.stdout, normal.stdout);
	const normalize = text => text.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS").replaceAll(compiled.directory, "<probe>");
	assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	assert.equal(normalize(exercised.stderr), normalize(cold.stderr));
	const mutations = mode === "ordinary" ? [
		["missing-moved-slot", "*frame->inputs[i].slot = NULL;", "/* missing moved slot */"]
		, ["wrong-owner-membership", "entry->owner->token == token && !strcmp(entry->owner->kind, kind)", "entry->owner->token == token || !strcmp(entry->owner->kind, kind)"]
		, ["leaked-source-payload", "oc_release(result->blocks); LB_OWNED_FREE(result);\n  }\n  return status;", "LB_OWNED_FREE(result);\n  }\n  return status;"]
		, ["missing-store-lease-cleanup", "if (frame->host.self && !ow_native_host_close(&frame->host) && !status) status = LB_OWNED_RUNTIME;", "(void)frame->host;"]
	] : [];
	for(const [name, before, after] of mutations)
	{
		const ledger = name === "wrong-owner-membership", filename = ledger ? "owned-leases.h" : "public-api.c";
		const original = ledger ? generated.files["internal/owned-leases.h"] : implementation;
		assert.ok(original.includes(before), name);
		await saveLakeFile(compiled.directory, filename, original.replace(before, after));
		const changed = await compiled.compile(name, source, false, extra);
		await assert.rejects(() => changed(), /transfer C check failed/u);
		await saveLakeFile(compiled.directory, filename, original);
		t.diagnostic(`rejected mutation: ${name}`);
	}
	assert.ok(implementation.includes("frame.host.input_transfers = transfer;"));
	await saveLakeFile(compiled.directory, "public-api.c", implementation.replaceAll(
		"frame.host.input_transfers = transfer;", "(void)transfer; frame.host.input_transfers = NULL;"));
	const missingFrame = await compiled.compile("missing-transfer-frame", source, true, extra);
	const missing = await missingFrame([], { ...environment, LEAN_BRIDGE_WIT_MISSING_TRANSFER_FRAME: "1" });
	assert.deepEqual(JSON.parse(missing.stdout.trim().split("\n")[0]), { missingFrame: true });
	assert.equal(normalize(missing.stderr), normalize(cold.stderr));
	const variant = generated.values.functions.find(fn => fn.name === "echoVariant");
	const index = generated.model.functions.findIndex(fn => fn.declaration?.id === variant.id);
	const originalCall = `  if (!status) status = ows_dispatch_${index}(active->transport, &raw0, &transfer, &returned, &result_owner->native);`;
	assert.ok(implementation.includes(originalCall));
	await saveLakeFile(compiled.directory, "public-api.c", implementation.replace(originalCall,
		originalCall + "\n  if (!status) returned.tag = UINT32_MAX;"));
	const malformed = await compiled.compile("malformed-transfer-result", source, true, extra);
	const invalid = await malformed([], { ...environment, LEAN_BRIDGE_OWNED_BAD_REPLY: "1" });
	assert.deepEqual(JSON.parse(invalid.stdout.trim().split("\n")[0]), { badReply: true });
	assert.equal(normalize(invalid.stderr), normalize(cold.stderr));
	await saveLakeFile("build/owned-wit-transfers", mode + ".json", canonicalJson({
		schemaVersion: 1, mode, input, report, counts
		, probeSha256: sha256(source), sourceSha256: sha256(generated.source)
		, componentBase64: component.toString("base64")
		, componentSha256: sha256(component), manifest: model.manifest
		, rejectedMutations: mutations.map(item => item[0])
		, missingTransferFramePreservesOwner: true
		, malformedResultConsumesInputs: true
		, sanitizer: "address,undefined", startupLeakBaseline: normalize(cold.stderr)
	}));
});
