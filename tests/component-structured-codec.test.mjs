/**
 * Synthetic named-type transport in real Wasm memory, not installed Lean evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { componentScalarTypes, scalarSlotBytes } from "../src/abi/component-scalars.mjs";
import { snapshotComponentCopiedType, createComponentCopyBudget } from "../src/abi/component-copied.mjs";
import { compileComponentCopiedCodec } from "../src/release/component-copied-codec.mjs";
import { createComponentPrivateAbi } from "../src/build/component-callable-adapters.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { validateBindingIr } from "../src/binding-ir/contract.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";

const primitive = name => ({ kind: "primitive", name });
const apply = (constructor, ...args) => ({ kind: "apply", constructor, arguments: args });
const alias = (id, target) => ({ kind: "alias", id: `lean:Shapes.${id}`, target });
const variant = (id, cases) => ({ kind: "variant", id: `lean:Shapes.${id}`, cases: Object.entries(cases).map(([name, fields]) => ({ name, fields: Object.entries(fields).map(([name, type]) => ({ name, type })) })) });
const u32 = primitive("uint32"), unit = primitive("unit"), bytes = primitive("bytes");
const sample = () => variant("Event", {
	idle: {}, stopped: {}, unit: { value: unit }
	, ready: { count: alias("Count", u32), data: bytes }
	, failed: { reason: primitive("string"), retry: apply("option", unit) } });
const fixture = ({ grow = false, failAt = Infinity } = {}) => {
	const memory = new WebAssembly.Memory({ initial: 1, maximum: 2048 });
	const module = { HEAP8: new Uint8Array(memory.buffer) }, live = new Set();
	let next = 256, attempts = 0;
	const allocate = bytes => {
		if(++attempts === failAt) throw new Error("injected allocation failure");
		const pointer = next; next += Math.ceil(Math.max(bytes, 1) / 8) * 8;
		if(grow || next > memory.buffer.byteLength)
		{
			memory.grow(Math.max(1, Math.ceil((next - memory.buffer.byteLength) / 65536)));
			module.HEAP8 = new Uint8Array(memory.buffer);
		}
		live.add(pointer); return pointer;
	};
	const release = () => { for(const pointer of [...live]) assert.ok(live.delete(pointer)); };
	return { module, allocate, release, live, attempts: () => attempts, slot: 64, view: () => new DataView(memory.buffer) };
};
const roundTrip = (type, value, options) => {
	const f = fixture(options), codec = compileComponentCopiedCodec(type);
	try
	{ codec.write(f.module, f.slot, value, f.allocate); return codec.read(f.module, f.slot); }
	finally
	{ f.release(); assert.equal(f.live.size, 0); }
};

test("aliases retain names in immutable descriptors and reuse exact value codecs", () => {
	const type = alias("Rows", apply("list", alias("Count", primitive("uint32")))), codec = compileComponentCopiedCodec(type);
	assert.deepEqual(codec.type, type);
	assert.ok(Object.isFrozen(codec.type.target.arguments[0]));
	type.id = "lean:Shapes.Changed"; type.target.arguments[0].target.name = "bool";
	assert.equal(codec.type.id, "lean:Shapes.Rows");
	assert.deepEqual(roundTrip(codec.type, [0, 0xffffffff, 0]), [0, 0xffffffff, 0]);
	assert.throws(() => roundTrip(codec.type, [true]), /uint32/);
	assert.deepEqual(roundTrip(alias("Unit", unit), undefined), undefined);
});

test("variant constructors preserve empty cases, Unit presence and their own fields", () => {
	const type = sample(), inputs = [
		{ kind: "idle" }, { kind: "stopped" }, { kind: "unit", value: undefined }
		, { kind: "ready", count: 0xffffffff, data: new Uint8Array([0, 128, 255]) }
		, { kind: "failed", reason: "\uFEFF\0λ🌱", retry: { tag: "none" } }
		, { kind: "failed", reason: "", retry: { tag: "some", value: undefined } }];
	for(const input of inputs) assert.deepEqual(roundTrip(type, input, { grow: true }), input);
	assert.equal(Object.hasOwn(roundTrip(type, inputs[2]), "value"), true);
	assert.notDeepEqual(roundTrip(type, inputs[0]), roundTrip(type, inputs[1]));
});

test("every primitive composes inside a constructor with its existing exact mapping", () => {
	const values = {
		unit: [undefined], bool: [false, true]
		, uint8: [0, 255], uint16: [0, 65535], uint32: [0, 0xffffffff]
		, uint64: [0n, (1n << 64n) - 1n], int8: [-128, 127], int16: [-32768, 32767]
		, int32: [-0x80000000, 0x7fffffff], int64: [-(1n << 63n), (1n << 63n) - 1n]
		, nat: [0n, (1n << 5120n) + 17n], int: [0n, -((1n << 5120n) + 17n)]
		, float32: [0, -0, Math.PI, 2 ** -149, Infinity, -Infinity, NaN]
		, float64: [0, -0, Math.PI, Number.MIN_VALUE, Infinity, -Infinity, NaN]
		, string: ["", "\0λ🌿\uFEFF"]
		, bytes: [new Uint8Array(), new Uint8Array([0, 255, 128])]
		, char: ["\0", "\u{10ffff}"], usize: [0, 0xffffffff]
		, isize: [-0x80000000, 0x7fffffff]
	};
	assert.deepEqual(Object.keys(values), componentScalarTypes);
	for(const [name, cases] of Object.entries(values))
		for(const value of cases)
		{
			const type = variant("Scalar", { absent: {}, value: { payload: alias("Element", primitive(name)) } });
			assert.deepEqual(roundTrip(type, { kind: "value", payload: value }), { kind: "value", payload: name === "float32" ? Math.fround(value) : value }, name);
		}
});

test("variants nest with arrays, Lists, records, aliases, products and asymmetric branches", () => {
	const event = sample(), type = {
		kind: "record", id: "lean:Shapes.Packet"
		, fields: [
			{ name: "rows", type: apply("array", apply("list", alias("EventName", event))) }
			, { name: "branch", type: apply("result", event, apply("tuple", unit, event)) }
		]
	};
	const ready = { kind: "ready", count: 7, data: new Uint8Array([1, 2]) };
	for(const branch of [{ ok: ready }, { error: [undefined, { kind: "stopped" }] }])
	{
		const input = { rows: [[], [ready, ready]], branch }, actual = roundTrip(type, input, { grow: true });
		assert.deepEqual(actual, input); assert.notEqual(actual.rows, input.rows);
		assert.notEqual(actual.rows[1][0].data, actual.rows[1][1].data);
		actual.rows[1][0].data[0] = 99;
		assert.equal(actual.rows[1][1].data[0], 1); assert.equal(ready.data[0], 1);
	}
});

test("host values reject unknown constructors, mismatched fields, coercion and accessors", () => {
	let reads = 0;
	const getter = () => { reads++; throw new Error("must not execute"); };
	for(const input of [
		null, undefined, 3, [], {}, { kind: 0 }, { kind: "unknown" }
		, { kind: "idle", value: undefined }
		, { kind: "unit" }, { kind: "ready", count: true, data: new Uint8Array() }
		, { kind: "ready", count: 1, data: new Uint8Array(), reason: "inactive" }
		, Object.defineProperty({}, "kind", { get: getter })
		, Object.defineProperty({ kind: "unit" }, "value", { get: getter })
		, Object.assign(Object.create({ kind: "unit" }), { value: undefined })
		, Object.assign({ kind: "idle" }, { [Symbol("extra")]: 1 })])
		assert.throws(() => roundTrip(sample(), input));
	assert.equal(reads, 0);
});

test("descriptor cases, fields and aliases are closed, bounded and snapshotted", () => {
	const type = sample(), codec = compileComponentCopiedCodec(type);
	type.cases[0].name = "changed"; type.cases[3].fields.length = 0;
	assert.equal(codec.type.cases[0].name, "idle"); assert.equal(codec.type.cases[3].fields.length, 2);
	assert.ok(Object.isFrozen(codec.type.cases[3].fields[0].type));
	for(const change of [
		value => { value.extra = true; }, value => { value.id = "not-a-lean-type"; }
		, value => { value.cases = []; }, value => { value.cases = new Array(1); }
		, value => { value.cases.push(value.cases[0]); }
		, value => { value.cases[0].name = "bad-name"; }
		, value => { value.cases[0].fields = [{ name: "kind", type: unit }]; }
		, value => { value.cases[0].fields = [{ name: "__proto__", type: unit }]; }
		, value => { value.cases[0].fields = [{ name: "x", type: unit }, { name: "x", type: unit }]; }
		, value => { value.cases[0].extra = true; }
	]) { const candidate = sample(); change(candidate); assert.throws(() => snapshotComponentCopiedType(candidate)); }
	const cycle = alias("A", unit); cycle.target = apply("list", alias("A", unit));
	assert.throws(() => snapshotComponentCopiedType(cycle), /cyclic alias/);
	cycle.target = cycle; assert.throws(() => snapshotComponentCopiedType(cycle), /cyclic/);
	const recursive = variant("Tree", { node: {} }); recursive.cases[0].fields.push({ name: "next", type: recursive });
	assert.throws(() => snapshotComponentCopiedType(recursive), /cyclic/);
	const wide = variant("Wide", Object.fromEntries(Array.from({ length: 1025 }, (_, index) => [`v${index}`, {}])));
	assert.throws(() => snapshotComponentCopiedType(wide), /variant cases/);
});

test("descriptor accessors are rejected without running user code", () => {
	let calls = 0;
	const getter = () => { calls++; throw new Error("must not execute"); };
	for(const value of [
		Object.defineProperty({ kind: "alias", id: "lean:Shapes.A" }, "target", { get: getter })
		, Object.defineProperty({ kind: "variant", id: "lean:Shapes.V" }, "cases", { get: getter })
		, { kind: "variant", id: "lean:Shapes.V", cases: Object.defineProperty([{}], 0, { get: getter }) }
		, { kind: "variant", id: "lean:Shapes.V", cases: [Object.defineProperty({ name: "one" }, "fields", { get: getter })] }
		, { kind: "variant", id: "lean:Shapes.V", cases: [{ name: "one", fields: Object.defineProperty([{}], 0, { get: getter }) }] }
	]) assert.throws(() => snapshotComponentCopiedType(value));
	assert.equal(calls, 0);
});

test("wire cases decode independently of the writer and reject malformed branch layouts", () => {
	const f = fixture(), codec = compileComponentCopiedCodec(sample());
	const set = (kind, flags, pointer, count) => [kind, flags, pointer, count].forEach((value, i) => f.view().setUint32(f.slot + 4 * i, value, true));
	// Case 2 has a Unit field. Case indices are private transport ordinals,
	// not Lean constructor numbers. Bit one is ownership; bit zero is reserved.
	set(37, 2 * 4 | 2, 256, 1);
	assert.deepEqual(codec.read(f.module, f.slot), { kind: "unit", value: undefined });
	set(37, 1 * 4, 0, 0); assert.deepEqual(codec.read(f.module, f.slot), { kind: "stopped" });
	for(const wire of [
		[36, 0, 0, 0], [37, 1, 0, 0], [37, 5 * 4, 0, 0]
		, [37, 0xfffffffc, 0, 0]
		, [37, 2 * 4, 0xffffffff, 0], [37, 2 * 4, 0, 1], [37, 2 * 4, 257, 1]
		, [37, 2 * 4, 65536, 1], [37, 0, 256, 0], [37, 2, 0, 0]
		, [37, 2 * 4, 256, 2]
	]) { set(...wire); assert.throws(() => codec.read(f.module, f.slot)); }
	set(37, 2 * 4, 256, 1); f.view().setUint32(256, 2, true);
	assert.throws(() => codec.read(f.module, f.slot), /type mismatch/);
});

test("constructor ordinals do not truncate at the Option/Except one-bit branch", () => {
	const type = variant("Wide", Object.fromEntries(Array.from({ length: 1024 }, (_, index) => [`v${index}`, {}])));
	for(const index of [0, 1, 2, 255, 256, 1023]) assert.deepEqual(roundTrip(type, { kind: `v${index}` }), { kind: `v${index}` });
});

test("copy limits charge only active payloads and cover aggregate slots and bytes", () => {
	const type = alias("Choice", variant("Budget", { empty: {}, small: { value: u32 }, large: { data: bytes } }));
	const codec = compileComponentCopiedCodec(type), f = fixture();
	const budget = createComponentCopyBudget(2 * scalarSlotBytes);
	codec.write(f.module, f.slot, { kind: "empty" }, f.allocate, budget);
	assert.deepEqual(codec.read(f.module, f.slot, budget), { kind: "empty" }); assert.equal(f.attempts(), 0);
	assert.throws(() => codec.write(f.module, f.slot, { kind: "small", value: 1 }, f.allocate, createComponentCopyBudget(31)), /budget/);
	const valid = createComponentCopyBudget(66);
	codec.write(f.module, f.slot, { kind: "large", data: new Uint8Array([255]) }, f.allocate, valid);
	assert.deepEqual(codec.read(f.module, f.slot, valid), { kind: "large", data: new Uint8Array([255]) });
	assert.equal(valid.used, 66);
	assert.throws(() => codec.read(f.module, f.slot, createComponentCopyBudget(32)), /budget/);
	f.release(); assert.equal(f.live.size, 0);
});

test("partial writes and injected allocation failures leave cleanup with the input arena", () => {
	const type = variant("Rows", { empty: {}, rows: { values: apply("list", sample()) } });
	const input = { kind: "rows", values: [{ kind: "ready", count: 1, data: new Uint8Array([7]) }, { kind: "failed", reason: "text", retry: { tag: "some", value: undefined } }] };
	const codec = compileComponentCopiedCodec(type), baseline = fixture();
	codec.write(baseline.module, baseline.slot, input, baseline.allocate);
	const count = baseline.attempts(); assert.ok(count >= 7); baseline.release();
	for(let failAt = 1; failAt <= count; failAt++)
	{
		const f = fixture({ failAt, grow: true });
		assert.throws(() => codec.write(f.module, f.slot, input, f.allocate), /injected allocation failure/);
		assert.equal(f.attempts(), failAt); f.release(); assert.equal(f.live.size, 0);
		codec.write(f.module, f.slot, { kind: "empty" }, f.allocate);
		assert.deepEqual(codec.read(f.module, f.slot), { kind: "empty" });
	}
	const bad = structuredClone(input); bad.values[1].retry = { tag: "invalid" };
	const f = fixture(); assert.throws(() => codec.write(f.module, f.slot, bad, f.allocate));
	assert.ok(f.live.size > 0); f.release(); assert.equal(f.live.size, 0);
});

test("type depth and host or wire cycles reject before recursive traversal", () => {
	let type = u32, value = 42;
	for(let depth = 0; depth < 32; depth++)
	{ type = variant(`V${depth}`, { next: { value: type } }); value = { kind: "next", value }; }
	assert.deepEqual(roundTrip(type, value), value);
	assert.throws(() => compileComponentCopiedCodec(alias("TooDeep", type)), /nesting/);
	const shallow = variant("Outer", { node: { next: variant("Inner", { leaf: {} }) } });
	const cyclic = { kind: "node" }; cyclic.next = cyclic;
	assert.throws(() => roundTrip(shallow, cyclic), /Cyclic copied value/);
	const f = fixture(), codec = compileComponentCopiedCodec(shallow);
	[37, 0, f.slot, 1].forEach((value, index) => f.view().setUint32(f.slot + 4 * index, value, true));
	assert.throws(() => codec.read(f.module, f.slot), /Cyclic copied wire value/);
});

test("named npm types select ABI 7 while native surfaces resolve aliases but reject variants", () => {
	const ir = corpusReviewedIr({ id: "shapes" }, [{ name: "Shapes.echo", parameters: ["uint32"], result: "uint32" }]);
	const documentation = { summary: "Unimplemented compiled shape.", details: "" };
	const type = {
		id: "lean:Shapes.Value", name: "Value", kind: "alias"
		, representation: "copied", mutability: "immutable"
		, typeParameters: [], fields: [], target: u32, resource: null
		, callable: null, cases: [], host: null, documentation
		, source: { producer: "corpusReview"
			, declaration: "Shapes.Value", extensions: {} }
		, assurance: [] };
	ir.types = [type]; ir.declarations[0].parameters[0].type = { kind: "named", id: type.id }; ir.declarations[0].result.type = { kind: "named", id: type.id };
	for(const kind of ["alias", "variant"])
	{
		if(kind === "variant")
		{ type.kind = kind; type.target = null; type.cases = [{ name: "empty", fields: [], documentation }]; }
		assert.equal(validateBindingIr(ir), ir);
		assert.equal(createComponentPrivateAbi(ir).version, 7);
		if(kind === "alias")
		{
			const surface = compilePrimitiveCSurface(ir, { compounds: true, lists: true });
			assert.equal(surface.copy({ kind: "named", id: type.id }), surface.copy(u32));
			assert.equal(surface.copies.length, 1);
		} else assert.throws(() => compilePrimitiveCSurface(ir, { compounds: true, lists: true }), /requires concrete copied/);
	}
});
