/**
 * Execute owned graphs through the generated component and freshly compiled Lean.
 * This tests the private host, not the later installed session package.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateOwnedNativeValueAdapters } from "../src/backends/native/owned-value-adapters.mjs";
import { ownedAggregateLeaseSource } from "../src/backends/native/owned-aggregate-leases.mjs";
import { compileOwnedWitGraphModel } from "../src/backends/wit/owned-graph-model.mjs";
import { renderOwnedWitNativeHost } from "../src/backends/wit/owned-native-host.mjs";
import { snapshotWasmtimeCapi } from "../src/build/native-wit-projection.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("owned WIT imports retain independent native leases and preserve original function signatures", () => {
	const model = compileOwnedWitGraphModel(ownedAggregateReviewedIr());
	const source = renderOwnedWitNativeHost(model);
	for(const fn of [...model.layout.functions, ...model.layout.callbacks]) assert.ok(source.includes(`status = ${fn.symbol}(host->native, `));
	for(const resource of model.resources) assert.ok(source.includes(JSON.stringify(resource.node.identityKind)));
	assert.match(source, /lb_owned_scope_acquire\(&scope, ow_native_kinds\[type\], object, &retained\)/u);
	assert.match(source, /entry->pending = call->parent/u);
	assert.match(source, /host->next_rep == UINT32_MAX/u);
	assert.match(source, /ow_native_resource_drop, host, NULL/u);
});

const bindings = (model, generated) => {
	const node = id => model.layout.nodes.find(item => item.id === id);
	const fn = name => model.layout.functions.find(item => item.name === name);
	const names = { Ticket: node("lean:Owned.Ticket")
		, Bundle: node("lean:Owned.Bundle"), Payload: node("lean:Owned.Payload")
		, Choice: node("lean:Owned.Choice"), Tree: node("lean:Owned.Tree")
		, Tickets: node(fn("echoArray").result), History: node(fn("echoList").result)
		, Option: node(fn("echoOption").result), Result: node(fn("echoResult").result)
		, Tuple: node(fn("echoTuple").result), Row: node(fn("echoRow").result)
		, Nested: node(fn("echoNested").result), Nat: node("primitive:nat")
		, Text: node("primitive:string") };
	names.TupleInner = node(names.Tuple.fields[1].type);
	names.Trees = node(names.Tree.cases[1].fields[0].type);
	names.NestedList = node(names.Nested.element);
	names.NestedOption = node(names.NestedList.element);
	const closure = fn("makeRecord").result;
	return [
		`#define COMPONENT_ID ${JSON.stringify(model.model.component.id)}`
		, `#define COMPONENT_INITIALIZER initialize_${generated.carriers.module}`
		, `#define API_NAME ${JSON.stringify(model.exportName)}`
		, `#define FN_recordApply ${JSON.stringify(model.functions.find(item => item.resource?.id === closure).witName)}`
		, ...model.layout.functions.map(item => `#define FN_${item.name} ${JSON.stringify(model.functions.find(fn => fn.declaration.id === item.id).witName)}`)
		, ...Object.entries(names).flatMap(([name, type]) => [
			`typedef ${type.cName} native_${name};`
			, `#define ENCODE_${name} ow_encode_${type.index}_input`
			, `#define DECODE_${name} ow_decode_${type.index}_output`
			, `#define TYPE_${name} ${type.index}`
		])
	].join("\n") + "\n";
};

for(const reviewed of [false, true]) test(`owned WIT ${reviewed ? "reviewed" : "ordinary"} imports execute Lean and retain resources across result cleanup`, {
	skip: process.env.LEAN_BRIDGE_WIT_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, reviewed ? { reviewedIr: ownedAggregateReviewedIr() } : {});
	const generated = generateOwnedNativeValueAdapters({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component });
	assert.equal(generated.carriers.leanSource, compiled.leanSource);
	assert.equal(generated.carriers.header, compiled.header);
	const model = compileOwnedWitGraphModel(generated.layout.model.bindingIr);
	assert.deepEqual(model.layout, generated.layout);
	const sdk = join(compiled.directory, "wasmtime");
	await snapshotWasmtimeCapi(process.env.LEAN_BRIDGE_WASMTIME_C_API ?? resolve(".toolchains/wasmtime42"), sdk);
	await saveLakeFile(compiled.directory, "owned-values.h", generated.typesHeader);
	await saveLakeFile(compiled.directory, "owned-leases.h", ownedAggregateLeaseSource);
	await saveLakeFile(compiled.directory, "owned-values-codec.h", generated.source);
	await saveLakeFile(compiled.directory, "owned-host.h", renderOwnedWitNativeHost(model));
	await saveLakeFile(compiled.directory, "bindings.h", bindings(model, generated));
	await saveLakeFile(compiled.directory, "component.wat", model.wat);
	await runCopied("wasm-tools", ["parse", "component.wat", "-o", "component.wasm"], compiled.directory, process.env);
	await runCopied("wasm-tools", ["validate", "component.wasm"], compiled.directory, process.env);
	const component = await readFile(join(compiled.directory, "component.wasm"));
	await saveLakeFile(compiled.directory, "component.h", `static const uint8_t component_bytes[] = {${[...component].join(",")}};\n`);
	const source = await readFile("tests/fixtures/structured-types/wit-owned-native-host.c", "utf8");
	const extra = ["-I", join(sdk, "include"), "-L", join(sdk, "lib"), `-Wl,-rpath,${join(sdk, "lib")}`, "-lwasmtime"];
	const run = await compiled.compile("owned-wit", source, false, extra);
	const result = await run(); assert.equal(result.stderr, "");
	const report = JSON.parse(result.stdout); t.diagnostic(JSON.stringify({ reviewed, ...report }));
	assert.ok(report.calls > 100); assert.ok(report.resources > 100);
	assert.ok(report.shapes >= 12); assert.equal(report.closures, 2);
	assert.ok(report.allocationFailures > 0);
	assert.equal(report.liveIdentities, 0); assert.equal(report.liveAllocations, 0);
	const sanitized = await compiled.compile("owned-wit-sanitized", source, true, extra);
	const environment = { LSAN_OPTIONS: "exitcode=0" };
	const cold = await sanitized([], { ...environment, LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
	const exercised = await sanitized([], environment);
	const normalize = value => value.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS");
	assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
	assert.deepEqual(JSON.parse(exercised.stdout), report);
	assert.equal(normalize(exercised.stderr), normalize(cold.stderr), "Owned WIT calls changed the cold Lean leak baseline");
	assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	if(cold.stderr)
	{
		assert.match(cold.stderr, /SUMMARY: AddressSanitizer: \d+ byte\(s\) leaked in \d+ allocation\(s\)/u);
		assert.match(cold.stderr, /__gmp_default_allocate/u);
	}
	if(!reviewed) for(const [name, before, after] of [
		["missing-output-lease"
			, "status = lb_owned_scope_acquire(&scope, ow_native_kinds[type], object, &retained);"
			, "retained = token;"]
		, ["missing-pending-rollback"
			, "if (!success) {\n      if (!ow_native_release(host, entry)) success = false;"
			, "if (!success) {\n      (void)entry;"]
	]) {
		const original = renderOwnedWitNativeHost(model); assert.ok(original.includes(before));
		await saveLakeFile(compiled.directory, "owned-host.h", original.replaceAll(before, after));
		const changed = await compiled.compile(name, source, false, extra);
		await assert.rejects(() => changed(), /Assertion|Invalid owned WIT input/u);
		t.diagnostic(`rejected mutation: ${name}`);
	}
});
