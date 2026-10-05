/**
 * Independent host semantics, hostile values and native-span claims for the
 * private owned wasm32 codec. These are not installed-package observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileOwnedJavaScriptWasmLayout } from "../src/backends/javascript/owned-wasm-layout.mjs";
import { createOwnedWasmValueBudget, createOwnedWasmValueCodec, ownedWasmValueLimits } from "../src/release/owned-wasm-values.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";

const layout = compileOwnedJavaScriptWasmLayout(ownedAggregateReviewedIr());
const type = name => layout.native.functions.find(fn => fn.name === name).parameters[0];
const ticket = Object.freeze({ label: "first" }), spare = Object.freeze({ label: "second" });
const callback = value => value;
const identities = new Map([[ticket, 0x100000001n], [spare, 0x200000002n], [callback, 0x300000003n]]);
const bundle = () => ({ primary: ticket, spare: { tag: "some", value: spare }
	, peers: [ticket, spare, ticket], history: [spare, ticket]
	, payload: { count: -(1n << 100n), bytes: new Uint8Array([0, 128, 255]) } });
const leaf = value => ({ kind: "leaf", ticket: value });
const branch = (...children) => ({ kind: "branch", children });
const heap = ({ grow = false, claimGrowth = false } = {}) => {
	const memory = new WebAssembly.Memory({ initial: 1, maximum: 1024 });
	const module = { HEAP8: new Int8Array(memory.buffer) }, allocations = new Map(), claims = [];
	const projections = [];
	let next = 512;
	const expand = () => {
		memory.grow(Math.max(1, Math.ceil((next - memory.buffer.byteLength) / 65536)));
		module.HEAP8 = new Int8Array(memory.buffer);
	};
	const allocate = bytes => {
		const pointer = Math.ceil(next / 8) * 8; next = pointer + bytes;
		if(grow || next > memory.buffer.byteLength) expand();
		allocations.set(pointer, bytes); return pointer;
	};
	const controls = {
		allocate
		, claim: (pointer, bytes) => {
			assert.equal(allocations.get(pointer), bytes, "An output must claim its exact recorded allocation");
			claims.push([pointer, bytes]); if(claimGrowth) expand();
		}
		, toToken: (type, value) => {
			assert.equal(type.kind === "callback", typeof value === "function");
			if(!identities.has(value)) throw new TypeError("Handle is not owned by this call");
			return identities.get(value);
		}
		, fromToken: (type, token) => {
			const value = [...identities].find(([, known]) => token === known)?.[0];
			if(!value || (type.kind === "callback") !== (typeof value === "function")) throw new TypeError("Unknown output identity");
			projections.push(value); return value;
		}
	};
	return { module, memory, controls, allocations, claims, projections };
};
const roundTrip = (id, value, selected = layout, options = {}) => {
	const state = heap(options), codec = createOwnedWasmValueCodec(selected);
	codec.write(state.module, id, 64, value, state.controls);
	const actual = codec.read(state.module, id, 64, state.controls);
	assert.deepEqual(actual, value); return { ...state, codec, actual };
};

test("owned wasm32 values preserve every aggregate shape and opaque leaf identity", () => {
	const value = bundle();
	const cases = [
		["echoArray", []], ["echoArray", [ticket, spare, ticket]]
		, ["echoList", []], ["echoList", [spare, ticket]]
		, ["echoOption", { tag: "none" }]
		, ["echoOption", { tag: "some", value: ticket }]
		, ["echoResult", { ok: value }], ["echoResult", { error: spare }]
		, ["echoTuple", [ticket, [{ tag: "none" }, value.payload]]]
		, ["echoRecord", value], ["echoAlias", value]
		, ["echoRow", [{ tag: "none" }, { tag: "some", value: ticket }]]
		, ["echoVariant", { kind: "empty" }], ["echoVariant", { kind: "one", ticket }]
		, ["echoVariant", { kind: "pair", first: ticket, second: spare }]
		, ["echoVariant", { kind: "many", tickets: [ticket, spare] }]
		, ["echoRecursive", branch(leaf(ticket), branch(), branch(leaf(spare))) ]
		, ["echoNested", [[{ tag: "none" }, { tag: "some", value: { error: ticket } }], [], [{ tag: "some", value: { ok: value } }]]]
	];
	for(const [name, input] of cases) roundTrip(type(name), input);
	assert.equal(roundTrip("lean:Owned.Ticket", ticket).actual, ticket);
	assert.equal(roundTrip(layout.native.callbacks[0].id, callback).actual, callback);
	const record = roundTrip(type("echoRecord"), value);
	assert.notEqual(record.actual, value); assert.notEqual(record.actual.payload.bytes, value.payload.bytes);
	assert.equal(record.actual.primary, ticket); assert.equal(record.actual.peers[0], record.actual.peers[2]);
});

test("nested Options distinguish None, Some None and Some Unit with an own undefined payload", () => {
	const scalars = compileOwnedJavaScriptWasmLayout(ownedPythonScalarsReviewedIr());
	const packet = scalars.types.find(item => item.id === "lean:Owned.Packet");
	const optional = packet.fields.find(field => field.sourceName === "optional").type;
	for(const value of [{ tag: "none" }, { tag: "some", value: { tag: "none" } }
		, { tag: "some", value: { tag: "some", value: undefined } }])
		roundTrip(optional, value, scalars);
	const units = scalars.native.functions.find(fn => fn.name === "units").parameters[0];
	roundTrip(units, [undefined, undefined], scalars);
	roundTrip("lean:Owned.Empty", {}, scalars);
});

test("aggregate reads and writes refresh memory views after every allocator and receipt call", () => {
	const state = roundTrip(type("echoRecord"), bundle(), layout, { grow: true, claimGrowth: true });
	assert.ok(state.claims.length > 6);
	const value = state.actual;
	state.module.HEAP8.fill(0);
	assert.deepEqual(value, bundle(), "Copied payloads outlive the transaction's native allocations");
	roundTrip(type("echoRecursive"), branch(branch(leaf(ticket)), leaf(spare)), layout, { grow: true, claimGrowth: true });
});

test("input rejects holes, getters, inherited fields, extra keys and malformed branches", () => {
	const codec = createOwnedWasmValueCodec(layout), state = heap();
	let invoked = 0;
	const getter = bundle(), elementGetter = [ticket];
	const forbiddenGetter = () => { invoked++; return ticket; };
	Object.defineProperty(getter, "primary", { get: forbiddenGetter });
	Object.defineProperty(elementGetter, 0, { get: forbiddenGetter });
	const cases = [
		["echoArray", new Array(1)]
		, ["echoArray", Object.assign([ticket], { extra: true })]
		, ["echoArray", elementGetter], ["echoArray", { length: 1, 0: ticket }]
		, ["echoArray", Object.assign([ticket], { [Symbol("extra")]: true })]
		, ["echoTuple", [ticket]]
		, ["echoTuple", [ticket, [{ tag: "none" }, bundle().payload], ticket]]
		, ["echoOption", { tag: "other" }]
		, ["echoOption", { tag: "none", value: ticket }]
		, ["echoOption", { tag: "some" }], ["echoOption", null]
		, ["echoResult", { ok: bundle(), error: ticket }], ["echoResult", {}]
		, ["echoVariant", { kind: "missing" }]
		, ["echoVariant", { kind: "empty", ticket }]
		, ["echoRecord", getter], ["echoRecord", Object.create(bundle())]
		, ["echoRecord", { ...bundle(), unexpected: 1 }]
	];
	for(const [name, value] of cases)
		assert.throws(() => codec.write(state.module, type(name), 64, value, state.controls), TypeError);
	assert.equal(invoked, 0, "Data conversion must not call field getters");
	const fields = Object.assign(Object.create(null), bundle());
	codec.write(state.module, type("echoRecord"), 64, fields, state.controls);
	assert.deepEqual(codec.read(state.module, type("echoRecord"), 64, state.controls), bundle());
});

test("host cycles fail while repeated non-ancestor objects remain legal copies", () => {
	const codec = createOwnedWasmValueCodec(layout), state = heap(), id = type("echoRecursive");
	const cyclic = branch(); cyclic.children.push(cyclic);
	assert.throws(() => codec.write(state.module, id, 64, cyclic, state.controls), /cyclic input/);
	const shared = branch(leaf(ticket)), repeated = branch(shared, shared);
	const { actual } = roundTrip(id, repeated);
	assert.notEqual(actual.children[0], actual.children[1]);
	let deep = leaf(ticket);
	for(let index = 0; index < 63; ++index) deep = branch(deep);
	roundTrip(id, deep);
	deep = branch(branch(deep));
	assert.throws(() => codec.write(state.module, id, 64, deep, state.controls), /depth limit/);
});

test("private resource tokens stay 64-bit and cannot be supplied as public handles", () => {
	const codec = createOwnedWasmValueCodec(layout), state = heap();
	codec.write(state.module, "lean:Owned.Ticket", 64, ticket, state.controls);
	assert.equal(new DataView(state.memory.buffer).getBigUint64(64, true), 0x100000001n);
	for(const value of [0x100000001n, 1, { label: "first" }])
		assert.throws(() => codec.write(state.module, "lean:Owned.Ticket", 64, value, state.controls), /not owned/);
	for(const token of [0n, -1n, 1n << 64n, 1])
		assert.throws(() => codec.write(state.module, "lean:Owned.Ticket", 64, ticket, { ...state.controls, toToken: () => token }), /identity token/);
	new DataView(state.memory.buffer).setBigUint64(64, 99n, true);
	assert.throws(() => codec.read(state.module, "lean:Owned.Ticket", 64, state.controls), /Unknown output/);
	new DataView(state.memory.buffer).setBigUint64(64, 0n, true);
	assert.throws(() => codec.read(state.module, "lean:Owned.Ticket", 64, state.controls), /identity token/);
});

test("all aggregate allocations are bounded before host containers or identity retention", () => {
	const codec = createOwnedWasmValueCodec(layout), state = heap(), id = type("echoArray");
	const limited = limits => createOwnedWasmValueBudget(limits);
	assert.throws(() => codec.write(state.module, id, 64, [ticket, spare], state.controls, limited({ visits: 2 })), /visits budget/);
	assert.equal(state.allocations.size, 0);
	assert.throws(() => codec.write(state.module, id, 64, [ticket], state.controls, limited({ bytes: 8 })), /bytes budget/);
	assert.equal(state.allocations.size, 0);
	assert.throws(() => codec.write(state.module, id, 64, [ticket, spare], state.controls, limited({ retained: 1 })), /retained budget/);
	assert.throws(() => codec.write(state.module, id, 64, [ticket], state.controls, limited({ depth: 0 })), /depth limit/);
	const shared = limited({ retained: 1 });
	codec.write(state.module, "lean:Owned.Ticket", 64, ticket, state.controls, shared);
	assert.throws(() => codec.write(state.module, "lean:Owned.Ticket", 80, spare, state.controls, shared), /retained budget/);
	for(const [key, value] of Object.entries(ownedWasmValueLimits))
		assert.throws(() => limited({ [key]: value + 1 }), /conversion limits/);
	for(const limits of [{ unknown: 1 }, { bytes: -1 }, { visits: NaN }, { retained: 1.5 }])
		assert.throws(() => limited(limits), /conversion limits/);
	assert.throws(() => codec.write(state.module, id, 64, [], state.controls, {}), /bounded call budget/);
	const data = new DataView(state.memory.buffer);
	data.setUint32(64, 512, true); data.setUint32(68, 0xffffffff, true);
	assert.throws(() => codec.read(state.module, id, 64, state.controls), /visits budget/);
});

test("malformed native tags, pointers and sequence lengths fail without reading unowned memory", () => {
	const codec = createOwnedWasmValueCodec(layout);
	for(const name of ["echoOption", "echoResult", "echoVariant"])
	{
		const state = heap(); new DataView(state.memory.buffer).setUint32(64, 255, true);
		assert.throws(() => codec.read(state.module, type(name), 64, state.controls), /output tag/);
	}
	const state = heap();
	codec.write(state.module, type("echoRecord"), 64, bundle(), state.controls);
	const record = layout.types.find(item => item.id === "lean:Owned.Bundle");
	const offset = record.fields.find(field => field.sourceName === "payload").offset;
	const data = new DataView(state.memory.buffer), original = data.getUint32(64 + offset, true);
	for(const address of [0, original + 1, 65535])
	{
		data.setUint32(64 + offset, address, true);
		assert.throws(() => codec.read(state.module, type("echoRecord"), 64, state.controls), /memory span/);
	}
	data.setUint32(64 + offset, original + 8, true);
	assert.throws(() => codec.read(state.module, type("echoRecord"), 64, state.controls), /exact recorded allocation/);
	data.setUint32(64, 512, true); data.setUint32(68, 0, true);
	assert.throws(() => codec.read(state.module, type("echoArray"), 64, state.controls), /noncanonical empty/);
	assert.throws(() => codec.read(state.module, type("echoArray"), 64, {}), /allocation claims/);
});

test("native recursive cycles reject independently of bounds and ancestor identities", () => {
	const state = heap(), codec = createOwnedWasmValueCodec(layout), id = type("echoRecursive");
	codec.write(state.module, id, 64, branch(leaf(ticket)), state.controls);
	const tree = layout.types.find(item => item.id === id);
	const field = tree.cases.find(item => item.sourceName === "branch").fields[0];
	const data = new DataView(state.memory.buffer), array = data.getUint32(64 + field.offset, true);
	const child = data.getUint32(array, true);
	data.setUint32(child, 1, true); data.setUint32(child + field.offset, array, true);
	assert.throws(() => codec.read(state.module, id, 64, state.controls), /cyclic output/);
});

test("the codec snapshots layout metadata and writes special record names as own data", () => {
	const original = structuredClone(layout), codec = createOwnedWasmValueCodec(original), state = heap();
	original.types.find(item => item.id === "lean:Owned.Bundle").fields[0].offset = 8;
	codec.write(state.module, type("echoRecord"), 64, bundle(), state.controls);
	assert.deepEqual(codec.read(state.module, type("echoRecord"), 64, state.controls), bundle());
	assert.throws(() => createOwnedWasmValueCodec({ ...layout, kind: "other" }), /compiler-checked/);
	assert.throws(() => codec.write(state.module, "unknown", 64, {}, state.controls), /unknown layout/);
	const custom = structuredClone(layout), payload = custom.types.find(item => item.id === "lean:Owned.Payload");
	payload.fields[0].sourceName = "__proto__";
	const renamed = createOwnedWasmValueCodec(custom), value = { ["__proto__"]: 42n, bytes: new Uint8Array() };
	renamed.write(state.module, payload.id, 64, value, state.controls);
	const actual = renamed.read(state.module, payload.id, 64, state.controls);
	assert.equal(Object.getPrototypeOf(actual), Object.prototype); assert.deepEqual(actual, value);
});
