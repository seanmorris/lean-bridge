/**
 * Exact public primitive values in the private native wasm32 layout.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { scalarCopyLimit } from "../src/abi/component-scalars.mjs";
import { assertOwnedWasmSpan, readOwnedWasmScalar, writeOwnedWasmScalar } from "../src/release/owned-wasm-scalars.mjs";

const heap = ({ grow = false, limit = scalarCopyLimit } = {}) => {
	const memory = new WebAssembly.Memory({ initial: 1, maximum: 1024 });
	const module = { HEAP8: new Int8Array(memory.buffer) }, allocations = new Map(), claims = [];
	let next = 512, charged = 0;
	const charge = bytes => {
		charged += bytes;
		if(charged > limit) throw new RangeError("Cumulative copy budget exceeded");
	};
	const allocate = bytes => {
		const pointer = Math.ceil(next / 8) * 8; next = pointer + bytes;
		if(grow || next > memory.buffer.byteLength)
		{
			memory.grow(Math.max(1, Math.ceil((next - memory.buffer.byteLength) / 65536)));
			module.HEAP8 = new Int8Array(memory.buffer);
		}
		allocations.set(pointer, bytes); return pointer;
	};
	const claim = (pointer, bytes) => {
		assert.equal(allocations.get(pointer), bytes, "Only the recorded output allocation may be read");
		claims.push([pointer, bytes]);
	};
	return { module, memory, allocations, claims
		, controls: { charge, allocate, claim }
		, resetBudget: () => { charged = 0; }, charged: () => charged };
};

test("owned wasm32 scalars preserve all nineteen primitive representations", () => {
	const state = heap(), pointer = 64;
	const values = new Map([
		["unit", [undefined]], ["bool", [false, true]]
		, ["char", ["\0", "a", "é", "💠", "\u{10ffff}"]]
		, ["uint8", [0, 255]], ["uint16", [0, 65535]], ["uint32", [0, 4294967295]]
		, ["uint64", [0n, 18446744073709551615n]], ["usize", [0, 4294967295]]
		, ["int8", [-128, 127]], ["int16", [-32768, 32767]]
		, ["int32", [-2147483648, 2147483647]]
		, ["int64", [-9223372036854775808n, 9223372036854775807n]]
		, ["isize", [-2147483648, 2147483647]]
		, ["float32", [0, -0, NaN, Infinity, -Infinity, Math.fround(1.25)]]
		, ["float64", [0, -0, NaN, Infinity, -Infinity, Number.MIN_VALUE, Number.MAX_VALUE]]
		, ["nat", [0n, 1n, (1n << 256n) + 0x1020304n]]
		, ["int", [0n, -1n, -(1n << 257n) + 123n, (1n << 257n) - 123n]]
		, ["string", ["", "\0", "\ufeffA\0é💠"]]
		, ["bytes", [new Uint8Array(), new Uint8Array([0, 128, 255])]]
	]);
	assert.equal(values.size, 19);
	for(const [type, cases] of values) for(const value of cases)
	{
		state.resetBudget();
		writeOwnedWasmScalar(state.module, pointer, type, value, state.controls);
		assert.deepEqual(readOwnedWasmScalar(state.module, pointer, type, state.controls), value, type);
	}
	writeOwnedWasmScalar(state.module, pointer, "float32", 1 / 3, state.controls);
	assert.equal(readOwnedWasmScalar(state.module, pointer, "float32", state.controls), Math.fround(1 / 3));
});

test("owned scalar payloads survive memory growth without retaining freed views", () => {
	const state = heap({ grow: true }), pointer = 64;
	state.module.HEAP8.set([0, 128, 255], 256);
	const source = new Uint8Array(state.memory.buffer, 256, 3);
	writeOwnedWasmScalar(state.module, pointer, "bytes", source, state.controls);
	assert.equal(source.byteLength, 0, "The allocator detached the original memory view");
	const result = readOwnedWasmScalar(state.module, pointer, "bytes", state.controls);
	assert.deepEqual(result, new Uint8Array([0, 128, 255]));
	const payload = new DataView(state.memory.buffer).getUint32(pointer, true);
	state.module.HEAP8.fill(0, payload, payload + result.length);
	assert.deepEqual(result, new Uint8Array([0, 128, 255]));
	for(const [type, value] of [["string", "\ufeff💠"], ["nat", 1n << 129n], ["int", -(1n << 130n)]])
	{
		writeOwnedWasmScalar(state.module, pointer, type, value, state.controls);
		assert.deepEqual(readOwnedWasmScalar(state.module, pointer, type, { ...state.controls
			, claim: (address, bytes) => {
				state.controls.claim(address, bytes); state.memory.grow(1);
				state.module.HEAP8 = new Int8Array(state.memory.buffer);
			}
		}), value);
	}
});

test("owned scalar input rejects coercions, narrowing and invalid Unicode before allocation", () => {
	const state = heap(), pointer = 64;
	const cases = [["unit", null], ["bool", 1], ["uint8", 256], ["uint16", -1]
		, ["uint32", 2 ** 32], ["usize", 2 ** 32], ["isize", -(2 ** 31) - 1]
		, ["int32", 1n], ["int64", 1], ["uint64", 1n << 64n], ["nat", -1n], ["int", 1]
		, ["float32", "1"], ["float64", new Number(1)]
		, ["char", "ab"], ["char", "\ud800"]
		, ["string", "\udfff"], ["bytes", [1, 2, 3]]];
	for(const [type, value] of cases)
		assert.throws(() => writeOwnedWasmScalar(state.module, pointer, type, value, state.controls));
	assert.equal(state.allocations.size, 0);
	assert.throws(() => writeOwnedWasmScalar(state.module, pointer, "mystery", 0, state.controls), /Unknown/);
	assert.throws(() => readOwnedWasmScalar(state.module, pointer, "mystery", state.controls), /Unknown/);
});

test("owned scalar byte budgets are cumulative and charged before allocation", () => {
	const state = heap({ limit: 4 }), pointer = 64;
	writeOwnedWasmScalar(state.module, pointer, "string", "💠", state.controls);
	assert.equal(state.charged(), 4); assert.equal(state.allocations.size, 1);
	assert.throws(() => writeOwnedWasmScalar(state.module, pointer, "bytes", new Uint8Array([1]), state.controls), /Cumulative/);
	assert.equal(state.allocations.size, 1);
	const large = heap();
	assert.throws(() => writeOwnedWasmScalar(large.module, pointer, "bytes", new Uint8Array(scalarCopyLimit + 1), large.controls), /copy budget/);
	assert.equal(large.allocations.size, 0);
	const integer = heap({ limit: 3 });
	assert.throws(() => writeOwnedWasmScalar(integer.module, pointer, "nat", 1n, integer.controls), /Cumulative/);
	assert.equal(integer.allocations.size, 0);
});

test("owned wasm32 spans reject truncation, misalignment, null payloads and heap overflow", () => {
	const { module, controls } = heap();
	for(const [pointer, bytes, alignment] of [[0, 1, 1], [-1, 0, 1]
		, [2 ** 32, 0, 1], [64, 2 ** 32, 1]
		, [1.5, 4, 1], [64, 1.5, 1], [65, 4, 4], [64, 4, 3], [65535, 2, 1]])
		assert.throws(() => assertOwnedWasmSpan(module, pointer, bytes, alignment), /memory span/);
	assert.doesNotThrow(() => assertOwnedWasmSpan(module, 0, 0));
	assert.doesNotThrow(() => assertOwnedWasmSpan(module, 65535, 1));
	assert.throws(() => writeOwnedWasmScalar(module, 65532, "uint64", 0n, controls), /memory span/);
	assert.throws(() => readOwnedWasmScalar(module, 65, "nat", controls), /memory span/);
	assert.throws(() => writeOwnedWasmScalar(module, 64, "string", "x", { ...controls, allocate: () => 0 }), /memory span/);
});

test("malformed native scalar results fail before returning host values", () => {
	const state = heap(), pointer = 64;
	let data = new DataView(state.memory.buffer);
	for(const [type, bits] of [["unit", 1], ["bool", 2], ["char", 0xd800], ["char", 0x110000]])
	{
		data.setUint32(pointer, bits, true);
		assert.throws(() => readOwnedWasmScalar(state.module, pointer, type, state.controls), /Invalid/);
	}
	writeOwnedWasmScalar(state.module, pointer, "int", -1n, state.controls);
	data = new DataView(state.memory.buffer); data.setUint8(pointer + 8, 2);
	assert.throws(() => readOwnedWasmScalar(state.module, pointer, "int", state.controls), /representation/);
	data.setUint32(pointer, 0, true); data.setUint32(pointer + 4, 0, true); data.setUint8(pointer + 8, 1);
	assert.throws(() => readOwnedWasmScalar(state.module, pointer, "int", state.controls), /representation/);
	writeOwnedWasmScalar(state.module, pointer, "nat", 1n, state.controls);
	data.setUint32(data.getUint32(pointer, true), 0, true);
	assert.throws(() => readOwnedWasmScalar(state.module, pointer, "nat", state.controls), /magnitude/);
	writeOwnedWasmScalar(state.module, pointer, "string", "a", state.controls);
	state.module.HEAP8[data.getUint32(pointer, true)] = 255;
	assert.throws(() => readOwnedWasmScalar(state.module, pointer, "string", state.controls), /encoded data/);
	data.setUint32(pointer + 4, 0xffffffff, true);
	assert.throws(() => readOwnedWasmScalar(state.module, pointer, "nat", state.controls), /copy budget/);
	data.setUint32(pointer, 0, true); data.setUint32(pointer + 4, 1, true);
	assert.throws(() => readOwnedWasmScalar(state.module, pointer, "bytes", state.controls), /memory span/);
});

test("owned dynamic outputs require exact allocation claims even for valid memory", () => {
	const state = heap(), pointer = 64;
	writeOwnedWasmScalar(state.module, pointer, "string", "secret", state.controls);
	assert.throws(() => readOwnedWasmScalar(state.module, pointer, "string", { charge: state.controls.charge }), /allocation receipt/);
	assert.throws(() => readOwnedWasmScalar(state.module, pointer, "string", { ...state.controls
		, claim: () => { throw new Error("Unowned span"); } }), /Unowned span/);
	const data = new DataView(state.memory.buffer);
	data.setUint32(pointer, data.getUint32(pointer, true) + 1, true);
	assert.throws(() => readOwnedWasmScalar(state.module, pointer, "string", state.controls), /recorded output allocation/);
});
