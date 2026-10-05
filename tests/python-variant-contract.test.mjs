/**
 * Named Python constructors and active-case ctypes conversion contracts.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileCopiedPythonModel } from "../src/backends/python/copied-model.mjs";
import { generateCopiedPythonPackage } from "../src/backends/python/copied-values.mjs";
import { generatePythonBindingPackage } from "../src/backends/python/generate.mjs";
import { auditPythonPackage } from "../src/backends/python/package-audit.mjs";
import { nativeVariantReviewedIr } from "./helpers/native-variant-fixture.mjs";

test("Python variants export frozen named constructors and precise union stubs", () => {
	const ir = nativeVariantReviewedIr(), files = generateCopiedPythonPackage(ir);
	assert.deepEqual(files, generatePythonBindingPackage(ir));
	const exports = auditPythonPackage(ir, files).exports;
	for(const name of ["Signal", "SignalIdle", "SignalStopped", "SignalData", "SignalMarker", "One", "OneOnly", "BuffersEmpty", "BuffersPair"]) assert.ok(exports.includes(name), name);
	for(const suffix of ["py", "pyi"])
	{
		const source = files[`lean_variants/__init__.${suffix}`];
		assert.match(source, /@_dataclass\(frozen=True, slots=True\)\nclass SignalData:/);
		assert.match(source, /kind: _ClassVar\[_Literal\["data"\]\] = "data"/);
		assert.match(source, /Signal: _TypeAlias = SignalIdle \| SignalStopped \| SignalData \| SignalMarker/);
		assert.match(source, /One: _TypeAlias = OneOnly/);
		assert.match(source, /def echo\(value0: Signal\) -> Signal:/);
		assert.match(source, /bool_: bool/); assert.match(source, /bytes_: bytes/);
		assert.doesNotMatch(source, /ctypes|Any|c_void_p|constructor_tag/);
	}
	const native = files["lean_variants/_native.py"];
	assert.match(native, /class _V\d+\(_c.Union\):/);
	assert.match(native, /if type\(value\) is SignalData:/);
	assert.match(native, /Invalid native Signal constructor/);
	assert.match(native, /finally:\n {8}try:\n {12}_clear/);
	assert.doesNotMatch(native, /lean_obj_tag|lean_ctor_get/);
});

test("Python variant constructors and escaped fields reject naming collisions", () => {
	const record = nativeVariantReviewedIr(); record.types.find(type => type.name === "Packet").name = "SignalData";
	assert.throws(() => compileCopiedPythonModel(record), /Python .*name collides/);
	const alias = nativeVariantReviewedIr(), signal = alias.types.find(type => type.name === "Signal");
	alias.types.push({ ...signal, id: "lean:Variants.SignalData", name: "SignalData", kind: "alias", cases: [], target: { kind: "primitive", name: "uint32" } });
	assert.throws(() => compileCopiedPythonModel(alias), /Python alias name collides/);
	const fields = nativeVariantReviewedIr(), branch = fields.types.find(type => type.name === "Signal").cases.find(item => item.name === "data");
	branch.fields[0].name = "from"; branch.fields[1].name = "from_";
	assert.throws(() => compileCopiedPythonModel(fields), /Python variant field name collides/);
	const recursive = nativeVariantReviewedIr(); recursive.types.find(type => type.name === "Signal").cases[2].fields[0].type = { kind: "named", id: "lean:Variants.Signal" };
	assert.throws(() => compileCopiedPythonModel(recursive), /acyclic/);
});

test("Python keywords remain valid in private layouts and public payload fields", () => {
	const ir = nativeVariantReviewedIr(), branch = ir.types.find(type => type.name === "Signal").cases[2];
	branch.name = "from"; branch.fields[0].name = "from"; branch.fields[1].name = "kind";
	const files = generateCopiedPythonPackage(ir), source = files["lean_variants/__init__.pyi"], native = files["lean_variants/_native.py"];
	assert.match(source, /class SignalFrom:/); assert.match(source, /from_: int/); assert.match(source, /kind_: str/);
	assert.doesNotMatch(native, /\.from\b|\bfrom=|\bkind=_to/);
	assert.match(native, /value\.cases\.case2\.from_/);
});
