/** @file Independent frame-fault tests for the shared synchronous IO runtime. */
import assert from "node:assert/strict";
import test from "node:test";
import { bindJavaScriptIO } from "../src/release/component-sync-io-runtime.mjs";
import { assertJavaScriptIOConfiguration } from "../src/release/javascript-wasm-io-package.mjs";

const build = ({result = "bool", args = [], errorId = null, error = null, respond, clear}) => {
	const memory = new Uint8Array(4096), view = new DataView(memory.buffer);
	let next = 64, poisoned = false, calls = 0, clears = 0;
	const frees = [];
	const malloc = size => { const p = next; next += Math.ceil(size / 8) * 8; return p; };
	const module = {HEAP8: memory, _free: p => frees.push(p), _malloc: malloc};
	const lifecycle = {poison: () => { poisoned = true; }, assertOpen: () => { if(poisoned) throw new Error("retired"); }};
	const abi = {methods: [{id: "f", args, result, error, errorId, tagBytes: 1}]};
	const invoke = f => {
		let status;
		if(view.getUint32(f + 12, true) === 0xffffffff)
		{
			clears++;
			if(clear) status = clear(f, view, memory);
			else
			{ memory.fill(0, f + 16, f + 48); status = 0; }
		}
		else
		{ calls++; status = respond(f, view, memory, calls); }
		view.setUint32(f + 8, status, true); return status;
	};
	const bind = () => bindJavaScriptIO(module, abi, invoke, lifecycle);
	return {client: bind(), peer: bind(), counts: () => ({calls, clears, frees: frees.length, poisoned})};
};

test("argument errors allocate nothing; recoverable statuses allow a subsequent call", () => {
	for(const status of [5, 9, 10, 11, 12])
	{
		const respond = (f, v, m, n) => {
			if(n === 1) return status;
			v.setBigUint64(f + 16, 1n, true); return 0;
		};
		const host = build({args: ["usize"], respond});
		assert.throws(() => host.client.call("f", [2**32]), RangeError);
		assert.deepEqual(host.counts(), {calls: 0, clears: 0, frees: 0, poisoned: false});
		assert.throws(() => host.client.call("f", [0]), new RegExp("status " + status));
		assert.equal(host.peer.call("f", [1]), true);
		assert.deepEqual(host.counts(), {calls: 2, clears: 1, frees: 2, poisoned: false});
	}
});

test("traps or malformed returns retire sibling bindings without re-entering native cleanup", () => {
	const faults = [
		["unknown status", "unit", () => 33]
		, ["trap", "unit", () => { throw new WebAssembly.RuntimeError("trap"); }]
		, ["boolean bits", "bool", (f, v) => { v.setBigUint64(f + 16, 2n, true); return 0; }]
		, ["invalid branch", ["bool", "bool"], (f, v) => { v.setUint8(f + 48, 2); return 0; }]
		, ["unused branch", "unit", (f, v) => { v.setUint8(f + 48, 1); return 0; }]
		, ["borrowed caller frame", "bytes", (f, v) => {
			v.setBigUint64(f + 16, BigInt(f), true); v.setBigUint64(f + 24, 1n, true); v.setBigUint64(f + 40, 1n, true); return 0;
		}]
		, ["truncated data", "bytes", (f, v) => {
			v.setBigUint64(f + 16, 4088n, true); v.setBigUint64(f + 24, 9n, true); v.setBigUint64(f + 40, 1n, true); return 0;
		}]
		, ["unaligned owner", "bytes", (f, v) => {
			v.setBigUint64(f + 16, 513n, true); v.setBigUint64(f + 24, 2n, true); v.setBigUint64(f + 40, 1n, true); return 0;
		}]
		, ["invalid UTF-8", "string", (f, v) => {
			v.setUint8(512, 0xff); v.setBigUint64(f + 16, 512n, true); v.setBigUint64(f + 24, 1n, true); v.setBigUint64(f + 40, 1n, true); return 0;
		}]
		, ["noncanonical integer", "nat", (f, v) => {
			v.setBigUint64(f + 16, 512n, true); v.setBigUint64(f + 24, 1n, true); v.setBigUint64(f + 40, 2n, true); return 0;
		}]
		, ["error with output ownership", "unit", (f, v) => { v.setBigUint64(f + 40, 2n, true); return 11; }]
	];
	for(const [label, result, respond] of faults)
	{
		const host = build({result, respond});
		assert.throws(() => host.client.call("f", []), undefined, label);
		assert.throws(() => host.peer.call("f", []), /retired/u, label);
		assert.deepEqual(host.counts(), {calls: 1, clears: 0, frees: 0, poisoned: true}, label);
	}
});

test("invalid cleanup never returns a successful value or frees storage again", () => {
	for(const clear of [() => 11, () => 0, () => { throw new WebAssembly.RuntimeError("cleanup trap"); }])
	{
		const host = build({respond: (f, v) => { v.setBigUint64(f + 16, 1n, true); return 0; }, clear});
		assert.throws(() => host.client.call("f", []));
		assert.throws(() => host.peer.call("f", []), /retired/u);
		assert.deepEqual(host.counts(), {calls: 1, clears: 1, frees: 0, poisoned: true});
	}
});

test("synchronous npm source scope requires an explicit empty effect grant", () => {
	const config = {schemaVersion: 1, modules: ["Ledger"], exports: ["Ledger.add"], nativeEffects: []};
	assert.doesNotThrow(() => assertJavaScriptIOConfiguration(config));
	const {nativeEffects, ...undeclared} = config;
	assert.deepEqual(nativeEffects, []);
	assert.throws(() => assertJavaScriptIOConfiguration(undeclared), /nativeEffects/u);
	assert.throws(() => assertJavaScriptIOConfiguration({...config, nativeEffects: ["filesystem"]}), /only in-memory/u);
	assert.throws(() => assertJavaScriptIOConfiguration({...config, taskExports: ["Ledger.add"]}), /taskExports/u);
});
