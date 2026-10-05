/**
 * Ruby callable admission, public APIs and generated syntax.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileCopiedRubyModel } from "../src/backends/ruby/copied-model.mjs";
import { generateCopiedRubyPackage } from "../src/backends/ruby/copied-values.mjs";
import { generateRubyBindingPackage } from "../src/backends/ruby/generate.mjs";
import { auditManagedBindingPackage } from "../src/backends/managed/package-audit.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";

test("Ruby primitive callables expose blocks and owned closures without enabling other hosts", () => {
	const ir = callableReviewedIr(), model = compileCopiedRubyModel(ir), files = generateCopiedRubyPackage(ir);
	assert.equal(model.surface.callbacks.size, 38);
	assert.equal(model.surface.functions.length, 58);
	assert.deepEqual(files, generateCopiedRubyPackage(structuredClone(ir)));
	assert.deepEqual(files, generateRubyBindingPackage(ir));
	assert.equal(auditManagedBindingPackage(ir, files, "ruby").publicFiles.length, 1);
	const source = files["lib/lean_bridge/callables.rb"], native = files["lib/lean_bridge/callables/native.rb"];
	assert.match(source, /def call_nat\(arg0, arg1 = nil, &block\)/);
	assert.match(source, /class LeanClosure/);
	assert.match(source, /def with\n[\s\S]*?ensure\n\s+close/);
	assert.doesNotMatch(source, /Fiddle|Pointer|dispatch/);
	assert.match(native, /non-local exits are not supported/);
	assert.match(native, /RUBY_MN_THREADS/);
	assert.match(native, /need_gvl: true/);
	assert.match(native, /def call0\(/);
	assert.throws(() => compilePrimitiveCSurface(ir), { code: "unsupported-native-c-signature" });
});

for(const [label, change] of Object.entries({
	"retained callback": ir => { ir.declarations[0].parameters[1].lifetime.scope = "explicit"; }
	, "async callback": ir => { ir.types[0].callable.resultMode = "promise"; }
	, "higher-order callback": ir => { ir.types[0].callable.result.type = { kind: "named", id: ir.types[0].id }; }
	, "builtin collision": ir => { ir.declarations[0].name = "send"; }
	, "exception helper collision": ir => { ir.declarations[0].name = "raise"; }
})) test(`Ruby callable admission rejects ${label}`, () => {
	const ir = callableReviewedIr(); change(ir);
	assert.throws(() => compileCopiedRubyModel(ir));
});
