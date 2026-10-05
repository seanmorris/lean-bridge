/**
 * Scalar conversion invariants used by ordinary calls and callback frames.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { componentScalarTypes, scalarCopyLimit } from "../src/abi/component-scalars.mjs";
import { readComponentScalarSlot, writeComponentScalarSlot } from "../src/release/component-scalar-codec.mjs";
import { callComponentScalar } from "../src/release/component-runtime.mjs";

const fixture = () => {
	const module = { HEAP8: new Uint8Array(65536) }, slot = 64;
	let next = 256;
	const allocate = size => { const pointer = next; next += (Math.max(size, 1) + 7) & ~7; return pointer; };
	const write = (type, value) => writeComponentScalarSlot(module, slot, type, value, allocate);
	const read = (type, charge) => readComponentScalarSlot(module, slot, type, charge);
	return { module, slot, allocate, write, read, view: () => new DataView(module.HEAP8.buffer) };
};

const values = {
	unit: [undefined], bool: [false, true]
	, uint8: [0, 255], uint16: [0, 65535], uint32: [0, 0x80000000, 0xffffffff]
	, uint64: [0n, 1n << 53n, (1n << 64n) - 1n]
	, int8: [-128, 0, 127], int16: [-32768, 0, 32767]
	, int32: [-0x80000000, 0, 0x7fffffff]
	, int64: [-(1n << 63n), 0n, (1n << 63n) - 1n]
	, nat: [0n, 1n << 31n, 1n << 64n, (1n << 4096n) + 123n]
	, int: [0n, -1n, -(1n << 4096n), (1n << 4096n) + 123n]
	, float32: [0, -0, 1.25, Math.PI, Infinity, -Infinity, NaN]
	, float64: [0, -0, Math.PI, Infinity, -Infinity, NaN]
	, string: ["", "\uFEFF", "\uFEFF\0🌱\uFEFF", "λ中文é", "e\u0301"]
	, bytes: [new Uint8Array(), new Uint8Array([0, 128, 255])]
	, char: ["a", "\0", "\uFEFF", "🌱", "\u{10ffff}"]
	, usize: [0, 0x80000000, 0xffffffff], isize: [-0x80000000, -1, 0, 0x7fffffff]
};

test("all nineteen primitive slot conversions preserve exact host values and copied independence", () => {
	assert.deepEqual(Object.keys(values), componentScalarTypes);
	const f = fixture();
	for(const [type, cases] of Object.entries(values)) for(const value of cases)
	{
		f.write(type, value);
		const actual = f.read(type), expected = type === "float32" ? Math.fround(value) : value;
		assert.deepEqual(actual, expected, type);
		if(type === "bytes")
		{
			assert.notEqual(actual, value);
			const pointer = f.view().getUint32(f.slot + 8, true);
			f.module.HEAP8.fill(42, pointer, pointer + value.length);
			assert.deepEqual(actual, expected);
		}
	}
});

test("ordinary calls retain leading U+FEFF, NUL and supplementary Unicode", () => {
	const f = fixture(), live = new Set();
	f.module._malloc = size => { const pointer = f.allocate(size); live.add(pointer); return pointer; };
	f.module._free = pointer => assert.equal(live.delete(pointer), true);
	f.module._bridge_scalar_frame_clear = () => {};
	const string = { kind: "primitive", name: "string" };
	const signature = { resultMode: "value", parameters: [string], result: string };
	for(const value of values.string)
	{
		const actual = callComponentScalar(f.module, frame => {
			f.module.HEAP8.copyWithin(frame + 16, frame + 32, frame + 48);
			return 0;
		}, signature, [value]);
		assert.equal(actual, value);
		assert.equal(live.size, 0);
	}
});

test("slot writers refresh memory views when allocating copied payloads grows Wasm memory", () => {
	const memory = new WebAssembly.Memory({ initial: 1, maximum: 2 });
	const module = { HEAP8: new Uint8Array(memory.buffer) };
	writeComponentScalarSlot(module, 64, "int", -(1n << 512n), () => {
		memory.grow(1); module.HEAP8 = new Uint8Array(memory.buffer); return 65536;
	});
	assert.equal(readComponentScalarSlot(module, 64, "int"), -(1n << 512n));
});

test("slot readers reject invalid tags, flags, padding, Unicode, integer encodings and buffers", () => {
	const cases = [
		["unit", undefined, (d, s) => d.setBigUint64(s + 8, 1n, true)]
		, ["bool", false, (d, s) => d.setBigUint64(s + 8, 2n, true)]
		, ["float32", 1, (d, s) => d.setUint32(s + 12, 1, true)]
		, ["char", "a", (d, s) => d.setBigUint64(s + 8, 0xd800n, true)]
		, ["char", "a", (d, s) => d.setBigUint64(s + 8, 0x110000n, true)]
		, ["uint8", 0, (d, s) => d.setBigUint64(s + 8, 256n, true)]
		, ["int32", 0, (d, s) => d.setBigUint64(s + 8, 0xffffffffn, true)]
		, ["nat", 1n, (d, s) => d.setUint32(d.getUint32(s + 8, true), 0, true)]
		, ["nat", 1n, (d, s) => d.setUint32(s + 8, d.getUint32(s + 8, true) + 1, true)]
		, ["int", 0n, (d, s) => d.setUint32(s + 4, 1, true)]
		, ["string", "a", (d, s) => d.setUint8(d.getUint32(s + 8, true), 255)]
		, ["bytes", new Uint8Array([1]), (d, s) => d.setUint32(s + 8, 65536, true)]
		, ["bytes", new Uint8Array([1]), (d, s) => d.setUint32(s + 12, scalarCopyLimit + 1, true)]
	];
	for(const [type, value, corrupt] of cases)
	{
		const f = fixture(); f.write(type, value); corrupt(f.view(), f.slot);
		assert.throws(() => f.read(type), undefined, type);
	}
	for(const [type, cases] of Object.entries(values))
	{
		const f = fixture(); f.write(type, cases[0]); f.view().setUint32(f.slot + 4, 4, true);
		assert.throws(() => f.read(type), /flags/);
		f.write(type, cases[0]); f.view().setUint32(f.slot, 99, true);
		assert.throws(() => f.read(type), /type mismatch/);
	}
});

test("callback budget accounting occurs before copying result payloads", () => {
	const f = fixture(), charged = [];
	for(const [type, value, bytes] of [["string", "\uFEFF🌱", 7], ["bytes", new Uint8Array([1, 2]), 2], ["int", -(1n << 128n), 20]])
	{
		f.write(type, value);
		assert.deepEqual(f.read(type, amount => charged.push(amount)), value);
		assert.equal(charged.at(-1), bytes);
		const failure = new Error("budget exhausted");
		assert.throws(() => f.read(type, () => { throw failure; }), error => error === failure);
	}
});
