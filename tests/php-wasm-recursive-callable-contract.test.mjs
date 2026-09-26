/**
 * Bind recursive callback carriers to the real PHP-Wasm machine width.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters, phpWasmGraphCarrierAbi } from "../src/build/php-wasm-graph-model.mjs";
import { createNativeCallableGraphDescriptor } from "../src/build/native-callable-graph.mjs";
import { generateNativeCallableGraphCalls } from "../src/backends/c/native-callable-graph-calls.mjs";
import { compileCopiedPhpGraphZendModel } from "../src/backends/php/copied-graph-zend.mjs";
import { compileCallablePhpGraphZendModel } from "../src/backends/php/callable-graph-zend-model.mjs";
import { generateCompiledPhpWasmGraph } from "../src/build/php-wasm-graph-component.mjs";
import { generateCopiedPhpGraphZendAdapter } from "../src/backends/php/copied-graph-zend.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";

const fixture = () => {
	const input = nativeMetadataFixture(), declaration = input.metadata.modules[0].declarations[0];
	const projection = declaration.projection;
	const abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
	const reference = { kind: "reference", name: "Sample.Tree", lean: "Sample.Tree", abi };
	const tree = { kind: "variant", name: "Sample.Tree", lean: "Sample.Tree", abi
		, cases: [{ name: "next", constructor: "Sample.Tree.next", fields: [{ name: "child", type: reference }] }
			, { name: "leaf", constructor: "Sample.Tree.leaf", fields: [{ name: "value", type: projection.result }] }] };
	const graph = { kind: "graph", root: reference, types: [tree], abi };
	projection.parameters[0].type = graph; projection.result = graph;
	projection.parameters.push({ name: "callback", type: { kind: "callback", parameters: [graph], result: graph, abi } });
	declaration.parameters.push({ name: "callback", binderInfo: "explicit", typeExpression: "Sample.Tree → Sample.Tree" });
	return { ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } };
};

test("recursive PHP-Wasm callback models authenticate width and every signature", () => {
	const options = fixture(), before = canonicalJson(options), model = createCompiledPhpWasmModel(options);
	assert.equal(canonicalJson(options), before);
	assert.equal(model.profile, "php-wasm-copied-v1"); assert.equal(model.pointerBits, 32);
	const abi = phpWasmGraphCarrierAbi(model);
	assert.equal(abi.callbacks.length, 1); assert.equal(abi.types.length, 1);
	assert.deepEqual(abi.callbacks[0].parameters, [{ kind: "named", id: "lean:Sample.Tree" }]);
	for(const mutate of [
		value => { value.pointerBits = 64; }
		, value => { value.profile = "native-library-v1"; }
		, value => { value.byteOrder = "big"; }
		, value => { value.copiedGraph.callbacks[0].key = "f".repeat(40); }
		, value => { value.copiedGraph.callbacks[0].parameters = []; }
		, value => { value.copiedGraph.callbacks[0].result = { kind: "primitive", name: "unit" }; }
		, value => { value.copiedGraph.types[0].cases.reverse(); }
	]) {
		const changed = structuredClone(model); mutate(changed);
		assert.throws(() => phpWasmGraphCarrierAbi(changed), /differ/);
	}
});

test("PHP-Wasm callback wrappers keep total Lean recovery and 32-bit C assertions", () => {
	const model = createCompiledPhpWasmModel(fixture()), adapters = generateCompiledPhpWasmLeanAdapters(model);
	assert.match(adapters.header, /sizeof\(size_t\) \* 8 == 32/);
	assert.doesNotMatch(adapters.header, /sizeof\(size_t\) \* 8 == 64/);
	assert.match(adapters.header, /_wrap\(size_t\);/);
	assert.match(adapters.header, /_apply\(lean_object \*, lean_object \*\);/);
	assert.match(adapters.header, /_invoke\(size_t, lean_object \*\);/);
	assert.match(adapters.leanSource, /_root_\.Sample\.Tree\.\u00ableaf\u00bb/);
	assert.doesNotMatch(adapters.leanSource, /\b(?:unsafe|partial|sorry|axiom|unsafeCast|Inhabited)\b/);
	assert.deepEqual(generateCompiledPhpWasmLeanAdapters(model), adapters);
});

test("recursive PHP-Wasm callback payloads share the Zend layout without copied identities", () => {
	const ir = structuredCallableReviewedIr({ recursive: true }), descriptor = createNativeCallableGraphDescriptor(ir);
	const generated = generateNativeCallableGraphCalls(ir, descriptor, { wordBits: 32, initializer: "initialize_LeanBridgeNative0123456789abcdef" });
	const zend = compileCopiedPhpGraphZendModel(generated.payloads.ir);
	assert.equal(generated.layout.wordBits, 32);
	assert.deepEqual(generated.layout, zend.layout); assert.equal(generated.typesHeader, zend.typesHeader);
	assert.equal(generated.calls.length, 29); assert.equal(generated.closures.length, 16);
	for(const signature of descriptor.callbacks)
		assert.throws(() => generated.payloads.copy({ kind: "named", id: signature.id }), /not a copied/);
	assert.match(generated.source, /sizeof\(size_t\) == 4 && sizeof\(void \*\) == 4/);
	assert.match(generated.source, /__builtin_wasm_memory_size/);
});

test("recursive Zend callable names and integer mappings come from the original public contract", () => {
	const ir = structuredCallableReviewedIr({ recursive: true }), before = canonicalJson(ir);
	const model = compileCallablePhpGraphZendModel(ir);
	assert.equal(canonicalJson(ir), before); assert.equal(model.layout.wordBits, 32);
	assert.equal(model.functions.length, 29); assert.equal(model.callbacks.size, 16);
	assert.deepEqual(model.functions.map(fn => fn.declaration.id), ir.declarations.map(fn => fn.id));
	assert.equal(model.functions.find(fn => fn.declaration.name === "callRecursive").publicName, "call_recursive");
	assert.equal(model.functions.find(fn => fn.declaration.name === "makeRecursive").result.callback.parameters.length, 2);
	for(const name of ["uint32", "uint64", "nat", "int"])
		assert.equal(model.types.find(type => type.ref.name === name).publicType, "\\Brick\\Math\\BigInteger");
	assert.match(model.transport, /^LeanStructured\\Internal\\GraphZend[a-f0-9]{16}$/);
	assert.match(model.library, /^php8\.4-lb_structured_graph_[a-f0-9]{16}\.so$/);
	assert.notEqual(model.identity, compileCopiedPhpGraphZendModel(model.payloads.ir).identity);
});

test("recursive PHP-Wasm source manifests bind callable descriptors and all generated bytes", () => {
	const model = createCompiledPhpWasmModel(fixture());
	const generated = generateCompiledPhpWasmGraph(model, generateCompiledPhpWasmLeanAdapters(model));
	assert.deepEqual(generated, generateCompiledPhpWasmGraph(model, generateCompiledPhpWasmLeanAdapters(model)));
	for(const [path, entry] of Object.entries(generated.manifest.files))
	{ assert.equal(entry.sha256, sha256(generated.files[path]), path); assert.equal(entry.bytes, Buffer.byteLength(generated.files[path]), path); }
	assert.equal(generated.receipt.callbacksSha256, sha256(generated.files["graph/callbacks.c"]));
	assert.ok(generated.sources.includes("graph/callbacks.c"));
	const source = generated.files[`extension/${generated.manifest.extension}.c`];
	assert.match(source, /uint64_t token; unsigned signature/);
	assert.match(source, /lgc_lookup\(context, 0\)/);
	assert.match(source, /zend_catch \{ call->bailout = 1; \}/);
	assert.match(source, /lgc_next_identity == UINTPTR_MAX/);
	assert.match(source, /lgc_unregister\(call\)/);
	assert.match(source, /zend_throw_exception_internal\(failure\)/);
	assert.doesNotMatch(source, /zend_throw_exception_object/);
	assert.match(source, /if \(!lb_readable\(s, frame->data, frame->count, child->size, child->alignment\)\n {8}\|\| !lg_children\(walk, frame->count\)/);
	assert.doesNotMatch(source, /lgc_borrow \*borrow = context/);
});

test("exporting the shared Zend descriptors leaves copied-only source bytes unchanged", () => {
	const files = generateCopiedPhpGraphZendAdapter(nativeRecursiveReviewedIr());
	assert.equal(sha256(canonicalJson(files)), "968638820af650131303cd90d6d3495086b970faa4f32200cf8b610106bd11e9");
});

test("PHP-Wasm CI runs recursive callback probes and retains all installed-package evidence", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const name of ["generated", "packages"])
	{
		const command = "npm run test:php-wasm-recursive-" + name;
		assert.ok(workflow.includes("          " + command + "\n"));
		assert.equal(workflow.split(command).length, 3, "Execution and recorded CI command");
	}
	for(const name of ["generated", "packages", "mixed-packages"])
	{
		const path = "build/recursive-callables/php-wasm-" + name + ".json";
		assert.ok(workflow.includes("          test -s " + path + "\n"));
		assert.ok(workflow.includes("            " + path + "\n"));
	}
});
