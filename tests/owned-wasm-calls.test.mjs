/**
 * Independent allocation ledgers and hostile native replies for the owned JS
 * call transport. Fresh compiled Lean execution lives in its separate gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileOwnedJavaScriptWasmLayout } from "../src/backends/javascript/owned-wasm-layout.mjs";
import { createOwnedWasmCalls } from "../src/release/owned-wasm-calls.mjs";
import { writeOwnedWasmScalar } from "../src/release/owned-wasm-scalars.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";

const layout = compileOwnedJavaScriptWasmLayout(ownedAggregateReviewedIr());
const ticket = layout.types.find(type => type.kind === "resource");
const fixture = (options = {}) => {
	const memory = new WebAssembly.Memory({ initial: 16 }), allocations = new Map(), owners = new Map();
	let next = 64, nextOwner = 0, nextToken = 0n, poisoned = 0, closed = 0, calls = 0, frees = 0, mallocs = 0;
	const module = { HEAP8: new Int8Array(memory.buffer)
		, _malloc: bytes => { mallocs++; const pointer = next; next += Math.ceil(bytes / 8) * 8; allocations.set(pointer, bytes); return pointer; }
		, _free: pointer => { assert.ok(allocations.delete(pointer)); frees++; }
	};
	const data = () => new DataView(memory.buffer);
	const ownerAllocate = (owner, bytes) => {
		const pointer = module._malloc(bytes); owners.get(owner).allocations.set(pointer, bytes); return pointer;
	};
	const bindings = {
		assertOpen: () => { assert.equal(closed, 0); assert.equal(poisoned, 0); }
		, openOwner: () => { const owner = ++nextOwner; owners.set(owner, { tokens: new Set(), allocations: new Map() }); return owner; }
		, validOwner: owner => Number(owners.has(owner))
		, releaseOwner: owner => {
			const value = owners.get(owner); assert.ok(value);
			for(const pointer of value.allocations.keys()) module._free(pointer);
			owners.delete(owner); return 0;
		}
		, claimAllocation: (owner, pointer, bytes) => Number(owners.get(owner)?.allocations.get(pointer) === bytes)
		, claimIdentity: (owner, type, token) => Number(type === ticket.index && owners.get(owner)?.tokens.has(token))
		, dispatch: (index, args, out, owner) => {
			calls++; const name = layout.native.functions[index].name;
			if(name === "newTicket" || name === "retainTicket")
			{
				const token = name === "newTicket" ? ++nextToken : data().getBigUint64(data().getUint32(args, true), true);
				data().setBigUint64(out, token, true); owners.get(owner).tokens.add(token); return 0;
			}
			assert.ok(["serial", "label"].includes(name));
			writeOwnedWasmScalar(module, out, name === "serial" ? "nat" : "string", name === "serial" ? 42n : "copied\0💠", {
				charge: () => {}, allocate: bytes => ownerAllocate(owner, bytes)
			}); return 0;
		}
		, retain: (type, token, out, owner) => {
			assert.equal(type, ticket.index); data().setBigUint64(out, token, true); owners.get(owner).tokens.add(token); return 0;
		}
		, close: () => { closed++; return 0; }, poison: () => { poisoned++; }
	};
	const supplied = structuredClone(layout), runtime = createOwnedWasmCalls(module, supplied, bindings, options);
	const call = (name, ...args) => runtime.call(layout.native.functions.find(fn => fn.name === name)?.id, args);
	return { module, bindings, runtime, call, memory, allocations, owners, supplied
		, counts: () => ({ poisoned, closed, calls, frees, mallocs }) };
};

test("typed calls free input arenas, release copied results and publish only opaque identities", () => {
	const f = fixture(), first = f.call("newTicket", 42n, "first");
	assert.equal(f.allocations.size, 0); assert.equal(f.owners.size, 1);
	assert.equal(f.call("serial", first), 42n); assert.equal(f.call("label", first), "copied\0💠");
	assert.equal(f.allocations.size, 0); assert.equal(f.owners.size, 1);
	assert.equal(f.call("retainTicket", first), first); assert.equal(f.owners.size, 1);
	const retained = first.retain(); assert.notEqual(retained, first);
	first.dispose(); assert.equal(f.call("serial", retained), 42n); retained.dispose();
	assert.equal(f.owners.size, 0); f.runtime.close(); assert.equal(f.counts().poisoned, 0);
});

test("recoverable argument and native status failures leave the component reusable", () => {
	const f = fixture(), dispatch = f.bindings.dispatch;
	assert.throws(() => f.call("newTicket", 1, "bad Nat"), TypeError);
	assert.throws(() => f.call("newTicket", 1n), /Expected 2 arguments/);
	assert.throws(() => f.call("unknown"), /Unknown/); assert.equal(f.counts().calls, 0);
	f.bindings.dispatch = () => 3;
	assert.throws(() => f.call("newTicket", 1n, "native allocation fault"), error => error.status === 3);
	assert.equal(f.owners.size, 0); assert.equal(f.allocations.size, 0); assert.equal(f.counts().poisoned, 0);
	f.bindings.dispatch = dispatch; const value = f.call("newTicket", 2n, "recovered"); value.dispose(); f.runtime.close();
});

test("every input arena allocation failure and result-slot exhaustion cleans up before retry", () => {
	const baseline = fixture(), value = baseline.call("newTicket", 1n << 100n, "dynamic");
	const total = baseline.counts().mallocs; value.dispose(); baseline.runtime.close();
	for(let failAt = 1; failAt <= total; ++failAt)
	{
		const f = fixture(), allocate = f.module._malloc; let attempt = 0;
		f.module._malloc = bytes => ++attempt === failAt ? 0 : allocate(bytes);
		assert.throws(() => f.call("newTicket", 1n << 100n, "dynamic"), /allocation failed/);
		assert.equal(f.allocations.size, 0); assert.equal(f.owners.size, 0); assert.equal(f.counts().poisoned, 0);
		f.module._malloc = allocate; f.call("newTicket", 1n, "retry").dispose(); f.runtime.close();
	}
	const f = fixture(); f.bindings.openOwner = () => 0;
	assert.throws(() => f.call("newTicket", 1n, "owner full"), /result allocation failed/);
	assert.equal(f.allocations.size, 0); assert.equal(f.counts().poisoned, 0); f.runtime.close();
});

test("all host publication checkpoints preserve the original exception and roll back native owners", () => {
	for(let failAt = 1; failAt <= 7; ++failAt)
	{
		let attempts = 0; const failure = { allocation: failAt };
		const f = fixture({ registry: { checkpoint: () => { if(++attempts === failAt) throw failure; } } });
		assert.throws(() => f.call("newTicket", 1n, "host fault"), error => error === failure);
		assert.equal(f.owners.size, 0); assert.equal(f.allocations.size, 0); assert.equal(f.counts().poisoned, 0);
		f.call("newTicket", 1n, "recovered").dispose(); f.runtime.close();
	}
});

test("native traps retire the heap before any free, release or subsequent invocation", () => {
	const f = fixture(), first = f.call("newTicket", 1n, "existing"), failure = new WebAssembly.RuntimeError("native trap");
	f.bindings.dispatch = () => { throw failure; };
	const before = f.counts().frees;
	assert.throws(() => f.call("serial", first), error => error === failure);
	assert.equal(f.counts().poisoned, 1); assert.equal(f.counts().frees, before); assert.equal(first.disposed, true);
	assert.throws(() => f.call("label", first), /poisoned/); f.runtime.close(); assert.equal(f.counts().closed, 0);
	assert.equal(f.counts().frees, before);
});

test("malformed allocations, statuses, result identities and span receipts poison the shared heap", () => {
	for(const mutate of [
		f => { f.module._malloc = () => 3; }
		, f => { f.bindings.openOwner = () => -1; }
		, f => { f.bindings.dispatch = () => 9; }
		, f => { f.bindings.dispatch = () => 99; }
		, f => { f.bindings.validOwner = () => 0; }
		, f => { f.bindings.claimIdentity = () => 0; }
		, f => { f.bindings.dispatch = (_index, _args, out) => { new DataView(f.memory.buffer).setBigUint64(out, 0n, true); return 0; }; }
	]) {
		const f = fixture(); mutate(f);
		assert.throws(() => f.call("newTicket", 1n, "malformed")); assert.equal(f.counts().poisoned, 1);
		assert.throws(() => f.call("newTicket", 1n, "retry"), /poisoned/); f.runtime.close();
	}
	const f = fixture(), value = f.call("newTicket", 1n, "existing"); f.bindings.claimAllocation = () => 0;
	assert.throws(() => f.call("label", value), /allocation claim/); assert.equal(f.counts().poisoned, 1); f.runtime.close();
});

test("reentrant close during argument access prevents dispatch and waits for call cleanup", () => {
	const f = fixture(), value = f.call("newTicket", 1n, "existing"), args = [];
	Object.defineProperty(args, 0, { get: () => { f.runtime.close(); return value; } });
	assert.throws(() => f.runtime.call(layout.native.functions.find(fn => fn.name === "serial").id, args), /closed/);
	assert.equal(f.counts().calls, 1); assert.equal(f.counts().closed, 1); assert.equal(f.allocations.size, 0); assert.equal(f.owners.size, 0);
});

test("a cleanup trap never replaces a host publication exception", () => {
	const failure = { host: "publication" }, f = fixture({ afterProjection: () => { throw failure; } });
	f.bindings.releaseOwner = () => { throw new WebAssembly.RuntimeError("release trap"); };
	assert.throws(() => f.call("newTicket", 1n, "unpublished"), error => error === failure);
	assert.equal(f.counts().poisoned, 1); f.runtime.close();
});

test("binding snapshots resist later descriptor edits", () => {
	const f = fixture(); f.supplied.native.functions.length = 0; f.supplied.types.length = 0;
	const value = f.call("newTicket", 1n, "stable descriptor"); assert.equal(f.call("serial", value), 42n);
	value.dispose(); f.runtime.close();
});
