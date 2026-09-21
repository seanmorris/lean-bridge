/**
 * Named Ruby constructor families, private union layouts and exact case types.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileCopiedRubyModel } from "../src/backends/ruby/copied-model.mjs";
import { generateCopiedRubyPackage } from "../src/backends/ruby/copied-values.mjs";
import { generateRubyBindingPackage } from "../src/backends/ruby/generate.mjs";
import { rubyVariantReviewedIr as contract } from "./helpers/ruby-variant-fixture.mjs";
import { aliasReviewedIr } from "./helpers/alias-fixture.mjs";

test("Ruby variants expose named frozen constructors with keyword payloads", () => {
	const ir = contract(), files = generateCopiedRubyPackage(ir);
	assert.deepEqual(files, generateRubyBindingPackage(ir));
	assert.deepEqual(files, generateCopiedRubyPackage(structuredClone(ir)));
	const publicSource = files["lib/lean_bridge/variants.rb"];
	assert.match(publicSource, /class Signal\n\s*private_class_method :new/);
	assert.match(publicSource, /class Signal::Idle < Signal/);
	assert.match(publicSource, /class Signal::Data < Signal/);
	assert.match(publicSource, /def initialize\(count:, label:\)/);
	assert.match(publicSource, /public_class_method :new/);
	assert.match(publicSource, /def deconstruct_keys\(_keys\)/);
	assert.match(publicSource, /def initialize\(arg1:, arg1_:\)/);
	assert.doesNotMatch(publicSource, /Fiddle::|constructor_tag|\.pack\(|\.unpack/);
	const native = files["lib/lean_bridge/variants/native.rb"];
	assert.match(native, /value\.instance_of\?\(Signal::Data\)/);
	assert.match(native, /case value\[0, 4\]\.unpack1\("L<"\)/);
	assert.match(native, /Invalid native Signal constructor/);
	assert.match(files["README.md"], /subclass/);
});

test("Ruby tagged unions preserve C padding and active payload alignment", () => {
	const model = compileCopiedRubyModel(contract());
	const expected = { Signal: [48, 8, 8], Mode: [8, 4, 4], Nested: [176, 8, 8]
		, Scalars: [224, 8, 8], Anonymous: [48, 8, 8]
		, One: [8, 4, 4], Buffers: [72, 8, 8] };
	for(const copy of model.surface.copies.filter(copy => copy.variant))
		assert.deepEqual([copy.size, copy.alignment, copy.payloadOffset], expected[copy.publicName], copy.publicName);
});

test("Ruby constructor families reject collisions and preserve trailing underscores", () => {
	for(const name of ["Signal", "Native", "Some"])
	{
		const ir = contract(); ir.types.find(type => type.name === "Packet").name = name;
		assert.throws(() => compileCopiedRubyModel(ir), /collid/);
	}
	for(const name of ["freeze", "deconstruct_keys", "object_id"])
	{
		const ir = contract(); ir.types.find(type => type.name === "Signal").cases[2].fields[0].name = name;
		assert.throws(() => compileCopiedRubyModel(ir), /(?:collid|reserved)/);
	}
	const ir = contract(); ir.types.find(type => type.name === "Signal").cases[0].name = "idle_";
	assert.match(generateCopiedRubyPackage(ir)["lib/lean_bridge/variants.rb"], /class Signal::Idle_ < Signal/);
	const duplicate = contract(), cases = duplicate.types.find(type => type.name === "Signal").cases;
	cases[1].name = "Idle";
	assert.throws(() => compileCopiedRubyModel(duplicate), /(?:collid|duplicat)/);
});

test("Ruby aliases name their variant family and recursive payloads remain gated", () => {
	const ir = contract(), target = { kind: "named", id: "lean:Variants.Signal" };
	const alias = { ...aliasReviewedIr().types.find(type => type.name === "ModeView")
		, id: "lean:Variants.SignalView", name: "SignalView", target };
	ir.types.push(alias);
	const fn = ir.declarations.find(item => item.name === "echo"); fn.parameters[0].type = fn.result.type = { kind: "named", id: alias.id };
	const manifest = JSON.parse(generateCopiedRubyPackage(ir)["binding-manifest.json"]);
	assert.deepEqual(manifest.aliases, [{ id: alias.id, name: alias.name, target, rubyType: "LeanBridge::Variants::Signal" }]);
	const recursive = contract(); recursive.types.find(type => type.name === "Signal").cases[2].fields[0].type = target;
	assert.throws(() => compileCopiedRubyModel(recursive), /acyclic/);
});
