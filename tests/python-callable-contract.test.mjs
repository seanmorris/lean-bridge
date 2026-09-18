/**
 * Source-level Python callable admission and generated API checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileCopiedPythonModel } from "../src/backends/python/copied-model.mjs";
import { generateCopiedPythonPackage } from "../src/backends/python/copied-values.mjs";
import { generatePythonBindingPackage } from "../src/backends/python/generate.mjs";
import { auditPythonPackage } from "../src/backends/python/package-audit.mjs";
import { compileCopiedRubyModel } from "../src/backends/ruby/copied-model.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";

test("Python primitive callables emit typed closures without enabling other hosts", () => {
	const ir = callableReviewedIr(), model = compileCopiedPythonModel(ir), files = generateCopiedPythonPackage(ir);
	assert.equal(model.surface.callbacks.size, 38);
	assert.equal(model.surface.functions.length, 58);
	assert.equal(auditPythonPackage(ir, files).exports.length, 60);
	assert.deepEqual(files, generateCopiedPythonPackage(structuredClone(ir)));
	assert.deepEqual(files, generatePythonBindingPackage(ir));
	assert.match(files["lean_callables/__init__.pyi"], /def call_nat\(value0: int, value1: _Callable\[\[int\], int\]\) -> int/);
	assert.match(files["lean_callables/__init__.pyi"], /def make_char\(value0: str\) -> LeanClosure\[\[bool, str\], str\]/);
	assert.doesNotMatch(files["lean_callables/__init__.pyi"], /ctypes|Any|c_void_p/);
	assert.throws(() => compileCopiedRubyModel(ir), { code: "unsupported-native-c-signature" });
});

for(const [label, change] of Object.entries({
	"retained callback": ir => { ir.declarations[0].parameters[1].lifetime.scope = "explicit"; }
	, "async callback": ir => { ir.types[0].callable.resultMode = "promise"; }
	, "nonprimitive callback": ir => { ir.types[0].callable.result.type = { kind: "apply", constructor: "array", arguments: [{ kind: "primitive", name: "uint8" }] }; }
	, "callable builtin collision": ir => { ir.declarations[0].parameters[0].name = "callable"; }
})) test(`Python callable admission rejects ${label}`, () => {
	const ir = callableReviewedIr(); change(ir);
	assert.throws(() => compileCopiedPythonModel(ir));
});
