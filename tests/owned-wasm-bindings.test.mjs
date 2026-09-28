/**
 * Independent control-frame producer, malformed replies and shared retirement.
 * Actual generated C bindings execute in the fresh Lean/Wasm acceptance tests.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createOwnedWasmBindings } from "../src/release/owned-wasm-bindings.mjs";
import { ownedWasmControlOperations as op } from "../src/abi/owned-wasm-control.mjs";

const key = `leanBridgeOwnedCallbacks_${"a".repeat(64)}`;
const fixture = (operation = () => 0, withCallbacks = true) => {
	const memory = new WebAssembly.Memory({ initial: 2 }), allocations = new Set();
	let next = 64, poisoned = 0, closed = 0, calls = 0, frees = 0;
	const module = { HEAP8: new Int8Array(memory.buffer)
		, _malloc: bytes => {
			assert.equal(bytes, 64); const pointer = next; next += 64;
			allocations.add(pointer); return pointer;
		}
		, _free: pointer => { assert.ok(allocations.delete(pointer)); frees++; }
	};
	const api = createOwnedWasmBindings(module, pointer => {
		calls++; const view = new DataView(memory.buffer);
		assert.equal(view.getUint32(pointer, true), 1);
		assert.equal(view.getUint32(pointer + 4, true), 64);
		assert.equal(view.getUint32(pointer + 8, true), 0);
		assert.equal(view.getUint32(pointer + 56, true), 0);
		assert.equal(view.getUint32(pointer + 60, true), 0);
		return operation({ pointer, view, module, memory });
	}, { assertOpen: () => { assert.equal(poisoned + closed, 0); }
		, poison: () => { poisoned++; }, close: () => { closed++; }
	}, withCallbacks ? key : null);
	return { api, module, memory, allocations, counts: () => ({ poisoned, closed, calls, frees }) };
};

test("owned binding operations encode exact wasm32 arguments and full-width tokens", () => {
	const observed = [], f = fixture(({ pointer, view }) => {
		observed.push({ op: view.getUint32(pointer + 12, true)
			, args: Array.from({ length: 8 }, (_, i) => view.getUint32(pointer + 16 + 4 * i, true))
			, token: view.getBigUint64(pointer + 48, true) });
		view.setUint32(pointer + 56, 42, true); return 0;
	});
	const b = f.api.bindings, token = 0xfedcba9876543210n;
	const cases = [
		[() => f.api.initialize(), op.init, [], 0n, 0]
		, [() => b.openOwner(), op.open, [], 0n, 42]
		, [() => b.validOwner(7), op.valid, [7], 0n, 42]
		, [() => b.releaseOwner(7), op.release, [7], 0n, 0]
		, [() => b.claimAllocation(7, 32, 48), op.claim, [7, 32, 48], 0n, 42]
		, [() => b.claimIdentity(7, 8, token), op.identity, [7, 8], token, 42]
		, [() => b.dispatch(7, 8, 9, 10), op.dispatch, [7, 8, 9, 10], 0n, 0]
		, [() => b.retain(7, token, 8, 9), op.retain, [7, 8, 9], token, 0]
		, [() => f.api.allocations(), op.live, [], 0n, 42]
		, [() => f.api.owners(), op.results, [], 0n, 42]
		, [() => f.api.callbacks(), op.callbackLive, [], 0n, 42]
		, [() => b.callbacks.begin(1, 2, 3, 4, 5), op.callbackBegin, [1, 2, 3, 4, 5], 0n, 0]
		, [() => b.callbacks.end(1), op.callbackEnd, [1], 0n, 0]
		, [() => b.callbacks.valid(1, 2, 3, 4, 5, 6), op.callbackValid, [1, 2, 3, 4, 5, 6], 0n, 42]
	];
	for(const [call, code, args, token, expected] of cases)
	{
		assert.equal(call(), expected);
		assert.deepEqual(observed.at(-1), { op: code, args: [...args, ...Array(8 - args.length).fill(0)], token });
		assert.equal(f.allocations.size, 0);
	}
	assert.equal(b.close(), 0); assert.equal(observed.at(-1).op, op.close);
	assert.deepEqual(f.counts(), { poisoned: 0, closed: 1, calls: 15, frees: 15 });
	assert.throws(() => b.openOwner()); assert.equal(f.counts().calls, 15);
});

test("control frames survive heap growth and synchronous nested bindings", () => {
	let inner = false, f;
	f = fixture(({ pointer, view, memory, module }) => {
		if(!inner)
		{
			inner = true; assert.equal(f.api.owners(), 7);
			memory.grow(1); module.HEAP8 = new Int8Array(memory.buffer);
			view = new DataView(memory.buffer);
		}
		view.setUint32(pointer + 56, 7, true); return 0;
	});
	assert.equal(f.api.bindings.openOwner(), 7); assert.equal(f.allocations.size, 0);
	assert.deepEqual(f.counts(), { poisoned: 0, closed: 0, calls: 2, frees: 2 });
});

test("compiled metadata retains all eight unsigned digest words", () => {
	const words = [0, 1, 0x80000000, 0xffffffff, 0x12345678, 0xfedcba98, 42, 0];
	const f = fixture(({ pointer, view }) => {
		assert.equal(view.getUint32(pointer + 12, true), op.metadata);
		view.setUint32(pointer + 56, words[view.getUint32(pointer + 16, true)], true);
		return 0;
	});
	assert.equal(f.api.metadataHash(), words.map(word => word.toString(16).padStart(8, "0")).join(""));
	assert.deepEqual(f.counts(), { poisoned: 0, closed: 0, calls: 8, frees: 8 });
	assert.equal(f.allocations.size, 0);
});

test("ordinary native failures and missing control allocations remain recoverable", () => {
	let status = 3;
	const f = fixture(({ pointer, view }) => { view.setUint32(pointer + 8, status, true); return status; });
	assert.equal(f.api.initialize(), 3); assert.equal(f.api.bindings.dispatch(0, 64, 128, 1), 3);
	assert.equal(f.api.bindings.openOwner(), 0); assert.equal(f.counts().poisoned, 0);
	const allocate = f.module._malloc; f.module._malloc = () => 0;
	assert.equal(f.api.bindings.openOwner(), 0); assert.equal(f.api.initialize(), 3);
	f.module._malloc = allocate; status = 0; assert.equal(f.api.initialize(), 0);
	assert.equal(f.allocations.size, 0); assert.equal(f.counts().poisoned, 0);
});

test("invalid control inputs fail before allocation or native dispatch", () => {
	const f = fixture();
	for(const value of [-1, 0x100000000, 1.5, NaN, Infinity, "1", null])
		assert.throws(() => f.api.bindings.validOwner(value), TypeError);
	for(const token of [0, -1n, 1n << 64n, null])
		assert.throws(() => f.api.bindings.claimIdentity(1, 2, token), TypeError);
	assert.deepEqual(f.counts(), { poisoned: 0, closed: 0, calls: 0, frees: 0 });
	assert.equal(f.allocations.size, 0);
});

test("malformed control replies retire the heap before cleanup or reuse", () => {
	for(const mutate of [
		({ pointer, view }) => view.setUint32(pointer, 2, true)
		, ({ pointer, view }) => view.setUint32(pointer + 4, 32, true)
		, ({ pointer, view }) => view.setUint32(pointer + 8, 1, true)
		, ({ pointer, view }) => view.setUint32(pointer + 12, 999, true)
		, ({ pointer, view }) => view.setUint32(pointer + 16, 1, true)
		, ({ pointer, view }) => view.setBigUint64(pointer + 48, 1n, true)
		, ({ pointer, view }) => view.setUint32(pointer + 60, 1, true)
	]) {
		const f = fixture(frame => { mutate(frame); return 0; });
		assert.throws(() => f.api.initialize(), /Malformed/);
		assert.deepEqual(f.counts(), { poisoned: 1, closed: 0, calls: 1, frees: 0 });
		assert.throws(() => f.api.initialize(), /poisoned/);
		assert.equal(f.counts().calls, 1);
	}
	for(const status of [undefined, NaN, -1, 11, 1.5])
	{
		const f = fixture(() => status);
		assert.throws(() => f.api.initialize(), /Malformed/);
		assert.equal(f.counts().frees, 0); assert.equal(f.counts().poisoned, 1);
	}
});

test("control traps and cleanup errors preserve the original thrown value", () => {
	for(const failure of [new WebAssembly.RuntimeError("trap"), undefined, null, { reason: "failure" }])
	{
		const f = fixture(() => { throw failure; });
		assert.throws(() => f.api.initialize(), error => error === failure);
		assert.equal(f.counts().frees, 0); assert.equal(f.counts().poisoned, 1);
	}
	const f = fixture(), failure = new Error("free failed");
	f.module._free = () => { throw failure; };
	assert.throws(() => f.api.initialize(), error => error === failure);
	assert.equal(f.counts().poisoned, 1);
});

test("callback handlers install once and detach without entering retired native memory", () => {
	const f = fixture(), handlers = { dispatch: () => {}, finish: () => {} };
	assert.throws(() => f.api.bindings.callbacks.install({}), /incomplete/);
	const detach = f.api.bindings.callbacks.install(handlers);
	assert.equal(f.module[key], handlers);
	assert.throws(() => f.api.bindings.callbacks.install(handlers), /already installed/);
	f.api.bindings.poison(); detach(); detach();
	assert.equal(Object.hasOwn(f.module, key), false); assert.equal(f.counts().calls, 0);
	const copied = fixture(() => 0, false);
	assert.equal(copied.api.bindings.callbacks, undefined); assert.equal(copied.api.callbacks(), 0);
	assert.throws(() => createOwnedWasmBindings(copied.module, () => 0, { assertOpen: () => {}, poison: () => {} }, "bad"), /callback key/);
});
