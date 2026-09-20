/**
 * Copied transport staging in real Wasm memory, without compiled Lean admission.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { componentScalarTypes, scalarCopyLimit } from "../src/abi/component-scalars.mjs";
import { componentCopiedTags, createComponentCopyBudget, snapshotComponentCopiedType } from "../src/abi/component-copied.mjs";
import { compileComponentCopiedCodec } from "../src/release/component-copied-codec.mjs";
import { createComponentPrivateAbi } from "../src/build/component-callable-adapters.mjs";

const primitive = name => ({ kind: "primitive", name });
const apply = (constructor, ...arguments_) => ({ kind: "apply", constructor, arguments: arguments_ });
const array = type => apply("array", type);
const option = type => apply("option", type);
const result = (ok, error) => apply("result", ok, error);
const tuple = (...types) => apply("tuple", ...types);
const none = () => ({ tag: "none" });
const some = value => ({ tag: "some", value });
const unit = primitive("unit"), bool = primitive("bool"), u32 = primitive("uint32");

const fixture = ({ grow = false, failAllocation = Infinity } = {}) => {
	const memory = new WebAssembly.Memory({ initial: 1, maximum: 2048 });
	const module = { HEAP8: new Uint8Array(memory.buffer) }, live = new Set();
	let next = 256, allocations = 0;
	const allocate = bytes => {
		if(++allocations === failAllocation) throw new Error("injected allocation failure");
		const pointer = next; next += Math.ceil(Math.max(bytes, 1) / 8) * 8;
		if(grow || next > memory.buffer.byteLength)
		{
			memory.grow(Math.max(1, Math.ceil((next - memory.buffer.byteLength) / 65536)));
			module.HEAP8 = new Uint8Array(memory.buffer);
		}
		live.add(pointer); return pointer;
	};
	const release = () => { for(const pointer of [...live]) assert.equal(live.delete(pointer), true); };
	return { module, allocate, live, release, slot: 64, view: () => new DataView(memory.buffer) };
};
const roundTrip = (type, value, options) => {
	const f = fixture(options), codec = compileComponentCopiedCodec(type), budget = createComponentCopyBudget();
	try
	{
		codec.write(f.module, f.slot, value, f.allocate, budget);
		return codec.read(f.module, f.slot, budget);
	} finally
	{ f.release(); assert.equal(f.live.size, 0); }
};
const values = {
	unit: [undefined], bool: [false, true]
	, uint8: [0, 255], uint16: [0, 65535], uint32: [0, 0x80000000, 0xffffffff]
	, uint64: [0n, 1n << 53n, (1n << 64n) - 1n]
	, int8: [-128, 127], int16: [-32768, 32767], int32: [-0x80000000, 0x7fffffff]
	, int64: [-(1n << 63n), (1n << 63n) - 1n]
	, nat: [0n, (1n << 5120n) + 17n], int: [0n, -(1n << 5120n)]
	, float32: [0, -0, Math.PI, 2 ** -149, Infinity, -Infinity, NaN]
	, float64: [0, -0, Math.PI, Number.MIN_VALUE, Infinity, -Infinity, NaN]
	, string: ["", "\uFEFF\0🌱\uFEFF", "λ中文é", "e\u0301"]
	, bytes: [new Uint8Array(), new Uint8Array([0, 128, 255])]
	, char: ["\0", "\uFEFF", "🌱", "\u{10ffff}"]
	, usize: [0, 0xffffffff], isize: [-0x80000000, -1, 0x7fffffff]
};

test("copied descriptors are closed, bounded, snapshotted and leave compiler admission blocked", () => {
	const input = array(option(u32)), codec = compileComponentCopiedCodec(input);
	assert.deepEqual(codec.type, input);
	input.arguments.length = 0;
	assert.equal(Object.isFrozen(codec.type.arguments[0].arguments), true);
	assert.deepEqual(roundTrip(codec.type, [none(), some(42)]), [none(), some(42)]);
	for(const type of [array(u32), tuple(u32, bool), option(unit), result(u32, primitive("string"))])
	{
		const document = {
			component: { id: "copied-test" }, types: []
			, declarations: [{ id: "lean:test", kind: "function", parameters: [{ type }], result: { type }, resultMode: "value" }]
		};
		assert.throws(() => createComponentPrivateAbi(document), { code: "unsupported-component-signature" });
	}
	for(const invalid of [
		{ kind: "primitive", name: "future" }, { ...u32, extra: true }
		, { kind: "named", id: "lean:Record" }, { kind: "parameter", id: "T" }
		, apply("callback", u32), apply("resource", u32), apply("list", u32)
		, apply("array"), apply("option", u32, bool), apply("result", u32)
		, tuple(u32), tuple(...Array(33).fill(u32))
		, { kind: "apply", constructor: "array", arguments: new Array(1) }
	]) assert.throws(() => snapshotComponentCopiedType(invalid), /Invalid component copied type/);
	const cycle = array(u32); cycle.arguments[0] = cycle;
	assert.throws(() => snapshotComponentCopiedType(cycle), /cyclic/);
	const large = tuple(...Array(32).fill(tuple(...Array(32).fill(tuple(...Array(32).fill(u32))))));
	assert.throws(() => snapshotComponentCopiedType(large), /node limit/);
});

test("descriptor accessors and sparse argument lists never execute", () => {
	let calls = 0;
	const getter = () => { calls++; throw new Error("getter invoked"); };
	for(const descriptor of [
		Object.defineProperty({ name: "uint32" }, "kind", { get: getter })
		, Object.defineProperty({ kind: "primitive" }, "name", { get: getter })
		, Object.defineProperty({ kind: "apply", constructor: "array" }, "arguments", { get: getter })
		, { kind: "apply", constructor: "array", arguments: Object.defineProperty([u32], 0, { get: getter }) }
	]) assert.throws(() => snapshotComponentCopiedType(descriptor), /Invalid component copied type/);
	assert.equal(calls, 0);
});

test("nested arrays carry all nineteen exact primitive representations", () => {
	assert.deepEqual(Object.keys(values), componentScalarTypes);
	for(const [name, cases] of Object.entries(values))
	{
		const input = [[], cases, cases], expected = name === "float32" ? [[], cases.map(Math.fround), cases.map(Math.fround)] : input;
		const actual = roundTrip(array(array(primitive(name))), input);
		assert.deepEqual(actual, expected, name);
		assert.notEqual(actual, input); assert.notEqual(actual[1], actual[2]);
	}
});

test("Option distinguishes None, Some Unit and all nested Option branches", () => {
	for(const value of [none(), some(undefined)]) assert.deepEqual(roundTrip(option(unit), value), value);
	for(const value of [none(), some(none()), some(some(undefined))])
		assert.deepEqual(roundTrip(option(option(unit)), value), value);
	assert.equal(Object.hasOwn(roundTrip(option(unit), some(undefined)), "value"), true);
	for(const value of [null, undefined, {}, { tag: "none", value: undefined }, { tag: "some" }, { tag: "other" }])
		assert.throws(() => roundTrip(option(unit), value));
});

test("asymmetric Except branches use canonical success/error ordering and remain disjoint", () => {
	for(const [type, cases] of [
		[result(u32, primitive("string")), [{ ok: 42 }, { error: "\uFEFFfailure\0" }]]
		, [result(primitive("string"), u32), [{ ok: "success" }, { error: 0xffffffff }]]
		, [result(option(unit), result(bool, unit)), [{ ok: some(undefined) }, { error: { ok: false } }, { error: { error: undefined } }]]
	]) for(const value of cases) assert.deepEqual(roundTrip(type, value), value);
	for(const value of [{ ok: "wrong" }, { error: 42 }, { ok: 1, error: "both" }, {}, null])
		assert.throws(() => roundTrip(result(u32, primitive("string")), value));
});

test("mixed nested tuples preserve ordering, empty containers and copied bytes", () => {
	const type = tuple(array(u32), tuple(option(unit), primitive("bytes")), result(primitive("nat"), primitive("int")));
	const value = [[], [some(undefined), new Uint8Array([0, 128, 255])], { error: -(1n << 5120n) }];
	assert.deepEqual(roundTrip(type, value), value);
	for(const value of [[], [[], [none()]], [[], [none(), new Uint8Array()], { ok: 0n }, "extra"]])
		assert.throws(() => roundTrip(type, value), /Tuple length/);
});

test("nested allocations may grow Wasm memory without retaining stale views", () => {
	const type = array(tuple(primitive("string"), array(primitive("nat")), option(primitive("bytes"))));
	const value = [["\uFEFF🌱", [0n, 1n << 4096n], some(new Uint8Array([0, 255]))], ["", [], none()]];
	assert.deepEqual(roundTrip(type, value, { grow: true }), value);
});

test("host arrays reject holes, extra fields, accessors, coercions and cycles", () => {
	let called = false;
	const get = () => { called = true; return 1; };
	for(const value of [
		new Array(1), Object.assign([1], { extra: 2 })
		, Object.defineProperty([1], 0, { get })
		, [true], [1n], [0x100000000], new Uint32Array([1])
	]) assert.throws(() => roundTrip(array(u32), value));
	assert.equal(called, false);
	const cycle = []; cycle.push(cycle);
	assert.throws(() => roundTrip(array(array(u32)), cycle), /Cyclic/);
	const getter = Object.defineProperty({ tag: "some" }, "value", { get });
	assert.throws(() => roundTrip(option(unit), getter), /data fields/);
	assert.equal(called, false);
});

test("every primitive remains range checked inside a copied aggregate", () => {
	const invalid = {
		unit: null, bool: 1, uint8: 256, uint16: -1, uint32: 1.5, uint64: 42
		, int8: -129, int16: 32768, int32: 0x80000000, int64: 1n << 63n
		, nat: -1n, int: 0, float32: "0", float64: null, string: "\ud800"
		, bytes: [1], char: "two", usize: 0x100000000, isize: 0x80000000
	};
	for(const [name, value] of Object.entries(invalid)) assert.throws(() => roundTrip(array(primitive(name)), [value]), undefined, name);
});

test("copy budgets include all slots, UTF-8 bytes and integer limbs across arguments and results", () => {
	const type = tuple(primitive("string"), primitive("nat")), value = ["🌱\uFEFF\0", 1n << 64n];
	const f = fixture(), codec = compileComponentCopiedCodec(type), budget = createComponentCopyBudget(136);
	try
	{
		codec.write(f.module, f.slot, value, f.allocate, budget);
		assert.equal(budget.used, 16 + 32 + 8 + 12);
		assert.deepEqual(codec.read(f.module, f.slot, budget), value);
		assert.equal(budget.used, 136);
		assert.throws(() => codec.read(f.module, f.slot, budget), /budget/);
		assert.throws(() => compileComponentCopiedCodec(array(unit)).write(f.module, f.slot, new Array(0xffffffff), f.allocate), /budget/);
	} finally
{ f.release(); }
	for(const limit of [-1, 0.5, NaN, Infinity, scalarCopyLimit + 1]) assert.throws(() => createComponentCopyBudget(limit), /budget/);
	const empty = createComponentCopyBudget(0);
	for(const amount of [-1, 0.5, NaN, Infinity, 1]) assert.throws(() => empty.charge(amount), /budget/);
	assert.equal(empty.used, 0);
});

test("read charges container storage before allocating a host array", () => {
	const f = fixture(), codec = compileComponentCopiedCodec(array(bool));
	try
	{
		codec.write(f.module, f.slot, [true, false], f.allocate);
		assert.throws(() => codec.read(f.module, f.slot, createComponentCopyBudget(16)), /budget/);
	} finally
{ f.release(); }
});

test("depth 32 is supported and deeper type trees are rejected before allocation", () => {
	let type = u32, value = 42;
	for(let index = 0; index < 32; index++)
{ type = option(type); value = some(value); }
	assert.deepEqual(roundTrip(type, value), value);
	assert.throws(() => compileComponentCopiedCodec(option(type)), /nesting/);
});

test("decoding retains no aliases to input arrays or native byte buffers", () => {
	const f = fixture(), codec = compileComponentCopiedCodec(array(primitive("bytes"))), input = [new Uint8Array([1, 2])];
	try
	{
		codec.write(f.module, f.slot, input, f.allocate);
		input[0].fill(7);
		const actual = codec.read(f.module, f.slot);
		f.module.HEAP8.fill(99);
		assert.deepEqual(actual, [new Uint8Array([1, 2])]);
	} finally
{ f.release(); }
});

test("malformed wire tags, flags, bounds and constructor counts fail before dereference", () => {
	const cases = [
		[array(u32), [1], (d, s) => d.setUint32(s, 31, true)]
		, [array(u32), [1], (d, s) => d.setUint32(s + 4, 1, true)]
		, [array(u32), [1], (d, s) => d.setUint32(s + 4, 4, true)]
		, [array(u32), [1], (d, s) => d.setUint32(s + 8, 0, true)]
		, [array(u32), [1], (d, s) => d.setUint32(s + 8, 257, true)]
		, [array(u32), [1], (d, s) => d.setUint32(s + 8, 65536, true)]
		, [array(u32), [1], (d, s) => d.setUint32(s + 12, 0xffffffff, true)]
		, [array(u32), [], (d, s) => d.setUint32(s + 8, 256, true)]
		, [tuple(u32, u32), [1, 2], (d, s) => d.setUint32(s + 12, 1, true)]
		, [option(unit), none(), (d, s) => d.setUint32(s + 4, 2, true)]
		, [option(unit), some(undefined), (d, s) => d.setUint32(s + 4, 0, true)]
		, [result(u32, bool), { ok: 2 }, (d, s) => d.setUint32(s + 4, 1, true)]
		, [result(u32, bool), { ok: 2 }, (d, s) => d.setUint32(s + 12, 0, true)]
		, [array(bool), [true], (d, s) => d.setBigUint64(d.getUint32(s + 8, true) + 8, 2n, true)]
	];
	for(const [type, value, corrupt] of cases)
	{
		const f = fixture(), codec = compileComponentCopiedCodec(type);
		try
{ codec.write(f.module, f.slot, value, f.allocate); corrupt(f.view(), f.slot); assert.throws(() => codec.read(f.module, f.slot)); }
		finally
{ f.release(); }
	}
});

test("wire cycles and invalid root or allocator addresses are rejected", () => {
	const f = fixture(), codec = compileComponentCopiedCodec(array(array(u32)));
	try
	{
		codec.write(f.module, f.slot, [[1]], f.allocate);
		f.view().setUint32(f.slot + 8, f.slot, true);
		assert.throws(() => codec.read(f.module, f.slot), /Cyclic/);
		for(const address of [0, -8, 1, 64.5, 65536, NaN, Infinity])
		{
			assert.throws(() => codec.read(f.module, address), /buffer/);
			assert.throws(() => codec.write(f.module, address, [], f.allocate), /buffer/);
		}
		assert.throws(() => codec.write(f.module, f.slot, [[1]], () => 0), /buffer/);
	} finally
{ f.release(); }
});

test("partial input failures leave every allocation with the caller's arena", () => {
	const type = array(tuple(primitive("string"), primitive("bytes")));
	const value = [["one", new Uint8Array([1])], ["two", new Uint8Array([2])]];
	for(let failAllocation = 1; failAllocation <= 7; failAllocation++)
	{
		const f = fixture({ failAllocation }), codec = compileComponentCopiedCodec(type);
		try
{ assert.throws(() => codec.write(f.module, f.slot, value, f.allocate), /injected allocation failure/); }
		finally
{ f.release(); assert.equal(f.live.size, 0); }
	}
	const f = fixture(), codec = compileComponentCopiedCodec(type);
	try
{ assert.throws(() => codec.write(f.module, f.slot, [...value, ["bad", null]], f.allocate), /Expected bytes/); }
	finally
{ f.release(); assert.equal(f.live.size, 0); }
	assert.deepEqual(roundTrip(type, value), value);
});

test("the independent slot layout keeps constructor tags private", () => {
	assert.deepEqual(componentCopiedTags, { array: 32, tuple: 33, option: 34, result: 35 });
	const f = fixture(), codec = compileComponentCopiedCodec(option(u32));
	try
	{
		codec.write(f.module, f.slot, some(42), f.allocate);
		assert.deepEqual([...new Uint32Array(f.module.HEAP8.buffer, f.slot, 4)], [34, 1, 256, 1]);
		assert.deepEqual([...new Uint32Array(f.module.HEAP8.buffer, 256, 4)], [4, 0, 42, 0]);
	} finally
	{ f.release(); }
});

test("independently populated native-owned slots decode without consulting the writer", () => {
	const f = fixture(), data = f.view();
	// Array (Option Unit): [None, Some ()]. Parent/child tables are native-owned.
	data.setUint32(64, 32, true); data.setUint32(68, 2, true);
	data.setUint32(72, 256, true); data.setUint32(76, 2, true);
	data.setUint32(256, 34, true);
	data.setUint32(272, 34, true); data.setUint32(276, 3, true);
	data.setUint32(280, 320, true); data.setUint32(284, 1, true);
	assert.deepEqual(compileComponentCopiedCodec(array(option(unit))).read(f.module, 64), [none(), some(undefined)]);
	// Except String UInt32 uses the success payload first in the descriptor.
	data.setUint32(64, 35, true); data.setUint32(68, 2, true);
	data.setUint32(72, 256, true); data.setUint32(76, 1, true);
	f.module.HEAP8.fill(0, 256, 272);
	data.setUint32(256, 4, true); data.setUint32(264, 0xffffffff, true);
	assert.deepEqual(compileComponentCopiedCodec(result(u32, primitive("string"))).read(f.module, 64), { ok: 0xffffffff });
	data.setUint32(68, 3, true); data.setUint32(256, 14, true);
	data.setUint32(260, 2, true); data.setUint32(264, 320, true); data.setUint32(268, 4, true);
	f.module.HEAP8.set([0xef, 0xbb, 0xbf, 0], 320);
	assert.deepEqual(compileComponentCopiedCodec(result(u32, primitive("string"))).read(f.module, 64), { error: "\uFEFF\0" });
});
