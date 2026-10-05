/**
 * Compile ownership-aware graph conversions against the real Wasmtime C API.
 * Synthetic identities test transport, not compiled Lean or installed packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { compileOwnedWitGraphModel } from "../src/backends/wit/owned-graph-model.mjs";
import { renderOwnedWitGraphConversions } from "../src/backends/wit/owned-graph-conversions.mjs";
import { snapshotWasmtimeCapi } from "../src/build/native-wit-projection.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("owned WIT converters retain root-specific schemas and explicit identity directions", () => {
	const model = compileOwnedWitGraphModel(ownedDotnetCallbacksReviewedIr());
	const source = renderOwnedWitGraphConversions(model);
	assert.match(source, /typedef struct \{ size_t count; const ow_table_schema \*tables; \} ow_schema;/u);
	for(const fn of [...model.layout.functions, ...model.layout.callbacks])
	{
		for(const id of fn.parameters) assert.ok(source.includes(`ow_decode_${model.layout.nodes.find(node => node.id === id).index}_input(`));
		assert.ok(source.includes(`ow_encode_${model.layout.nodes.find(node => node.id === fn.result).index}_output(`));
	}
	assert.match(source, /context->visited != context->total/u);
	assert.match(source, /ow_value_delete\(scope, &converted\)/u);
	assert.match(source, /context->scope->identities.write/u);
});

test("owned WIT converters preserve values and release partial identities under sanitizers", {
	skip: process.env.LEAN_BRIDGE_WIT_OWNED_CONVERSIONS_TEST !== "1"
	, timeout: 180000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-owned-conversions-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const sdk = join(root, "wasmtime");
	await snapshotWasmtimeCapi(process.env.LEAN_BRIDGE_WASMTIME_C_API ?? resolve(".toolchains/wasmtime42"), sdk);
	const model = compileOwnedWitGraphModel(ownedDotnetCallbacksReviewedIr());
	const node = id => model.layout.nodes.find(node => node.id === id);
	const named = name => node(`lean:Owned.${name}`);
	const result = name => node(model.layout.functions.find(fn => fn.name === name).result);
	const types = { Ticket: named("Ticket"), Bundle: named("Bundle")
		, Payload: named("Payload")
		, Tree: named("Tree"), Choice: named("Choice"), Tickets: result("echoArray")
		, History: result("echoList"), Option: result("echoOption")
		, Result: result("echoResult"), Tuple: result("echoTuple")
		, TupleInner: node(result("echoTuple").fields[1].type)
		, TreeArray: node(named("Tree").cases[1].fields[0].type)
		, Callback: node(model.layout.functions.find(fn => fn.name === "callbackRecord").parameters[1]) };
	for(const scalar of model.layout.nodes.filter(node => node.kind === "primitive")) types[`Scalar_${scalar.name}`] = scalar;
	const macros = Object.entries(types).map(([name, type]) => [
		`typedef ${type.cName} native_${name};`
		, `#define ENCODE_${name}(mode) ow_encode_${type.index}_##mode`
		, `#define DECODE_${name}(mode) ow_decode_${type.index}_##mode`
		, `#define INDEX_${name} ${type.index}`
	].join("\n")).join("\n");
	const probe = (await readFile("tests/fixtures/structured-types/wit-owned-conversions.c", "utf8")).replace("/* GENERATED_TYPES */", macros);
	const conversions = renderOwnedWitGraphConversions(model);
	await saveLakeFile(root, "owned.h", model.layout.header);
	await saveLakeFile(root, "conversions.h", conversions);
	await saveLakeFile(root, "probe.c", probe);
	await saveLakeFile(root, "driver.wat", `(component
  (import "probe" (func $probe (result u32)))
  (core func $lower (canon lower (func $probe)))
  (func $run (result u32) (canon lift (core func $lower)))
  (export "run" (func $run))
)`);
	await runCopied("wasm-tools", ["parse", "driver.wat", "-o", "driver.wasm"], root, process.env);
	const driver = await readFile(join(root, "driver.wasm"));
	await saveLakeFile(root, "driver.h", `static const uint8_t driver[] = {${[...driver].join(",")}};\n`);
	const compilerArguments = ["-std=c11", "-O1", "-g", "-Wall", "-Wextra"
		, "-Werror"
		, "-UNDEBUG", "-fsanitize=address,undefined", "-fno-omit-frame-pointer"
		, "-fno-pie", "-no-pie"
		, "-I", join(sdk, "include"), "probe.c", "-L", join(sdk, "lib")
		, `-Wl,-rpath,${join(sdk, "lib")}`, "-lwasmtime", "-o", "probe"
	];
	await runCopied("cc", compilerArguments, root, process.env);
	const execute = () => runCopied("/bin/sh", ["-c", 'ulimit -c 0\nexec "$@"'
		, "owned-wit-conversions", join(root, "probe")], root, { PATH: "/unavailable"
		, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1"
		, UBSAN_OPTIONS: "halt_on_error=1" });
	const execution = await execute();
	assert.equal(execution.stderr, ""); const report = JSON.parse(execution.stdout);
	t.diagnostic(JSON.stringify(report));
	assert.equal(report.liveAllocations, 0); assert.equal(report.liveResources, 0);
	assert.ok(report.roundtrips >= 50); assert.equal(report.scalars, 19);
	assert.ok(report.inputAllocationSites > 0 && report.outputAllocationSites > 0);
	assert.equal(report.scratchFailures, report.inputAllocationSites + report.outputAllocationSites);
	assert.ok(report.budgetFailures > 100);
	assert.ok(report.malformedInputs >= 7); assert.ok(report.malformedOutputs >= 4);
	assert.ok(report.identityFailures >= 4); assert.equal(report.dropped, report.created);
	for(const [before, after] of [
		["ow_discard_resources(scope, value); wasmtime_component_val_delete(value);", "(void)scope; wasmtime_component_val_delete(value);"]
		, ["context->visited != context->total", "context->visited > context->total"]
	]) {
		assert.ok(conversions.includes(before));
		await saveLakeFile(root, "conversions.h", conversions.replaceAll(before, after));
		await runCopied("cc", compilerArguments, root, process.env);
		await assert.rejects(execute, /Assertion.*failed/u);
	}
	t.diagnostic("rejected mutations: missing resource cleanup; unreachable node admission");
});
