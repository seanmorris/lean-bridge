/**
 * Authenticate recursive native callbacks without admitting any host package.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { containsCallbackSubtype, createCompiledNativeModel, generateCompiledNativeLeanAdapters, nativeGraphCarrierAbi } from "../src/build/native-graph-model.mjs";
import { createNativeCallableGraphDescriptor, nativeCallableGraphCarrierAbi } from "../src/build/native-callable-graph.mjs";
import { generateCompiledCallbacks } from "../src/build/native-component.mjs";
import { compileNativeGraphProjection } from "../src/build/native-graph-projection.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { structuredCallableDirectionalSubtypeIr, structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { descriptor } from "./helpers/npm-structured-callable-fixture.mjs";
import { compileNativeCallableGraphPayloads } from "../src/backends/c/native-callable-graph-payloads.mjs";
import { generateNativeCopiedGraphAdapters } from "../src/backends/c/native-graph-adapters.mjs";
import { generateNativeCallableGraphCalls } from "../src/backends/c/native-callable-graph-calls.mjs";
import { generateCallablePythonGraphPackage } from "../src/backends/python/callable-graph-package.mjs";
import { generateCallableRubyGraphPackage } from "../src/backends/ruby/callable-graph-package.mjs";
import { generateCallableRustGraphPackage } from "../src/backends/rust/callable-graph-package.mjs";
import { generateCallableDotnetGraphPackage } from "../src/backends/dotnet/callable-graph-package.mjs";
import { generateCallableJvmGraphPackage } from "../src/backends/jvm/callable-graph-package.mjs";
import { generateCallablePhpGraphPackage } from "../src/backends/php/callable-graph-package.mjs";
import { compileCallableWitGraphPackageModel } from "../src/backends/wit/callable-graph-package.mjs";
import { renderWitGraphCallableHostSource } from "../src/backends/wit/callable-graph-host.mjs";

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

test("callback-only graph APIs do not emit an unused out-of-line closure store", () => {
	const model = createCompiledNativeModel(fixture());
	const adapter = generateCompiledNativeLeanAdapters(model);
	const generated = generateNativeCallableGraphCalls(model.bindingIr, model.copiedGraph, { initializer: `initialize_${adapter.module}` });
	assert.match(generated.source, /static inline uint64_t ng_closure_store/u);
	assert.ok(generated.closures.length > 0);
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

test("native callable descriptors retain directional callback Subtypes in their authenticated keys", () => {
	const { ir, host, closure } = structuredCallableDirectionalSubtypeIr();
	const descriptor = createNativeCallableGraphDescriptor(ir);
	assert.deepEqual(descriptor.callbacks.find(type => type.id === host.id).refinements,
		host.source.extensions["lean-lang.org/refinements"]);
	assert.deepEqual(descriptor.callbacks.find(type => type.id === closure.id).refinements,
		closure.source.extensions["lean-lang.org/refinements"]);
	assert.deepEqual(nativeCallableGraphCarrierAbi(descriptor, ir).callbacks, descriptor.callbacks);
	for(const type of [host, closure])
	{
		const changed = structuredClone(descriptor);
		delete changed.callbacks.find(value => value.id === type.id).refinements;
		assert.throws(() => nativeCallableGraphCarrierAbi(changed, ir), /differs/);
	}
});

test("acyclic callback Subtypes select the callable-graph carrier", () => {
	const subtype = { kind: "refinement", base: { kind: "primitive", name: "nat" }
		, predicate: { kind: "subtype", constructor: "Example.checked" } };
	assert.equal(containsCallbackSubtype(subtype), false);
	assert.equal(containsCallbackSubtype({ kind: "callback"
		, parameters: [{ kind: "primitive", name: "nat" }]
		, result: subtype }), true);
	assert.equal(containsCallbackSubtype({ kind: "callback"
		, parameters: [{ ...subtype, predicate: { kind: "fin", bound: "3" } }]
		, result: { kind: "primitive", name: "nat" } }), false);
});

test("native callback Subtype trampolines require typed recovery and report constructor rejection", () => {
	const { ir, host, closure } = structuredCallableDirectionalSubtypeIr();
	const descriptor = createNativeCallableGraphDescriptor(ir);
	const generated = generateNativeCallableGraphCalls(ir, descriptor,
		{ initializer: "initialize_LeanBridgeNative0123456789abcdef" });
	const hostSignature = descriptor.callbacks.find(type => type.id === host.id);
	const closureSignature = descriptor.callbacks.find(type => type.id === closure.id);
	assert.match(generated.borrowsHeader, new RegExp(`${hostSignature.key}[^}]+recovery`, "su"));
	assert.match(generated.source, new RegExp(`ng_recovery_${hostSignature.key}`, "u"));
	assert.match(generated.source, new RegExp(`ng_reject_${hostSignature.key}`, "u"));
	assert.match(generated.source, /ng_borrow_fail\(host->frame, NG_INVALID\)/u);
	assert.match(generated.source, new RegExp(`ng_borrow_${hostSignature.key}[^;]+ng_recovery_${hostSignature.key}[^;]+ng_reject_${hostSignature.key}`, "su"));
	assert.doesNotMatch(generated.source, new RegExp(`ng_recovery_${closureSignature.key}`, "u"));
	assert.equal(generated.closures.some(item => item.id === host.id), false);
	assert.equal(generated.closures.some(item => item.id === closure.id), true);
	assert.doesNotMatch(generated.source, new RegExp(`${hostSignature.key}_apply`, "u"));
	assert.doesNotMatch(generated.source, new RegExp(`${hostSignature.key}_lease_call`, "u"));
	assert.match(generated.source, new RegExp(`${closureSignature.key}_apply`, "u"));
	assert.match(generated.source, new RegExp(`${closureSignature.key}_lease_call`, "u"));
	assert.match(generated.source, /lean_array_size\(value\) == 0[^}]+ng_borrow_fail\(frame, NG_INVALID\)/su);
	assert.equal((generated.source.match(/lean_array_size\(value\) == 0/g) ?? []).length, 3);
	const abi = nativeCallableGraphCarrierAbi(descriptor, ir);
	const model = { copiedGraph: descriptor
		, bindingIr: ir
		, profile: "native-library-v1"
		, pointerBits: 64
		, byteOrder: "little"
		, schemaVersion: 4 };
	const callbacks = generateCompiledCallbacks(model);
	const symbol = abi.exports[0].symbol;
	assert.match(callbacks, new RegExp(`${symbol}_structured_callback_controls`, "u"));
	assert.match(callbacks, /controls->recovery\(callback\.context\)/u);
	assert.match(callbacks, /controls->reject\(callback\.context, recovery\)/u);
});

test("native language projections retain callback Subtype direction and typed recovery", () => {
	const { ir } = structuredCallableDirectionalSubtypeIr();
	for(const target of ["pypi", "rubygems", "cargo", "nuget", "maven", "php-native", "wit-wasi"])
		assert.ok(compileNativeGraphProjection(ir, [target]));
	assert.ok(compileNativeGraphProjection(ir, ["pypi", "rubygems", "cargo", "nuget", "maven", "php-native", "wit-wasi"]));
	const python = generateCallablePythonGraphPackage(ir);
	const pythonPublic = python[Object.keys(python).find(path => path.endsWith("/__init__.py"))];
	const pythonNative = python[Object.keys(python).find(path => path.endsWith("/_native.py"))];
	assert.match(pythonPublic, /class WithRecovery\(_Generic\[_P, _R\]\):/u);
	assert.match(pythonPublic, /def with_recovery\(/u);
	assert.match(pythonNative, /class _Callback0[\s\S]+\("recovery", _c\.POINTER/u);
	assert.match(pythonNative, /def _check_callback0[\s\S]+requires with_recovery/u);
	assert.match(pythonNative, /status == 10:[\s\S]+failed its Lean constructor/u);
	assert.match(pythonNative, /callback = function[\s\S]+_graph_synchronous\(callback\(/u);
	assert.doesNotMatch(pythonNative, /function = _CallbackFn/u);
	assert.doesNotMatch(pythonNative, /_owned0 =/u);
	assert.match(pythonNative, /_owned1 =/u);
	assert.deepEqual(JSON.parse(python["binding-manifest.json"]).exports.slice(0, 4),
		["LeanBridgeError", "LeanClosure", "WithRecovery", "with_recovery"]);

	const ruby = generateCallableRubyGraphPackage(ir);
	const rubyPublic = ruby[Object.keys(ruby).find(path => /\/structured\.rb$/u.test(path))];
	const rubyNative = ruby[Object.keys(ruby).find(path => path.endsWith("/native.rb"))];
	assert.match(rubyPublic, /WithRecovery = ::Data\.define\(:function, :recovery\)/u);
	assert.match(rubyPublic, /def self\.with_recovery\(/u);
	assert.match(rubyNative, /def check_callback0[\s\S]+requires with_recovery/u);
	assert.match(rubyNative, /frame\.scope\.allocate\(24\)/u);
	assert.match(rubyNative, /status == 10/u);
	assert.doesNotMatch(rubyNative, /OWNED0 =/u);
	assert.match(rubyNative, /OWNED1 =/u);

	const rust = generateCallableRustGraphPackage(ir, null, { name: "structured", version: "1.0.0" });
	assert.match(rust["src/lib.rs"], /pub struct WithRecovery<F, R>/u);
	assert.match(rust["src/lib.rs"], /WithRecovery<impl FnMut\([^)]*\) -> Result<[^>]+>, BigUint>/u);
	assert.match(rust["src/__runtime.rs"], /struct Callback0 \{[^}]+recovery: \*const/u);
	assert.match(rust["src/__runtime.rs"], /graph_check\d+\(&arg\d+\.recovery/u);
	assert.match(rust["src/__runtime.rs"], /status == 10/u);
	assert.doesNotMatch(rust["src/__runtime.rs"], /owned0:/u);
	assert.match(rust["src/__runtime.rs"], /owned1:/u);

	const dotnet = generateCallableDotnetGraphPackage(ir);
	const dotnetApi = dotnet[Object.keys(dotnet).find(path => path.endsWith("/Api.cs"))];
	const dotnetCalls = dotnet[Object.keys(dotnet).find(path => path.endsWith("/Calls.cs"))];
	assert.match(dotnetApi, /record WithRecovery<TDelegate, TResult>/u);
	assert.match(dotnetApi, /WithRecovery<global::System\.Func<[^>]+>, global::System\.Numerics\.BigInteger>/u);
	assert.match(dotnetCalls, /struct GraphCallback0 \{[^}]+Recovery;/u);
	assert.match(dotnetCalls, /GraphRuntime\.Write\d+\(arg\d+\.Recovery, check\)/u);
	assert.match(dotnetCalls, /frame\.Replies\.Store\(recovery\)/u);
	assert.match(dotnetCalls, /status == 10/u);
	assert.doesNotMatch(dotnetCalls, /Invoke0\(/u);
	assert.match(dotnetCalls, /Invoke1\(/u);

	const jvm = generateCallableJvmGraphPackage(ir);
	const jvmRecovery = jvm[Object.keys(jvm).find(path => path.endsWith("/WithRecovery.java"))];
	const jvmApi = jvm[Object.keys(jvm).find(path => path.endsWith("/Api.java"))];
	const jvmRuntime = jvm[Object.keys(jvm).find(path => path.endsWith("/_CallableGraphRuntime.java"))];
	assert.match(jvmRecovery, /record WithRecovery<F, R>/u);
	assert.match(jvmApi, /WithRecovery<[^>]+, java\.math\.BigInteger>/u);
	assert.match(jvmRuntime, /allocate\(24, 8\)/u);
	assert.match(jvmRuntime, /value\.recovery\(\), frame\.replies/u);
	assert.match(jvmRuntime, /status == 10/u);
	assert.doesNotMatch(jvmRuntime, /invokeJava0\(/u);
	assert.match(jvmRuntime, /invokeJava1\(/u);
	const jvmHost = jvm[Object.keys(jvm).find(path => path.endsWith("/FnNatToNat.java"))];
	assert.doesNotMatch(jvmHost, /class LeanClosure/u);

	const php = generateCallablePhpGraphPackage(ir);
	const phpApi = php["src/Api.php"], phpNative = php["src/Internal/Native.php"];
	const phpRuntime = php["src/Internal/CallableRuntime.php"];
	assert.match(phpApi, /final readonly class WithRecovery/u);
	assert.match(phpApi, /function with_recovery\(/u);
	assert.match(phpNative, /void \*recovery;/u);
	assert.match(phpRuntime, /requires with_recovery\(function, value\)/u);
	assert.match(phpRuntime, /\$input->recovery=\$recovery/u);
	assert.match(phpRuntime, /\$status===10/u);

	const wit = compileCallableWitGraphPackageModel(ir);
	const witHost = renderWitGraphCallableHostSource(wit, new Uint8Array([0]));
	const hostCallback = [...wit.callbacks.values()].find(callback => callback.direction === "host");
	assert.equal(wit.manifest.cHost.callbacks.find(callback => callback.id === hostCallback.id).requiresRecovery, true);
	assert.match(wit.hostHeader, new RegExp(`const ${hostCallback.result.name.replaceAll("$", "\\$")} \\*recovery`, "u"));
	assert.match(witHost, /entry->recovery = &context->recovery/u);
	assert.match(witHost, /\.recovery = entry\d+->recovery/u);
	assert.match(witHost, /native_status == 10 \? "Host callback result failed its Lean constructor"/u);
	assert.doesNotMatch(witHost, new RegExp(hostCallback.call, "u"));
});

test("JVM callback Subtypes disambiguate equal erased host and closure signatures", () => {
	const { ir, closure } = structuredCallableDirectionalSubtypeIr();
	closure.callable.parameters = [structuredClone(closure.callable.parameters[1])];
	closure.source.extensions["lean-lang.org/refinements"].parameters = [{
		kind: "subtype", constructor: "Structured.checkedClosureArgument"
	}];
	const generated = generateCallableJvmGraphPackage(ir);
	const names = Object.keys(generated);
	assert.ok(names.some(path => path.endsWith("/FnNatToNatHost.java")));
	assert.ok(names.some(path => path.endsWith("/FnNatToNatClosure.java")));
	const api = generated[names.find(path => path.endsWith("/Api.java"))];
	assert.match(api, /WithRecovery<FnNatToNatHost, java\.math\.BigInteger>/u);
	assert.match(api, /FnNatToNatClosure\.LeanClosure/u);
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
