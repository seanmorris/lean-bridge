/**
 * Compiler and loader admission for copied-payload callback components.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertComponentStructuredCallableBindings } from "../src/abi/component-structured-callables.mjs";
import { createComponentPrivateAbi } from "../src/build/component-callable-adapters.mjs";
import { generateComponentStructuredCallableAdapters } from "../src/build/component-structured-callable-adapters.mjs";
import { generateCompilerAdapters, validateCompilerAdapterPlan } from "../src/build/compiler-adapters.mjs";
import { createComponentRuntime } from "../src/release/component-runtime.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { npmStructuredCallableReviewedIr } from "./helpers/npm-structured-callable-install-fixture.mjs";
import { descriptor } from "./helpers/npm-structured-callable-fixture.mjs";

const plan = ir => generateCompilerAdapters({ analysis: {
	bindingIr: { origin: "lean-elaborated", document: ir, semanticSha256: "1".repeat(64) }
	, exportCandidates: ir.declarations.map(item => ({ declaration: item.source.declaration, sourceModule: "Structured", status: "exportable" }))
}
, componentPlan: { sha256: "2".repeat(64), document: { bindingIr: { semanticSha256: "1".repeat(64) } } } });

test("structured compiler admission matches independent acyclic, recursive and mixed primitive contracts", async () => {
	for(const ir of [structuredCallableReviewedIr(), structuredCallableReviewedIr({ recursive: true }), npmStructuredCallableReviewedIr()])
	{
		const generated = plan(ir), abi = generated.plan.privateAbi;
		assert.deepEqual(abi, descriptor(ir)); assertComponentStructuredCallableBindings(abi, ir);
		validateCompilerAdapterPlan(generated.plan); await assertJsonSchema("compiler-adapter-plan", generated.plan);
		assert.match(generated.files["LeanBridgeGenerated.lean"], /carrierResult \(do/);
		assert.doesNotMatch(generated.files["LeanBridgeGenerated.lean"], /ClosureCarry|unsafe|sorry|panic!/);
		const c = generateComponentStructuredCallableAdapters(abi);
		assert.doesNotMatch(c, /lean_ctor_get|lean_ctor_set|lean_alloc_ctor|lean_apply_/);
		assert.match(c, /frame->version = 8/);
		assert.match(c, /frame->status = status;\n +bridge_callable_dispatch/);
		for(const item of abi.exports)
		{
			const body = c.slice(c.indexOf(`LEAN_EXPORT uint32_t ${item.symbol}(`));
			const end = body.indexOf("\n}\n");
			const operation = body.slice(0, end);
			if(operation.includes("_decode(&frame->args")) assert.ok(operation.lastIndexOf("_validate(&frame->args") < operation.indexOf("_decode(&frame->args"));
			assert.match(operation, /bridge_recursive_arena_open/);
		}
	}
	assert.equal(createComponentPrivateAbi(callableReviewedIr()).version, 3);
});

test("structured array-only callbacks keep an explicit empty nominal table", async () => {
	const ir = structuredCallableReviewedIr();
	ir.declarations = ir.declarations.filter(item => /(?:call|twice|make)Array$/.test(item.name));
	const ids = new Set(ir.declarations.flatMap(item => [...item.parameters.map(parameter => parameter.type.id), item.result.type.id]));
	ir.types = ir.types.filter(type => ids.has(type.id));
	const generated = plan(ir);
	assert.deepEqual(generated.plan.privateAbi.types, []);
	await assertJsonSchema("compiler-adapter-plan", generated.plan);
	for(const mutate of [
		value => { delete value.privateAbi.types; }
		, value => { delete value.privateAbi.callbacks; }
		, value => { value.privateAbi.records = []; }
		, value => { value.privateAbi.version = 3; value.privateAbi.dispatch = "scalar-callable-frame-v1"; delete value.privateAbi.types; }
	]) {
		const invalid = structuredClone(generated.plan); mutate(invalid);
		assert.throws(() => validateCompilerAdapterPlan(invalid));
		await assert.rejects(() => assertJsonSchema("compiler-adapter-plan", invalid));
	}
});

const loader = async (recursive = true) => {
	let links = 0, next = 512;
	const module = {
		HEAP8: new Uint8Array(4096)
		, _malloc: size => { const pointer = next; next += (Math.max(1, size) + 7) & ~7; return pointer; }
		, _free: () => {}
		, _bridge_lean_runtime_init: () => 1
		, _bridge_scalar_frame_clear: () => {}
		, _bridge_scalar_frame_validate: () => 0
		, _bridge_lean_component_initialize: () => 1
		, _bridge_lean_component_last_error: () => 0
		, _bridge_callable_abi: () => 1
		, _bridge_callable_invoke: () => 0
		, _bridge_callable_release: () => 1
		, FS: { writeFile: () => {}, unlink: () => {} }
		, loadDynamicLibrary: async () => { links++; }
		, ...(recursive ? { _bridge_recursive_abi: () => 1
			, _bridge_recursive_frame_validate: () => 0
			, _bridge_recursive_frame_clear: () => {}
			, _bridge_recursive_receipt_count: () => 0
			, _bridge_recursive_receipt_data: () => 0 } : {})
	};
	const bytes = Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0), bindingIr = structuredCallableReviewedIr({ recursive: true });
	const value = { id: "structured@1.0.0", buildHash: "1".repeat(64)
		, integrity: sha256(bytes)
		, initializer: "initialize_structured"
		, sideModule: new URL("https://example.invalid/structured.wasm")
		, bindingIr, privateAbi: createComponentPrivateAbi(bindingIr) };
	const runtime = await createComponentRuntime(async () => module, new URL("file:///main.wasm"));
	return { runtime, module, bytes, descriptor: value, links: () => links };
};

test("structured keys bind nominal layouts and copied ownership before fetching or linking", async t => {
	let fetches = 0;
	t.mock.method(globalThis, "fetch", () => { fetches++; throw new Error("Unexpected fetch"); });
	for(const mutate of [
		value => { value.privateAbi.callbacks[0].key = "f".repeat(40); }
		, value => { value.bindingIr.declarations.find(item => item.name === "callRecord").parameters[0].ownership = "borrow"; }
		, value => {
			const replacement = { kind: "primitive", name: "uint32" };
			value.privateAbi.types.find(type => type.id === "lean:Structured.Payload").fields[0].type = replacement;
			value.bindingIr.types.find(type => type.id === "lean:Structured.Payload").fields[0].type = replacement;
		}
	]) {
		const fixture = await loader(); mutate(fixture.descriptor);
		await assert.rejects(fixture.runtime.loadComponent(fixture.descriptor), /signature key mismatch|ownership/);
		assert.equal(fixture.links(), 0);
	}
	const old = await loader(false);
	await assert.rejects(old.runtime.loadComponent(old.descriptor), /lacks the component recursive callable ABI/);
	assert.equal(fetches, 0); assert.equal(old.links(), 0);
});

test("the component loader never frees its symbol after host dispatch retires the shared heap", async t => {
	const f = await loader();
	t.mock.method(globalThis, "fetch", async () => new Response(f.bytes));
	const api = await f.runtime.loadComponent(f.descriptor);
	let freed = 0, cleared = 0, hosts = 0;
	f.module._free = () => { freed++; };
	f.module._bridge_recursive_frame_clear = () => { cleared++; };
	const signature = f.descriptor.privateAbi.exports.find(item => item.bindingId === "lean:Structured.callArray");
	const callback = f.descriptor.privateAbi.callbacks.find(item => item.id === signature.parameters[1].id);
	f.module._bridge_scalar_call = (_name, frame) => {
		const token = new DataView(f.module.HEAP8.buffer).getUint32(frame + 56, true);
		// An export's two-argument frame is not a valid one-argument callback.
		assert.equal(f.module.bridgeCallableDispatch(token, callback.key, frame), 8);
		return 0;
	};
	assert.throws(() => api.call(signature.bindingId, [[], value => { hosts++; return value; }]), /Invalid structured callable frame/);
	assert.equal(freed, 0); assert.equal(cleared, 0); assert.equal(hosts, 0);
	assert.throws(() => f.runtime.loadComponent(f.descriptor), /poisoned/);
});
