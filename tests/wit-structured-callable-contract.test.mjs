/**
 * Check copied WIT callback types against the real component and C compilers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { witAliasReadme } from "../src/backends/wit/copied-aliases.mjs";
import { renderWitHostHeader, renderWitHostSource } from "../src/backends/wit/copied-host.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { brokerHeader } from "../src/backends/native/runtime-broker.mjs";
import { snapshotWasmtimeCapi } from "../src/build/native-wit-projection.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const semanticInterface = (document, name) => {
	const ref = value => {
		if(value === null || typeof value === "string") return value;
		const type = document.types[value]; assert.ok(type);
		const kind = type.kind;
		if(kind === "resource") return { resource: type.name };
		if(kind.type !== undefined) return ref(kind.type);
		if(kind.list !== undefined) return { list: ref(kind.list) };
		if(kind.option !== undefined) return { option: ref(kind.option) };
		if(kind.record) return { record: kind.record.fields.map(field => ({ name: field.name, type: ref(field.type) })) };
		if(kind.variant) return { variant: kind.variant.cases.map(branch => ({ name: branch.name, type: ref(branch.type) })) };
		if(kind.tuple) return { tuple: kind.tuple.types.map(ref) };
		if(kind.result) return { result: { ok: ref(kind.result.ok), err: ref(kind.result.err) } };
		if(kind.handle) return Object.fromEntries(Object.entries(kind.handle).map(([ownership, type]) => [ownership, ref(type)]));
		assert.ok(kind.enum || kind.flags, JSON.stringify(kind)); return kind;
	};
	const iface = document.interfaces.find(iface => iface.name === name); assert.ok(iface);
	return { types: Object.fromEntries(Object.entries(iface.types).map(([name, type]) => [name, ref(type)]))
		, functions: Object.fromEntries(Object.entries(iface.functions).map(([name, fn]) => [name, { params: fn.params.map(param => ({ name: param.name, type: ref(param.type) })), result: ref(fn.result) }])) };
};

test("WIT admits eight copied callback families with explicit resource ownership", () => {
	const ir = structuredCallableReviewedIr(), original = structuredClone(ir);
	const model = compileCopiedWitModel(ir, {}, { callables: true });
	assert.deepEqual(ir, original); assert.deepEqual(model.manifest, compileCopiedWitModel(original, {}, { callables: true }).manifest);
	assert.equal(model.surface.functions.length, 26); assert.equal(model.resources.length, 14);
	assert.equal(model.functions.length, 40);
	assert.ok(model.manifest.callables.every(value => value.parameter === "borrow" && value.result === "own"));
	assert.doesNotMatch(model.wit, /undefined|NaN/u);
	assert.match(model.wit, /resource function-payload-to-payload;/u);
	for(const shape of ["array", "list", "option", "result", "tuple", "record", "variant", "alias"])
		for(const action of ["call", "twice", "make"])
			assert.ok(model.wit.includes(`${action}-${shape}: func(`));
});

test("copied WIT callbacks retain every structured type through canonical lowering", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-structured-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const model = compileCopiedWitModel(structuredCallableReviewedIr(), {}, { callables: true });
	await saveLakeFile(root, "model.wit", model.wit); await saveLakeFile(root, "model.wat", model.wat);
	await runCopied("wasm-tools", ["parse", "model.wat", "-o", "model.wasm"], root, process.env);
	await runCopied("wasm-tools", ["validate", "--features", "component-model", "model.wasm"], root, process.env);
	const read = async path => JSON.parse((await runCopied("wasm-tools", ["component", "wit", path, "--json"], root, process.env)).stdout);
	const source = await read("model.wit"), binary = await read("model.wasm");
	for(const name of ["native", "api"]) assert.deepEqual(semanticInterface(binary, name), semanticInterface(source, name));
});

test("callback-only nested aliases are declared before callable resource indices", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-structured-aliases-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = structuredCallableReviewedIr();
	ir.declarations = ir.declarations.filter(fn => fn.name === "afterFailure");
	const callback = ir.types.find(type => type.id === ir.declarations[0].parameters[1].type.id);
	const nested = { kind: "apply", constructor: "array", arguments: [{ kind: "apply", constructor: "option", arguments: [{ kind: "named", id: "lean:Structured.Alias" }] }] };
	callback.callable.parameters[0].type = nested; callback.callable.result.type = nested;
	const model = compileCopiedWitModel(ir, {}, { callables: true });
	await saveLakeFile(root, "model.wit", model.wit); await saveLakeFile(root, "model.wat", model.wat);
	await runCopied("wasm-tools", ["parse", "model.wat", "-o", "model.wasm"], root, process.env);
	await runCopied("wasm-tools", ["validate", "--features", "component-model", "model.wasm"], root, process.env);
	const read = async path => JSON.parse((await runCopied("wasm-tools", ["component", "wit", path, "--json"], root, process.env)).stdout);
	const source = await read("model.wit"), binary = await read("model.wasm");
	for(const name of ["native", "api"])
	{
		assert.deepEqual(semanticInterface(binary, name), semanticInterface(source, name));
		const iface = binary.interfaces.find(iface => iface.name === name);
		const invoke = Object.entries(iface.functions).find(([name]) => name.startsWith("invoke-function-"))[1];
		const array = binary.types[invoke.params[1].type], option = binary.types[array.kind.type ?? array.kind.list];
		const list = array.kind.list !== undefined ? array : option;
		const member = binary.types[list.kind.list];
		const alias = binary.types[member.kind.option];
		assert.equal(alias.name, "alias");
		assert.ok(member.kind.option === iface.types.alias || member.kind.option === binary.types[iface.types.alias].kind.type);
	}
	const scalarIr = structuredClone(ir);
	scalarIr.types.find(type => type.id === "lean:Structured.Alias").target = { kind: "primitive", name: "uint32" };
	const scalarCallback = scalarIr.types.find(type => type.id === callback.id);
	for(const site of [...scalarCallback.callable.parameters, scalarCallback.callable.result])
		site.type = { kind: "named", id: "lean:Structured.Alias" };
	const scalarModel = compileCopiedWitModel(scalarIr, {}, { callables: true });
	assert.match(witAliasReadme(scalarModel), /Acyclic copied aliases also preserve their target values in callbacks/u);
	assert.doesNotMatch(witAliasReadme(scalarModel), /Alias payloads inside callback signatures.*unsupported/u);
	await saveLakeFile(root, "scalar.wat", scalarModel.wat);
	await runCopied("wasm-tools", ["parse", "scalar.wat", "-o", "scalar.wasm"], root, process.env);
	await runCopied("wasm-tools", ["validate", "--features", "component-model", "scalar.wasm"], root, process.env);
});

test("copied WIT callback host compiles against all generated C signatures", { skip: process.env.LEAN_BRIDGE_WIT_STRUCTURED_CALLABLE_TEST !== "1" }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-structured-host-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const sdk = join(root, "wasmtime");
	await snapshotWasmtimeCapi(process.env.LEAN_BRIDGE_WASMTIME_C_API, sdk);
	const ir = structuredCallableReviewedIr(), model = compileCopiedWitModel(ir, {}, { callables: true });
	const files = generateCBindingPackage(ir), prefix = model.surface.prefix;
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
	await saveLakeFile(root, `include/${prefix}_wasmtime.h`, renderWitHostHeader(model));
	await saveLakeFile(root, "include/lean_bridge_native_runtime.h", brokerHeader);
	await saveLakeFile(root, "host.c", renderWitHostSource(model, new Uint8Array([0])));
	await runCopied("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror"
		, "-pthread", "-fsyntax-only", "-I", join(root, "include")
		, "-I", join(sdk, "include"), "host.c"], root, process.env);
});
