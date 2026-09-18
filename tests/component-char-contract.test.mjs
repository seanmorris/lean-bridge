/**
 * Char validation must retain Unicode scalar semantics at every npm boundary.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { componentScalarTypes, validateComponentScalar } from "../src/abi/component-scalars.mjs";
import { callComponentScalar } from "../src/release/component-runtime.mjs";
import { validateBindingIr } from "../src/binding-ir/contract.mjs";
import { generateComponentScalarAdapters } from "../src/build/component-scalar-adapters.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { compileCProjectionModel } from "../src/backends/c/generate.mjs";
import { compilePythonPackageModel } from "../src/backends/python/generate.mjs";
import alpha from "../poc/lean-link-spike/bindings/alpha.binding-ir.json" with { type: "json" };
import { validateNativeType } from "../src/analyze/native-types.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import { charPoints, charReviewedIr, invalidChars, invalidCharPoints } from "./helpers/char-fixture.mjs";

const scalar = { kind: "primitive", name: "char" };
const signature = { parameters: [scalar], result: scalar, resultMode: "value" };

test("Char is a distinct IR primitive and an appended, stable wire tag", async () => {
	const ir = charReviewedIr();
	validateBindingIr(ir);
	await assertJsonSchema("binding-ir", ir);
	assert.deepEqual(componentScalarTypes, ["unit", "bool", "uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64", "nat", "int", "float32", "float64", "string", "bytes", "char"]);
	const type = { ...scalar, lean: "Char", abi: { cType: "uint32_t", box: "lean_box_uint32", unbox: "lean_unbox_uint32", heap: false } };
	validateNativeType(type);
	await assertJsonSchema("native-metadata-type", type);
	assert.throws(() => validateNativeType({ ...type, lean: "UInt32" }), /spelling/);
	assert.throws(() => compilePrimitiveCSurface(ir), /Char conversion is not yet implemented/);
	assert.throws(() => compileCProjectionModel(ir), /C projection does not define char/);
	const legacy = structuredClone(alpha);
	legacy.types.find(type => type.kind === "record").fields[0].type = scalar;
	assert.throws(() => compilePythonPackageModel(legacy), /Python projection does not define char/);
});

test("Char accepts exactly one Unicode scalar without normalization or coercion", async () => {
	const files = generateJavaScriptPackage(charReviewedIr());
	assert.match(files["index.d.ts"], /echo\(value0: string\): string/);
	const validators = Object.entries(files).find(([path]) => path.endsWith("validators.mjs"));
	assert.ok(validators);
	const { assertChar } = await import(`data:text/javascript;base64,${Buffer.from(validators[1]).toString("base64")}`);
	for(const point of charPoints)
	{
		const value = String.fromCodePoint(point);
		assert.equal(validateComponentScalar("char", value), value);
		assert.equal(assertChar(value, "input"), value);
	}
	for(const value of [...invalidChars, new String("a")])
	{
		assert.throws(() => validateComponentScalar("char", value), TypeError);
		assert.throws(() => assertChar(value, "input"), TypeError);
	}
	for(let point = 0; point <= 0x10ffff; point++)
	{
		const value = String.fromCodePoint(point);
		if(point >= 0xd800 && point <= 0xdfff)
		{
			assert.throws(() => validateComponentScalar("char", value), TypeError);
			assert.throws(() => assertChar(value, "input"), TypeError);
		} else
		{
			assert.equal(validateComponentScalar("char", value), value);
			assert.equal(assertChar(value, "input"), value);
		}
	}
});

test("typed Char adapters validate before calling Lean and check their result", () => {
	const source = generateComponentScalarAdapters({ exports: [{ ...signature, symbol: "character" }] });
	assert.match(source, /extern uint32_t character_lean\(uint32_t\)/);
	assert.ok(source.indexOf("bridge_scalar_slot_validate") < source.indexOf("uint32_t result = character_lean"));
	assert.match(source, /frame->result.kind = 16/);
	assert.match(source, /result > 0x10ffff/);
	assert.doesNotMatch(source, /lean_object \* result/);
});

test("Char wire decoding rejects invalid scalars and high bits, with cleanup", () => {
	const live = new Set();
	let next = 64, calls = 0, clears = 0;
	const module = { HEAP8: new Uint8Array(32768)
		, _malloc: bytes => { const pointer = next; next += (bytes + 7) & ~7; live.add(pointer); return pointer; }
		, _free: pointer => assert.equal(live.delete(pointer), true)
		, _bridge_scalar_frame_clear: () => { clears++; } };
	const run = (input, result, flags = 0) => callComponentScalar(module, frame => {
		calls++;
		const view = new DataView(module.HEAP8.buffer);
		assert.equal(view.getUint32(frame + 32, true), 16);
		assert.equal(view.getBigUint64(frame + 40, true), BigInt(input.codePointAt(0)));
		view.setUint32(frame + 16, 16, true);
		view.setUint32(frame + 20, flags, true);
		view.setBigUint64(frame + 24, result, true);
		return 0;
	}, signature, [input]);
	for(const point of charPoints) assert.equal(run(String.fromCodePoint(point), BigInt(point)), String.fromCodePoint(point));
	for(const point of invalidCharPoints) assert.throws(() => run("a", point), /Invalid component Unicode scalar/);
	assert.throws(() => run("a", 65n, 1), /Invalid component Unicode scalar/);
	const before = calls;
	for(const input of invalidChars) assert.throws(() => run(input, 65n), TypeError);
	assert.equal(calls, before);
	assert.equal(live.size, 0);
	assert.equal(clears, charPoints.length + invalidCharPoints.length + 1 + invalidChars.length);
});
