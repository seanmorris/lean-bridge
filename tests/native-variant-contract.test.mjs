/**
 * Tagged native values use typed Lean helpers and opt-in host projections.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { compilePrimitiveCppModel, renderPrimitiveCppPackage } from "../src/backends/cpp/primitives.mjs";
import { generateCopiedNativeCalls } from "../src/backends/c/native-copied-values.mjs";
import { createNativeModel, createPhpWasmCopiedModel, generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { nativeVariantReviewedIr } from "./helpers/native-variant-fixture.mjs";

const options = { callables: true, compounds: true, lists: true, variants: true };
const synthetic = () => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	const type = { kind: "variant", name: "Sample.Choice", lean: "Sample.Choice"
		, cases: [{ name: "empty", constructor: "Sample.Choice.empty", fields: [] }
			, { name: "some", constructor: "Sample.Choice.some", fields: [{ name: "value", type: projection.result }] }]
		, abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true } };
	projection.parameters[0].type = type; projection.result = type;
	return { ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } };
};

test("native variants construct, identify and project through typed Lean helpers", () => {
	const model = createNativeModel(synthetic()), adapter = generateNativeLeanAdapters(model);
	assert.deepEqual(adapter, generateNativeLeanAdapters(JSON.parse(canonicalJson(model))));
	assert.match(adapter.leanSource, /match value with \| \.empty\s*=> 0 \| \.some _ => 1/);
	assert.match(adapter.leanSource, /_root_\.Sample\.Choice\.some a0/);
	assert.match(adapter.leanSource, /match value with \| \.some item => item \| _ => 0/);
	assert.match(adapter.header, /uint32_t lb_t\w+_tag\(lean_object \* value\);/);
	const calls = generateCopiedNativeCalls(model, compilePrimitiveCSurface(model.bindingIr, options));
	assert.match(calls, /switch \(value->kind\)/);
	assert.match(calls, /if \(kind >= 2\) return -3/);
	assert.match(calls, /default: return 0/);
	assert.doesNotMatch(calls, /lean_ctor_|lean_obj_tag|lean_alloc_ctor/);
	const wasm = createPhpWasmCopiedModel(synthetic());
	assert.equal(wasm.pointerBits, 32);
	assert.deepEqual(generateNativeLeanAdapters(wasm), {
		...adapter, header: adapter.header.replace("sizeof(size_t) * 8 == 64", "sizeof(size_t) * 8 == 32")
	});
});

test("C++ alternatives preserve empty, unit, anonymous and mixed payload cases", () => {
	const ir = nativeVariantReviewedIr(), model = compilePrimitiveCppModel(ir);
	const generated = renderPrimitiveCppPackage(model)["include/variants.hpp"];
	assert.match(generated, /using Signal = std::variant<SignalIdle, SignalStopped, SignalData, SignalMarker>;/);
	assert.match(generated, /struct SignalData \{\s+uint32_t count\{\};\s+std::string label\{\};/);
	assert.match(generated, /struct SignalMarker \{\s+std::monostate value\{\};/);
	assert.match(generated, /struct AnonymousCollision \{\s+uint32_t arg1\{\};\s+std::string arg1_\{\};/);
	assert.match(generated, /bool bool_\{\};/); assert.match(generated, /char32_t char_\{\};/);
	assert.match(generated, /valueless_by_exception/);
	assert.match(generated, /std::get<SignalData>\(source\).label/);
	const c = generateCBindingPackage(ir);
	assert.match(c["include/variants.h"], /uint32_t kind;\s+union/);
	assert.match(c["src/variants.c"], /switch \(value->kind\)/);
	assert.match(c["src/variants.c"], /variants_string_clear\(&value->cases.data.label\)/);
	assert.match(c["src/variants.c"], /variants_signal_clear\(&value->current\)/);
});

test("variant schema cycles, collisions, ownership and identity payloads reject", () => {
	for(const mutate of [
		ir => { ir.types.find(type => type.name === "Signal").cases[0].fields.push({ ...ir.types.find(type => type.name === "Signal").cases[2].fields[0], type: { kind: "named", id: "lean:Variants.Signal" } }); }
		, ir => { ir.types.find(type => type.name === "Signal").cases[2].fields[1].name = "count"; }
		, ir => { ir.types.find(type => type.name === "Signal").cases[0].name = "Bad-Name"; }
		, ir => { ir.types.find(type => type.name === "Scalars").cases[1].fields[0].name = "bool_"; }
		, ir => { ir.declarations[0].parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(type => type.name === "Packet").name = "SignalData"; }
		, ir => { ir.types.find(type => type.name === "Signal").name = "Error"; }
	]) { const ir = nativeVariantReviewedIr(); mutate(ir); assert.throws(() => compilePrimitiveCppModel(ir)); }
	const input = synthetic(), type = input.metadata.modules[0].declarations[0].projection.result;
	type.cases[1].fields[0].type = { kind: "callback", parameters: [type.cases[1].fields[0].type], result: type.cases[1].fields[0].type, abi: type.abi };
	assert.throws(() => createNativeModel(input), /retention policy/);
});

test("native variant aliases keep target semantics and original alias contracts", () => {
	const ir = nativeVariantReviewedIr(), target = ir.types.find(type => type.name === "Mode");
	ir.types.push({ ...target, id: "lean:Variants.ModeView", name: "ModeView", kind: "alias", cases: [], target: { kind: "named", id: target.id } });
	const fn = ir.declarations.find(item => item.name === "echo_mode");
	fn.parameters[0].type = fn.result.type = { kind: "named", id: "lean:Variants.ModeView" };
	const generated = renderPrimitiveCppPackage(compilePrimitiveCppModel(ir))["include/variants.hpp"];
	assert.match(generated, /using ModeView = Mode;/);
	assert.match(generateCBindingPackage(ir)["include/variants.h"], /typedef variants_mode variants_mode_view_t;/);
});

test("unimplemented host projections still reject variants before generation", () => {
	const ir = nativeVariantReviewedIr();
	for(const build of [compileCopiedPhpModel, compileCopiedWitModel])
		assert.throws(() => build(ir), /copied primitives, arrays or acyclic records/);
	assert.throws(() => compilePrimitiveCSurface(ir, { ...options, variants: false }), /copied primitives, arrays or acyclic records/);
});
