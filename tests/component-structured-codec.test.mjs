/**
 * Synthetic named-type transport in real Wasm memory, not installed Lean evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { componentScalarTypes, scalarSlotBytes } from "../src/abi/component-scalars.mjs";
import { snapshotComponentCopiedType, createComponentCopyBudget } from "../src/abi/component-copied.mjs";
import { snapshotComponentCopiedGraph, compileComponentCopiedGraph, componentRecursiveLimits, createComponentRecursiveBudget } from "../src/abi/component-recursive.mjs";
import { compileComponentCopiedCodec } from "../src/release/component-copied-codec.mjs";
import { compileComponentRecursiveCodec } from "../src/release/component-recursive-codec.mjs";
import { createComponentPrivateAbi } from "../src/build/component-callable-adapters.mjs";
import { componentRecursiveTypeGraph, assertComponentRecursiveTypeGraph } from "../src/build/component-recursive-types.mjs";
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

const named = name => ({ kind: "named", id: `lean:Shapes.${name}` });
const graph = (root, types) => ({ schemaVersion: 1, root, types });
const treeGraph = () => graph(named("Tree"), [
	alias("Forest", apply("list", named("Tree")))
	, { kind: "record", id: named("Box").id, fields: [{ name: "title", type: primitive("string") }, { name: "next", type: apply("option", named("Tree")) }] }
	, variant("Tree", {
		fork: { left: named("Tree"), right: named("Tree") }, leaf: { value: u32 }
		, forest: { children: named("Forest") }, boxed: { box: named("Box") }
		, empty: {}
		, unit: { value: unit }
		, result: { value: apply("result", named("Tree"), primitive("string")) }
		, pair: { value: apply("tuple", apply("option", named("Tree")), named("Tree")) }
	})
]);
const chainGraph = () => graph(named("Chain"), [variant("Chain", { next: { value: named("Chain") }, end: {} })]);
const chainValue = depth => {
	let value = { kind: "end" };
	for(let index = 0; index < depth; index++) value = { kind: "next", value };
	return value;
};
const recursiveRoundTrip = (descriptor, input, options) => {
	const f = fixture(options), codec = compileComponentRecursiveCodec(descriptor);
	try
	{ codec.write(f.module, f.slot, input, f.allocate); return codec.read(f.module, f.slot); }
	finally
	{ f.release(); assert.equal(f.live.size, 0); }
};

test("finite copied graphs retain recursive names without expanding or mutating definitions", () => {
	const input = treeGraph(), before = JSON.stringify(input), compiled = compileComponentCopiedGraph(input);
	assert.equal(JSON.stringify(input), before);
	assert.equal(compiled.graph.types.length, 3);
	assert.deepEqual(compiled.graph.types.map(type => type.id), ["lean:Shapes.Box", "lean:Shapes.Forest", "lean:Shapes.Tree"]);
	assert.equal(compiled.resolve(compiled.graph.root).cases[0].fields[0].type.id, "lean:Shapes.Tree");
	assert.equal(compiled.resolve(named("Forest")).constructor, "list");
	const immutable = value => {
		if(!value || typeof value !== "object") return;
		assert.equal(Object.isFrozen(value), true);
		for(const child of Object.values(value)) immutable(child);
	};
	immutable(compiled.graph);
	input.types[2].cases[0].name = "changed"; input.types[0].target.arguments.length = 0; input.root.id = "lean:Shapes.Missing";
	assert.equal(compiled.resolve(compiled.graph.root).cases[0].name, "fork");
	assert.equal(compiled.resolve(named("Forest")).arguments[0].id, "lean:Shapes.Tree");
	assert.deepEqual(snapshotComponentCopiedGraph(compiled.graph), compiled.graph);
});

test("graph aliases reject direct, mutual and container-hidden cycles but allow nominal recursion", () => {
	for(const types of [
		[alias("A", named("A"))]
		, [alias("A", named("B")), alias("B", named("A"))]
		, [alias("A", apply("list", named("B"))), alias("B", apply("option", named("A")))]
		, [alias("A", apply("result", u32, named("B"))), alias("B", apply("tuple", unit, named("A")))]
	]) assert.throws(() => snapshotComponentCopiedGraph(graph(unit, types)), /cyclic alias/);
	const types = Array.from({ length: 1000 }, (_, index) => alias(`A${index}`, index === 999 ? u32 : named(`A${index + 1}`)));
	assert.equal(compileComponentCopiedGraph(graph(named("A0"), types)).resolve(named("A0")).name, "uint32");
	assert.equal(recursiveRoundTrip(graph(named("A0"), types), 42), 42);
	types[999].target = named("A900");
	assert.throws(() => snapshotComponentCopiedGraph(graph(named("A0"), types)), /cyclic alias/);
	assert.doesNotThrow(() => snapshotComponentCopiedGraph(treeGraph()));
});

test("copied graphs reject identity types, malformed references and non-data descriptors", () => {
	for(const mutate of [
		value => { value.schemaVersion = "1"; }, value => { value.extra = true; }
		, value => { value.root = named("Missing"); }
		, value => { value.types.push(value.types[0]); }
		, value => { value.types[0].id = "not-a-lean-name"; }
		, value => { value.types[0].target = { kind: "parameter", id: "T" }; }
		, value => { value.types[0].target = { kind: "resource", id: "lean:Shapes.Handle" }; }
		, value => { value.types[0].kind = "callback"; }
		, value => { value.types[0].target = apply("array", u32, unit); }
		, value => { value.types[0].target = apply("tuple", u32); }
		, value => { value.types[0].target = apply("function", u32); }
		, value => { value.types[2].cases = []; }
		, value => { value.types[2].cases.push(value.types[2].cases[0]); }
		, value => { value.types[2].cases[0].fields[0].name = "kind"; }
		, value => { value.types[1].fields[0].name = "__proto__"; }
		, value => { value.types[1].fields[0].name = "constructor"; }
		, value => { value.types[1].fields[0].name = "prototype"; }
		, value => { value.types[1].fields.push(value.types[1].fields[0]); }
		, value => { value.types[1].fields[0].extra = true; }
		, value => { value.types[2].cases[0].name = "bad-name"; }
		, value => { value.types[2].cases[0].fields[0].type.extra = true; }
	]) {
		const candidate = treeGraph(); mutate(candidate);
		assert.throws(() => snapshotComponentCopiedGraph(candidate), /Invalid component copied graph/);
	}
	for(const root of [null, undefined, false, 1, "named", [], new Date(), { kind: "primitive", name: "future" }])
		assert.throws(() => snapshotComponentCopiedGraph(graph(root, [])), /Invalid component copied graph/);
	const cyclic = apply("option", unit); cyclic.arguments[0] = cyclic;
	assert.throws(() => snapshotComponentCopiedGraph(graph(cyclic, [])), /cyclic JavaScript descriptor/);
});

test("recursive descriptor accessors and sparse tables never execute", () => {
	let reads = 0;
	const accessor = { get: () => { reads++; throw new Error("must not execute"); } };
	for(const mutate of [
		value => Object.defineProperty(value, "schemaVersion", accessor)
		, value => Object.defineProperty(value, "root", accessor)
		, value => Object.defineProperty(value, "types", accessor)
		, value => Object.defineProperty(value.root, "kind", accessor)
		, value => Object.defineProperty(value.root, "id", accessor)
		, value => Object.defineProperty(value.types, 0, accessor)
		, value => Object.defineProperty(value.types[0], "target", accessor)
		, value => Object.defineProperty(value.types[0].target, "constructor", accessor)
		, value => Object.defineProperty(value.types[0].target.arguments, 0, accessor)
		, value => Object.defineProperty(value.types[2], "cases", accessor)
		, value => Object.defineProperty(value.types[2].cases, 0, accessor)
		, value => Object.defineProperty(value.types[2].cases[0], "fields", accessor)
		, value => Object.defineProperty(value.types[2].cases[0].fields[0], "type", accessor)
		, value => { delete value.types[0]; }
		, value => { delete value.types[0].target.arguments[0]; }
		, value => { delete value.types[2].cases[0]; }
		, value => { delete value.types[2].cases[0].fields[0]; }
	]) { const candidate = treeGraph(); mutate(candidate); assert.throws(() => snapshotComponentCopiedGraph(candidate)); }
	assert.equal(reads, 0);
});

test("descriptor depth, table and total-node bounds apply to finite syntax, not unfolded recursion", () => {
	let root = unit;
	for(let index = 0; index < componentRecursiveLimits.schemaDepth; index++) root = apply("option", root);
	assert.doesNotThrow(() => snapshotComponentCopiedGraph(graph(root, [])));
	assert.throws(() => snapshotComponentCopiedGraph(graph(apply("option", root), [])), /nesting/);
	const many = Array.from({ length: 1025 }, (_, index) => alias(`N${index}`, unit));
	assert.throws(() => snapshotComponentCopiedGraph(graph(unit, many)), /bounded dense table/);
	const wide = Array.from({ length: 4 }, (_, index) => ({
		kind: "record", id: named(`R${index}`).id
		, fields: Array.from({ length: 1024 }, (_, field) => ({ name: `v${field}`, type: unit })) }));
	assert.throws(() => snapshotComponentCopiedGraph(graph(unit, wide)), /node limit/);
	const tooWide = variant("Many", Object.fromEntries(Array.from({ length: 1025 }, (_, index) => [`c${index}`, {}])));
	assert.throws(() => snapshotComponentCopiedGraph(graph(named("Many"), [tooWide])), /bounded dense table/);
	// Recursive edges are references, so neither a recursive schema nor its JSON snapshot expands.
	assert.ok(JSON.stringify(snapshotComponentCopiedGraph(chainGraph())).length < 400);
});

test("recursive values compose through mutually recursive records, aliases and every container", () => {
	const leaf = { kind: "leaf", value: 0xffffffff }, empty = { kind: "empty" };
	const values = [leaf, empty, { kind: "unit", value: undefined }
		, { kind: "fork", left: leaf, right: leaf }, { kind: "forest", children: [] }
		, { kind: "forest", children: [{ kind: "boxed", box: { title: "\uFEFF🌱\0", next: { tag: "some", value: leaf } } }, empty] }
		, { kind: "boxed", box: { title: "", next: { tag: "none" } } }
		, { kind: "result", value: { ok: { kind: "forest", children: [leaf] } } }
		, { kind: "result", value: { error: "error\0" } }
		, { kind: "pair", value: [{ tag: "some", value: empty }, leaf] }
		, { kind: "pair", value: [{ tag: "none" }, { kind: "unit", value: undefined }] }];
	for(const value of values) assert.deepEqual(recursiveRoundTrip(treeGraph(), value, { grow: true }), value);
	const rows = treeGraph(); rows.root = apply("array", apply("list", rows.root));
	assert.deepEqual(recursiveRoundTrip(rows, [[], values]), [[], values]);
});

test("recursive payloads preserve all nineteen scalar codecs without narrowing", () => {
	const values = {
		unit: undefined, bool: true, uint8: 255, uint16: 65535, uint32: 0xffffffff
		, uint64: (1n << 64n) - 1n
		, int8: -128
		, int16: -32768
		, int32: -0x80000000
		, int64: -(1n << 63n)
		, nat: (1n << 5120n) + 17n, int: -(1n << 5120n), float32: -0, float64: NaN
		, string: "\uFEFF\0λ🌱"
		, bytes: new Uint8Array([0, 128, 255])
		, char: "\u{10ffff}"
		, usize: 0xffffffff
		, isize: -0x80000000 };
	assert.deepEqual(Object.keys(values), componentScalarTypes);
	for(const [name, payload] of Object.entries(values))
	{
		const descriptor = graph(named("Value"), [variant("Value", { more: { next: named("Value") }, data: { payload: primitive(name) } })]);
		const input = { kind: "more", next: { kind: "data", payload } };
		assert.deepEqual(recursiveRoundTrip(descriptor, input), input, name);
	}
	const descriptor = graph(named("Value"), [variant("Value", { more: { next: named("Value") }, data: { payload: apply("option", apply("option", unit)) } })]);
	for(const payload of [{ tag: "none" }, { tag: "some", value: { tag: "none" } }, { tag: "some", value: { tag: "some", value: undefined } }])
	{
		const input = { kind: "more", next: { kind: "data", payload } };
		assert.deepEqual(recursiveRoundTrip(descriptor, input), input);
	}
});

test("recursive shared subtrees are independent copies while ancestor cycles reject", () => {
	const shared = { kind: "boxed", box: { title: "shared", next: { tag: "none" } } };
	const input = { kind: "fork", left: shared, right: shared }, output = recursiveRoundTrip(treeGraph(), input);
	assert.deepEqual(output, input); assert.notEqual(output.left, output.right); assert.notEqual(output.left.box, output.right.box);
	output.left.box.title = "changed";
	assert.equal(output.right.box.title, "shared"); assert.equal(shared.box.title, "shared");
	const self = { kind: "next" }; self.value = self;
	const mutual = { kind: "next", value: { kind: "next" } }; mutual.value.value = mutual;
	for(const value of [self, mutual]) assert.throws(() => recursiveRoundTrip(chainGraph(), value), /Cyclic copied value/);
	const forest = { kind: "forest", children: [] }; forest.children.push(forest);
	assert.throws(() => recursiveRoundTrip(treeGraph(), forest), /Cyclic copied value/);
});

test("runtime depth is independent of schema depth and rejects without JavaScript stack overflow", () => {
	const value = chainValue(componentRecursiveLimits.valueDepth);
	assert.deepEqual(recursiveRoundTrip(chainGraph(), value), value);
	for(const depth of [componentRecursiveLimits.valueDepth + 1, 20000])
		assert.throws(() => recursiveRoundTrip(chainGraph(), chainValue(depth)), /Component recursive value depth exceeded/);
	const f = fixture(), codec = compileComponentRecursiveCodec(chainGraph());
	const put = (slot, flags, pointer, count) => [37, flags, pointer, count].forEach((value, i) => f.view().setUint32(slot + i * 4, value, true));
	for(let index = 0; index < 130; index++) put(f.slot + index * 16, 0, f.slot + (index + 1) * 16, 1);
	put(f.slot + 130 * 16, 4, 0, 0);
	assert.throws(() => codec.read(f.module, f.slot), /value depth exceeded/);
	put(f.slot + 128 * 16, 4, 0, 0);
	assert.deepEqual(codec.read(f.module, f.slot), value);
	put(f.slot, 0, f.slot, 1);
	assert.throws(() => codec.read(f.module, f.slot), /Cyclic copied wire value/);
	put(f.slot, 4, 0, 0); assert.deepEqual(codec.read(f.module, f.slot), { kind: "end" });
});

test("recursive byte and node budgets cover all inputs and results before allocation", () => {
	const codec = compileComponentRecursiveCodec(chainGraph()), f = fixture(), budget = createComponentRecursiveBudget(96, 6);
	const value = chainValue(2);
	codec.write(f.module, f.slot, value, f.allocate, budget);
	assert.equal(budget.nodes, 3); assert.equal(budget.used, 48);
	assert.deepEqual(codec.read(f.module, f.slot, budget), value);
	assert.equal(budget.nodes, 6); assert.equal(budget.used, 96);
	assert.throws(() => codec.read(f.module, f.slot, budget), /node budget/);
	assert.throws(() => codec.read(f.module, f.slot, createComponentRecursiveBudget(47)), /copy budget/);
	assert.throws(() => codec.read(f.module, f.slot, createComponentRecursiveBudget(48, 2)), /node budget/);
	f.release();
	const huge = compileComponentRecursiveCodec(graph(apply("array", unit), []));
	for(const count of [componentRecursiveLimits.valueNodes, 0xffffffff])
	{
		const before = f.attempts();
		assert.throws(() => huge.write(f.module, f.slot, new Array(count), f.allocate), /node budget/);
		assert.equal(f.attempts(), before);
	}
	for(const limit of [-1, 0.5, NaN, Infinity, componentRecursiveLimits.valueNodes + 1])
		assert.throws(() => createComponentRecursiveBudget(1024, limit), /node budget/);
	const zero = createComponentRecursiveBudget(0, 0);
	for(const count of [-1, 0.5, NaN, Infinity, 1]) assert.throws(() => zero.reserve(count), /node budget/);
	assert.equal(zero.nodes, 0); assert.equal(zero.used, 0);
	let calls = 0;
	for(const forged of [{ charge: () => { calls++; }, reserve: () => { calls++; } }, { ...budget }, Object.create(budget), null])
	{
		assert.throws(() => codec.read(f.module, f.slot, forged), /authentic recursive copy budget/);
		assert.throws(() => codec.write(f.module, f.slot, value, f.allocate, forged), /authentic recursive copy budget/);
	}
	assert.equal(calls, 0);
});

test("the full recursive node allowance succeeds and one excess slot fails before allocation", () => {
	const codec = compileComponentRecursiveCodec(graph(apply("array", unit), [])), f = fixture();
	const input = Array(componentRecursiveLimits.valueNodes - 1).fill(undefined), budget = createComponentRecursiveBudget();
	codec.write(f.module, f.slot, input, f.allocate, budget);
	assert.equal(budget.nodes, componentRecursiveLimits.valueNodes);
	assert.equal(budget.used, componentRecursiveLimits.valueNodes * scalarSlotBytes);
	assert.deepEqual(codec.read(f.module, f.slot), input);
	const before = f.attempts(); input.push(undefined);
	assert.throws(() => codec.write(f.module, f.slot, input, f.allocate), /node budget/);
	assert.equal(f.attempts(), before);
	// Supply an in-bounds oversized wire array. Reject its node count before reading uninitialized leaves.
	const pointer = f.allocate(input.length * scalarSlotBytes);
	[32, 0, pointer, input.length].forEach((value, index) => f.view().setUint32(f.slot + 4 * index, value, true));
	assert.throws(() => codec.read(f.module, f.slot), /node budget/);
	f.release(); assert.equal(f.live.size, 0);
});

test("recursive aliases add no wire depth or copy charge and inactive branches allocate nothing", () => {
	const descriptor = graph(named("Payload"), [
		alias("Payload", named("Value"))
		, variant("Value", {
			empty: {}
			, data: { text: primitive("string"), magnitude: primitive("nat"), bytes }
			, more: { next: named("Payload") }
		})
	]);
	const f = fixture(), codec = compileComponentRecursiveCodec(descriptor), emptyBudget = createComponentRecursiveBudget(32, 2);
	codec.write(f.module, f.slot, { kind: "empty" }, f.allocate, emptyBudget);
	assert.deepEqual(codec.read(f.module, f.slot, emptyBudget), { kind: "empty" }); assert.equal(f.attempts(), 0);
	const input = { kind: "data", text: "🌱\uFEFF\0", magnitude: 1n << 64n, bytes: new Uint8Array([0, 128, 255]) };
	const budget = createComponentRecursiveBudget(174, 8);
	codec.write(f.module, f.slot, input, f.allocate, budget);
	assert.equal(budget.used, 16 + 48 + 8 + 12 + 3); assert.equal(budget.nodes, 4);
	const output = codec.read(f.module, f.slot, budget);
	assert.deepEqual(output, input); assert.equal(budget.used, 174); assert.equal(budget.nodes, 8);
	input.bytes.fill(7); f.module.HEAP8.fill(99);
	assert.deepEqual(output.bytes, new Uint8Array([0, 128, 255]));
	f.release(); assert.equal(f.live.size, 0);
});

test("recursive malformed values and allocation failures retain caller-owned cleanup and recover", () => {
	const descriptor = treeGraph(), codec = compileComponentRecursiveCodec(descriptor);
	const input = { kind: "forest", children: Array.from({ length: 4 }, (_, index) => ({ kind: "boxed", box: { title: `row ${index}🌱`, next: { tag: "some", value: { kind: "leaf", value: index } } } })) };
	const baseline = fixture(); codec.write(baseline.module, baseline.slot, input, baseline.allocate);
	const allocations = baseline.attempts(); baseline.release(); assert.ok(allocations >= 20);
	for(let failAt = 1; failAt <= allocations; failAt++)
	{
		const f = fixture({ failAt, grow: true });
		assert.throws(() => codec.write(f.module, f.slot, input, f.allocate), /injected allocation failure/);
		assert.equal(f.attempts(), failAt); f.release(); assert.equal(f.live.size, 0);
		codec.write(f.module, f.slot, input, f.allocate); assert.deepEqual(codec.read(f.module, f.slot), input);
		f.release(); assert.equal(f.live.size, 0);
	}
	let reads = 0;
	const badValues = [
		{ kind: "leaf" }
		, { kind: "leaf", value: true }
		, { kind: "unknown" }
		, { kind: "empty", value: undefined }
		, { kind: "pair", value: [{ tag: "none" }] }
		, { kind: "forest", children: new Array(1) }
		, { kind: "result", value: { ok: { kind: "empty" }, error: "both" } }
		, { kind: "boxed", box: { title: "bad Unicode\ud800", next: { tag: "none" } } }
		, Object.defineProperty({ kind: "leaf" }, "value", { get: () => { reads++; return 1; } })
	];
	for(const bad of badValues)
	{
		const f = fixture();
		assert.throws(() => codec.write(f.module, f.slot, { kind: "fork", left: input, right: bad }, f.allocate));
		assert.ok(f.live.size > 0); f.release(); assert.equal(f.live.size, 0);
		codec.write(f.module, f.slot, input, f.allocate); assert.deepEqual(codec.read(f.module, f.slot), input); f.release();
	}
	assert.equal(reads, 0);
});

test("recursive wire validation does not depend on the writer or trust branch and pointer metadata", () => {
	const f = fixture(), codec = compileComponentRecursiveCodec(treeGraph());
	const set = (slot, values) => values.forEach((value, i) => f.view().setUint32(slot + 4 * i, value, true));
	// A fork's two leaf slots refer to shared non-owning scalar storage. Reading copies the values.
	set(f.slot, [37, 0, 256, 2]); set(256, [37, 4, 512, 1]); set(272, [37, 4, 512, 1]); set(512, [4, 0, 42, 0]);
	const result = codec.read(f.module, f.slot);
	assert.deepEqual(result, { kind: "fork", left: { kind: "leaf", value: 42 }, right: { kind: "leaf", value: 42 } });
	assert.notEqual(result.left, result.right);
	for(const wire of [
		[36, 0, 256, 2]
		, [37, 1, 256, 2]
		, [37, 0xfffffffc, 256, 2]
		, [37, 0, 256, 1]
		, [37, 0, 0, 2]
		, [37, 0, 257, 2]
		, [37, 0, 65536, 2]
		, [37, 16, 256, 0]
		, [37, 18, 0, 0]]){ set(f.slot, wire); assert.throws(() => codec.read(f.module, f.slot)); }
	set(f.slot, [37, 4, 256, 1]); set(256, [1, 0, 1, 0]);
	assert.throws(() => codec.read(f.module, f.slot), /type mismatch/);
	for(const slot of [0, -8, 65, 64.5, NaN, Infinity, 65536])
	{
		assert.throws(() => codec.read(f.module, slot), /buffer/);
		assert.throws(() => codec.write(f.module, slot, { kind: "empty" }, f.allocate), /buffer/);
	}
	for(const address of [0, 1, -8, 64.5, 65536, NaN, Infinity])
		assert.throws(() => codec.write(f.module, f.slot, { kind: "leaf", value: 42 }, () => address), /buffer/);
});

const recursiveIr = () => {
	const ir = corpusReviewedIr({ id: "shapes" }, [{ name: "Shapes.echo", parameters: ["uint32"], result: "uint32" }]);
	const documentation = { summary: "Recursive copied type.", details: "" };
	ir.types = treeGraph().types.map(type => ({
		id: type.id, name: type.id.split(".").at(-1), kind: type.kind
		, representation: "copied", mutability: "immutable"
		, typeParameters: []
		, fields: []
		, target: null
		, resource: null
		, callable: null
		, host: null
		, assurance: []
		, documentation
		, source: { producer: "corpusReview", declaration: type.id.slice(5), extensions: {} }
		, cases: [], ...type
		, ...(type.kind === "record" ? { fields: type.fields.map(field => ({ ...field, mutability: "immutable", documentation })) } : {})
		, ...(type.kind === "variant" ? { cases: type.cases.map(item => ({ ...item, documentation, fields: item.fields.map(field => ({ ...field, mutability: "immutable", documentation })) })) } : {}) }));
	ir.declarations[0].parameters[0].type = named("Tree"); ir.declarations[0].result.type = named("Tree");
	return ir;
};

test("recursive graphs authenticate exact public nominal definitions and roots without unfolding", () => {
	const ir = recursiveIr(), descriptor = componentRecursiveTypeGraph(ir, named("Tree"));
	assert.deepEqual(descriptor, snapshotComponentCopiedGraph(treeGraph()));
	assertComponentRecursiveTypeGraph(descriptor, ir, named("Tree"));
	for(const mutate of [
		value => { value.root = named("Forest"); }
		, value => { value.types[1].target.constructor = "array"; }
		, value => { value.types[2].cases.reverse(); }
		, value => { value.types[2].cases[0].fields.reverse(); }
		, value => { value.types[2].cases[0].fields[0].name = "changed"; }
		, value => { value.types[2].cases[1].fields[0].type.name = "uint64"; }
		, value => { value.types.push(alias("Extra", unit)); }
	]) {
		const candidate = structuredClone(descriptor); mutate(candidate);
		assert.throws(() => assertComponentRecursiveTypeGraph(candidate, ir, named("Tree")), /differs from its public types/);
	}
	const reordered = structuredClone(descriptor); reordered.types.reverse();
	assertComponentRecursiveTypeGraph(reordered, ir, named("Tree"));
	for(const mutate of [
		value => { value.types[1].fields[0].mutability = "write"; }
		, value => { value.types[1].representation = "identity"; }
		, value => { value.types[0].target = named("Forest"); }
		, value => { value.types[1].fields[0].type = named("Missing"); }
	]) {
		const candidate = structuredClone(ir); mutate(candidate);
		assert.throws(() => componentRecursiveTypeGraph(candidate, named("Tree")));
	}
});

test("finite graph codecs do not silently enable recursive compiled npm or native exports", () => {
	const ir = recursiveIr();
	assert.equal(validateBindingIr(ir), ir);
	assert.throws(() => createComponentPrivateAbi(ir), /recursive/);
	assert.throws(() => compilePrimitiveCSurface(ir, { compounds: true, lists: true, variants: true }), /acyclic/);
});
