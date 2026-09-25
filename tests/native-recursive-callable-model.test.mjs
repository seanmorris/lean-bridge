/**
 * Authenticate recursive native callbacks without admitting any host package.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters, nativeGraphCarrierAbi } from "../src/build/native-graph-model.mjs";
import { createNativeCallableGraphDescriptor, nativeCallableGraphCarrierAbi } from "../src/build/native-callable-graph.mjs";
import { generateCompiledCallbacks } from "../src/build/native-component.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { descriptor } from "./helpers/npm-structured-callable-fixture.mjs";
import { compileNativeCallableGraphPayloads } from "../src/backends/c/native-callable-graph-payloads.mjs";
import { generateNativeCopiedGraphAdapters } from "../src/backends/c/native-graph-adapters.mjs";
import { generateNativeCallableGraphCalls } from "../src/backends/c/native-callable-graph-calls.mjs";

const fixture = () => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	const abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
	const reference = { kind: "reference", name: "Sample.Tree", lean: "Sample.Tree", abi };
	const tree = { kind: "variant", name: "Sample.Tree", lean: "Sample.Tree", abi
		, cases: [{ name: "next", constructor: "Sample.Tree.next", fields: [{ name: "child", type: reference }] }
			, { name: "leaf", constructor: "Sample.Tree.leaf", fields: [{ name: "value", type: projection.result }] }] };
	const graph = { kind: "graph", root: reference, types: [tree], abi };
	projection.parameters[0].type = graph; projection.result = graph;
	projection.parameters.push({ name: "callback", type: { kind: "callback", parameters: [graph], result: graph, abi } });
	input.metadata.modules[0].declarations[0].parameters.push({
		name: "callback"
		, binderInfo: "explicit"
		, typeExpression: "Sample.Tree → Sample.Tree"
	});
	return { ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } };
};

test("native recursive callbacks authenticate the complete finite descriptor", () => {
	const input = fixture(), before = canonicalJson(input);
	const model = createCompiledNativeModel(input), abi = nativeGraphCarrierAbi(model);
	assert.equal(model.schemaVersion, 4); assert.equal(model.pointerBits, 64);
	assert.equal(model.copiedGraph.types.length, 1); assert.equal(model.copiedGraph.callbacks.length, 1);
	assert.equal(canonicalJson(input), before);
	assert.doesNotMatch(canonicalJson(model), /copied-callable-frame|wasm32|scalar-frame/);
	assert.equal(abi.callbacks[0].parameters[0].id, "lean:Sample.Tree");
	assert.equal(abi.callbacks[0].result.id, "lean:Sample.Tree");
	for(const mutate of [
		value => { value.pointerBits = 32; }
		, value => { value.copiedGraph.callbacks[0].key = "f".repeat(40); }
		, value => { value.copiedGraph.types[0].cases.reverse(); }
		, value => { value.copiedGraph.exports[0].symbol = "lean_bridge_" + "f".repeat(24); }
		, value => { value.copiedGraph.callbacks[0].parameters = []; }
		, value => { value.copiedGraph.callbacks[0].result = { kind: "primitive", name: "unit" }; }
	]) {
		const changed = structuredClone(model); mutate(changed);
		assert.throws(() => nativeGraphCarrierAbi(changed), /differ/);
	}
});

test("native callable descriptors match an independent nine-shape public review", () => {
	for(const recursive of [false, true])
	{
		const ir = structuredCallableReviewedIr({ recursive });
		const native = createNativeCallableGraphDescriptor(ir);
		assert.deepEqual(nativeCallableGraphCarrierAbi(native, ir), descriptor(ir));
		assert.ok(native.callbacks.length >= 14);
		assert.equal(Object.hasOwn(native, "dispatch"), false);
		assert.equal(Object.hasOwn(native, "version"), false);
		const invalid = structuredClone(native); invalid.extra = true;
		assert.throws(() => nativeCallableGraphCarrierAbi(invalid, ir), /differs/);
	}
});

test("native callable graph admission retains identity ownership and lifetime checks", () => {
	const original = structuredCallableReviewedIr({ recursive: true });
	for(const mutate of [
		ir => { ir.types.find(type => type.kind === "callback").callable.parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(type => type.name === "Payload").fields[0].type = { kind: "named", id: ir.types.find(type => type.kind === "callback").id }; }
		, ir => { ir.types.find(type => type.kind === "callback").callable.resultMode = "promise"; }
	]) {
		const ir = structuredClone(original); mutate(ir);
		assert.throws(() => createNativeCallableGraphDescriptor(ir));
	}
});

test("native callback carriers share typed Lean recovery and checked C prototypes", () => {
	const model = createCompiledNativeModel(fixture());
	const adapters = generateCompiledNativeLeanAdapters(model), callbacks = generateCompiledCallbacks(model);
	assert.match(adapters.leanSource, /_root_\.Sample\.Tree\.\u00ableaf\u00bb/);
	assert.match(adapters.leanSource, /\(_root_\.Array \(_root_\.Sample\.Tree → _root_\.Sample\.Tree\)\)/);
	assert.doesNotMatch(adapters.leanSource, /\b(?:unsafe|partial|sorry|axiom|unsafeCast|Inhabited)\b/);
	assert.match(adapters.header, /_wrap\(size_t\);/);
	assert.match(adapters.header, /_apply\(lean_object \*, lean_object \*\);/);
	assert.match(adapters.header, /_invoke\(size_t, lean_object \*\);/);
	assert.match(callbacks, /lb_native_callback_lookup\(token\)/);
	assert.match(callbacks, /lean_dec\(value0\);\n\s+return lean_alloc_array\(0, 0\);/);
	assert.doesNotMatch(callbacks, /lean_ctor|lean_apply|bridge_scalar_frame/);
	assert.deepEqual(generateCompiledNativeLeanAdapters(model), adapters);
});

test("native callable payload layouts retain every copied root and exclude identities", () => {
	const ir = structuredCallableReviewedIr({ recursive: true }), before = canonicalJson(ir);
	const descriptor = createNativeCallableGraphDescriptor(ir);
	for(const wordBits of [32, 64])
	{
		const catalog = compileNativeCallableGraphPayloads(ir, descriptor, { wordBits });
		for(const signature of descriptor.callbacks)
		{
			for(const ref of [...signature.parameters, signature.result])
				assert.ok(catalog.copy(ref).id);
			assert.throws(() => catalog.copy({ kind: "named", id: signature.id }), /not a copied/);
		}
		const tree = catalog.copy({ kind: "named", id: "lean:Structured.Tree" });
		assert.equal(tree.kind, "variant"); assert.equal(tree.cases.length, 2);
		const generated = generateNativeCopiedGraphAdapters(catalog.ir, catalog.abi, { wordBits, exportCalls: false });
		assert.ok(generated.source.includes(`sizeof(size_t) == ${wordBits / 8}`));
		assert.doesNotMatch(generated.header, /_graph\(/);
		assert.doesNotMatch(generated.source, /copied_payload\d+_graph\(/);
		assert.match(generated.source, /ng_enter\(/);
	}
	assert.equal(canonicalJson(ir), before);
});

test("native graph calls bind exports, closure identities and checked initialization", () => {
	const ir = structuredCallableReviewedIr({ recursive: true });
	const descriptor = createNativeCallableGraphDescriptor(ir), before = canonicalJson({ ir, descriptor });
	const options = { initializer: "initialize_LeanBridgeNative0123456789abcdef" };
	const generated = generateNativeCallableGraphCalls(ir, descriptor, options);
	assert.deepEqual(generated.calls.map(item => item.bindingId), ir.declarations.map(item => item.id));
	assert.deepEqual(generated.closures.map(item => item.id), descriptor.callbacks.map(item => item.id));
	assert.equal(generated.calls.length, 29); assert.equal(generated.closures.length, 16);
	assert.match(generated.source, /slot->thread == ng_closure_thread/);
	assert.match(generated.source, /ng_closure_thread = \+\+ng_closure_thread_serial/);
	assert.match(generated.source, /ng_closure_thread_serial == UINT64_MAX/);
	assert.doesNotMatch(generated.source, /pthread_equal\(slot->thread/);
	assert.match(generated.source, /slot->process == getpid\(\)/);
	assert.match(generated.source, /value = slot->value; lean_inc\(value\)/);
	assert.match(generated.source, /ng_call_depth == 64/);
	assert.match(generated.source, /frame->borrowed\.status/);
	assert.match(generated.source, /if \(frame->status == NG_RESULT\) lean_bridge_native_runtime_retire\(\)/);
	assert.doesNotMatch(generated.source, /lean_apply|lean_alloc_ctor|lean_ctor_get|lean_ctor_set/);
	for(const initializer of [undefined, null, "", "initialize_other", "initialize_LeanBridgeNative0000000000000000; abort()"])
		assert.throws(() => generateNativeCallableGraphCalls(ir, descriptor, { initializer }), /checked component initializer/);
	const mismatch = structuredClone(descriptor); mismatch.callbacks[0].result = { kind: "primitive", name: "bool" };
	assert.throws(() => generateNativeCallableGraphCalls(ir, mismatch, options), /differs/);
	assert.equal(canonicalJson({ ir, descriptor }), before);
});
