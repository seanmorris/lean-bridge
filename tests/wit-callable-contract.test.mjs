/**
 * Validate staged primitive callable ownership through real WIT and components.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { renderWitHostHeader, renderWitHostSource } from "../src/backends/wit/copied-host.mjs";
import { generateWitPackage } from "../src/backends/wit/generate.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { brokerHeader } from "../src/backends/native/runtime-broker.mjs";
import { snapshotWasmtimeCapi } from "../src/build/native-wit-projection.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { callablePrimitives, callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { witCallableSignatures, witCallableComponentProbe } from "./helpers/wit-callable-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const semanticInterface = (document, name) => {
	const value = ref => {
		if(typeof ref === "string") return ref;
		const type = document.types[ref], kind = type.kind;
		if(kind === "resource") return { resource: type.name };
		if(kind.type !== undefined) return value(kind.type);
		if(kind.list !== undefined) return { list: value(kind.list) };
		if(kind.record) return { record: kind.record.fields.map(field => ({ name: field.name, type: value(field.type) })) };
		if(kind.handle) return Object.fromEntries(Object.entries(kind.handle).map(([ownership, type]) => [ownership, value(type)]));
		return kind;
	};
	const iface = document.interfaces.find(iface => iface.name === name);
	return { types: Object.fromEntries(Object.entries(iface.types).map(([name, type]) => [name, value(type)]))
		, functions: Object.fromEntries(Object.entries(iface.functions).map(([name, fn]) => [name, { params: fn.params.map(parameter => ({ name: parameter.name, type: value(parameter.type) })), result: value(fn.result) }])) };
};

test("copied WIT output retains its pre-callable byte identities", () => {
	const outputs = [];
	for(const [label, type] of callablePrimitives) for(const count of [1, 17]) for(const array of [false, true])
	{
		const ir = callableReviewedIr([{ name: `Callables.echo${label}`, parameters: Array(count).fill(type), result: type }]);
		if(array) for(const site of [...ir.declarations[0].parameters, ir.declarations[0].result]) site.type = { kind: "apply", constructor: "array", arguments: [site.type] };
		const { wit, wat, manifest } = compileCopiedWitModel(ir); outputs.push({ wit, wat, manifest });
	}
	assert.equal(outputs.length, 76);
	// Compared with the generator at 8906de9 before recording this digest.
	assert.equal(sha256(canonicalJson(outputs)), "6ce5a1813807446a0713700dff5416504691caa06b11ca81f16bc055fc43b4c5");
});

test("WIT primitive callable projection supplies a checked owning native host", () => {
	const ir = callableReviewedIr(witCallableSignatures);
	assert.throws(() => compileCopiedWitModel(ir), { code: "unsupported-native-c-signature" });
	assert.ok(generateWitPackage(ir));
	const model = compileCopiedWitModel(ir, {}, { callables: true });
	assert.match(renderWitHostHeader(model), /wasmtime_callback_create/);
	assert.match(renderWitHostSource(model, new Uint8Array()), /lean_bridge_native_identity_acquire/);
	const repeated = compileCopiedWitModel(structuredClone(ir), {}, { callables: true });
	assert.equal(model.wit, repeated.wit); assert.equal(model.wat, repeated.wat);
	assert.deepEqual(model.manifest, repeated.manifest);
	assert.equal(model.manifest.backend, "ordinary-wit-native-callable-v1");
	assert.equal(model.manifest.declarations.length, 61);
	assert.equal(model.resources.length, 39);
	assert.match(model.wit, /resource function-bool-to-bool;/u);
	assert.match(model.wit, /call-bool: func\(value0: bool, value1: borrow<function-bool-to-bool>\) -> bool;/u);
	assert.match(model.wit, /make-bool: func\(value0: bool\) -> own<function-bool-bool-to-bool>;/u);
	assert.match(model.wit, /invoke-function-bool-to-bool: func\(self: borrow<function-bool-to-bool>, arg0: bool\) -> bool;/u);
	assert.ok(model.manifest.callables.every(type => type.parameter === "borrow" && type.result === "own"));
});

test("wasm-tools validates all nineteen callable types and sixteen-argument canonical forwarding", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-callable-model-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const model = compileCopiedWitModel(callableReviewedIr(witCallableSignatures), {}, { callables: true });
	await saveLakeFile(root, "model.wit", model.wit);
	await saveLakeFile(root, "model.wat", model.wat);
	await runCopied("wasm-tools", ["parse", "model.wat", "-o", "model.wasm"], root, process.env);
	await runCopied("wasm-tools", ["validate", "--features", "component-model", "model.wasm"], root, process.env);
	const source = JSON.parse((await runCopied("wasm-tools", ["component", "wit", "model.wit", "--json"], root, process.env)).stdout);
	const binary = JSON.parse((await runCopied("wasm-tools", ["component", "wit", "model.wasm", "--json"], root, process.env)).stdout);
	for(const name of ["native", "api"]) assert.deepEqual(semanticInterface(binary, name), semanticInterface(source, name));
});

test("native WIT callable host compiles against the public C and Wasmtime APIs", { skip: process.env.LEAN_BRIDGE_WIT_CALLABLE_COMPONENT_TEST !== "1" }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-callable-compile-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const sdk = join(root, "wasmtime");
	await snapshotWasmtimeCapi(process.env.LEAN_BRIDGE_WASMTIME_C_API, sdk);
	for(const signatures of [witCallableSignatures, witCallableSignatures.filter(fn => fn.name === "Callables.makeUInt32")])
	{
		const ir = callableReviewedIr(signatures), model = compileCopiedWitModel(ir, {}, { callables: true });
		const c = generateCBindingPackage(ir);
		await saveLakeFile(root, "callables.h", c["include/callables.h"]);
		await saveLakeFile(root, "callables_wasmtime.h", renderWitHostHeader(model));
		await saveLakeFile(root, "lean_bridge_native_runtime.h", brokerHeader);
		await saveLakeFile(root, "host.c", renderWitHostSource(model, new Uint8Array([0])));
		await runCopied("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-pthread", "-I", join(sdk, "include"), "-c", "host.c", "-o", "host.o"], root, process.env);
	}
});

test("Wasmtime executes primitive callable ownership through the generated component", { skip: process.env.LEAN_BRIDGE_WIT_CALLABLE_COMPONENT_TEST !== "1" }, async t => {
	assert.ok(process.env.LEAN_BRIDGE_WASMTIME_C_API, "Set LEAN_BRIDGE_WASMTIME_C_API to the pinned Wasmtime 42.0.1 C API");
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-callable-component-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const sdk = join(root, "wasmtime");
	await snapshotWasmtimeCapi(process.env.LEAN_BRIDGE_WASMTIME_C_API, sdk);
	assert.match((await runCopied("wasm-tools", ["--version"], root, process.env)).stdout, /^wasm-tools 1\.245\.1(?: |$)/u);
	const model = compileCopiedWitModel(callableReviewedIr(witCallableSignatures), {}, { callables: true });
	await saveLakeFile(root, "model.wat", model.wat);
	await saveLakeFile(root, "probe.c", await witCallableComponentProbe(model));
	await runCopied("wasm-tools", ["parse", "model.wat", "-o", "model.wasm"], root, process.env);
	await runCopied("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-I", join(sdk, "include"), "probe.c", "-L", join(sdk, "lib"), `-Wl,-rpath,${join(sdk, "lib")}`, "-lwasmtime", "-o", "probe"], root, process.env);
	const result = JSON.parse((await runCopied(join(root, "probe"), [join(root, "model.wasm")], root)).stdout);
	assert.equal(result.primitiveCases, 114);
	assert.equal(result.componentCalls, 825);
	assert.equal(result.resourcesCreated, 236);
	assert.equal(result.resourcesReleased, 236);
	assert.equal(result.returnedDestructors, 115);
	assert.equal(result.reentries, 2);
	t.diagnostic(JSON.stringify(result));
	const mutants = [
		["borrow-leak", model.wat.replace(/^\s*\(call \$drop\d+ .+\)\n/gmu, ""), /borrow handles still remain/u]
		, ["nested-memory-reset", model.wat.replace("(i32.load offset=16 (i32.shl (global.get $depth) (i32.const 2)))", "(i32.const 272)"), /a->of.u32 == b->of.u32/u]
	];
	for(const [name, source, diagnostic] of mutants)
	{
		assert.notEqual(source, model.wat);
		await saveLakeFile(root, `${name}.wat`, source);
		await runCopied("wasm-tools", ["parse", `${name}.wat`, "-o", `${name}.wasm`], root, process.env);
		await runCopied("wasm-tools", ["validate", `${name}.wasm`], root, process.env);
		await assert.rejects(runCopied(join(root, "probe"), [join(root, `${name}.wasm`)], root), diagnostic);
	}
});

for(const [name, change] of Object.entries({
	retained: ir => { ir.declarations[0].parameters[1].lifetime.scope = "explicit"; }
	, async: ir => { ir.types[0].callable.resultMode = "promise"; }
	, identity: ir => { ir.types[0].callable.result.type = { kind: "named", id: ir.types[0].id }; }
	, zero: ir => { ir.types[0].callable.parameters = []; }
	, seventeen: ir => { ir.types[0].callable.parameters = Array.from({ length: 17 }, (_, i) => ({ ...ir.types[0].callable.parameters[0], name: `arg${i}` })); }
	, collision: ir => { ir.declarations[0].name = "functionBoolToBool"; }
})) test(`staged WIT callable admission rejects ${name}`, () => {
	const ir = callableReviewedIr(); change(ir);
	assert.throws(() => compileCopiedWitModel(ir, {}, { callables: true }));
});
