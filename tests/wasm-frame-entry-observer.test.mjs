/**
 * Portable frame counter controls; these are synthetic Wasm, not installed Lean acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { wasmFrameEntry, withWasmFrameEntryObserver } from "./helpers/wasm-frame-entry-observer.mjs";

const vector = parts => [parts.length, ...parts.flat()];
const name = text => [text.length, ...new TextEncoder().encode(text)];
const section = (id, bytes) => [id, bytes.length, ...bytes];
const fixture = ({ symbol = "frame", arity = 1, trap = false, increment = 19 } = {}) => {
	const body = trap ? [0, 0, 0x0b] : [0, ...arity ? [0x20, 0] : [0x41, 0], 0x41, increment, 0x6a, 0x0b];
	return new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0
		, ...section(1, [1, 0x60, ...vector(Array(arity).fill([0x7f])), 1, 0x7f])
		, ...section(3, [1, 0])
		, ...section(7, vector([[...name(symbol), 0, 0], [...name("unselected"), 0, 0]]))
		, ...section(10, [1, body.length, ...body])]);
};
const descriptor = key => Object.getOwnPropertyDescriptor(WebAssembly, key);
const snapshots = () => [descriptor("instantiate"), descriptor("instantiateStreaming")];
const observe = (moduleBytes, run, symbols = ["frame"]) => withWasmFrameEntryObserver({ moduleBytes, symbols }, run);

test("the typed frame entry is a native funcref and preserves values and traps", () => {
	const instance = new WebAssembly.Instance(new WebAssembly.Module(fixture()));
	let calls = 0;
	const entry = wasmFrameEntry(instance.exports.frame, () => { calls++; });
	const table = new WebAssembly.Table({ initial: 1, element: "anyfunc" }); table.set(0, entry);
	for(const input of [0, 23, -1, 0x7fffffff, 0xffffffff])
		assert.equal(table.get(0)(input), instance.exports.frame(input));
	assert.equal(calls, 5);
	const trapped = new WebAssembly.Instance(new WebAssembly.Module(fixture({ trap: true })));
	assert.throws(() => wasmFrameEntry(trapped.exports.frame, () => { calls++; })(0), WebAssembly.RuntimeError);
	assert.equal(calls, 6);
});

test("frame signatures are explicit and JS or differently typed functions are refused", () => {
	assert.throws(() => wasmFrameEntry(() => 0, () => {}), TypeError);
	for(const arity of [0, 2, 5])
	{
		const instance = new WebAssembly.Instance(new WebAssembly.Module(fixture({ arity })));
		assert.throws(() => wasmFrameEntry(instance.exports.frame, () => {}), WebAssembly.LinkError);
	}
});

test("one exact component keeps untouched exports and counts only the selected funcref", async () => {
	const bytes = fixture(), original = bytes.slice(), before = snapshots();
	const observed = await observe(bytes, async snapshot => {
		assert.deepEqual(snapshot(), [0]);
		const { module, instance } = await WebAssembly.instantiate(bytes);
		assert.ok(module instanceof WebAssembly.Module); assert.ok(instance instanceof WebAssembly.Instance);
		assert.equal(Object.getPrototypeOf(instance.exports), null);
		assert.deepEqual(Object.keys(instance.exports), ["frame", "unselected"]);
		assert.equal(instance.exports.unselected(4), 23); assert.deepEqual(snapshot(), [0]);
		const table = new WebAssembly.Table({ initial: 1, element: "anyfunc" }); table.set(0, instance.exports.frame);
		assert.equal(table.get(0)(23), 42); assert.deepEqual(snapshot(), [1]);
		const copy = snapshot(); copy[0] = 1000; assert.deepEqual(snapshot(), [1]);
		return table.get(0)(77);
	});
	assert.deepEqual(observed, { value: 96, counts: [2] });
	assert.deepEqual(bytes, original); assert.deepEqual(snapshots(), before);
});

test("byte-offset views identify the exact module; unrelated modules pass through", async () => {
	const bytes = fixture(), padded = new Uint8Array(bytes.length + 10); padded.set(bytes, 5);
	const view = new DataView(padded.buffer, 5, bytes.length);
	const result = await observe(view, async () => {
		const unrelated = await WebAssembly.instantiate(fixture({ symbol: "other" }));
		assert.equal(unrelated.instance.exports.other(1), 20);
		return (await WebAssembly.instantiate(padded.subarray(5, 5 + bytes.length))).instance.exports.frame(2);
	});
	assert.deepEqual(result, { value: 21, counts: [1] });
});

test("streaming uses the same byte identity and leaves the response body for the native loader", async () => {
	const bytes = fixture(), before = snapshots();
	const result = await observe(bytes, async () => {
		const response = new Response(bytes, { headers: { "Content-Type": "application/wasm" } });
		const { instance } = await WebAssembly.instantiateStreaming(Promise.resolve(response));
		return instance.exports.frame(23);
	});
	assert.deepEqual(result, { value: 42, counts: [1] }); assert.deepEqual(snapshots(), before);
});

test("absent selected loads and precompiled Module inputs refuse acceptance and restore hooks", async () => {
	const bytes = fixture(), before = snapshots();
	await assert.rejects(() => observe(bytes, async () => {}), /did not instantiate/u);
	assert.deepEqual(snapshots(), before);
	await assert.rejects(() => observe(bytes, async () => WebAssembly.instantiate(new WebAssembly.Module(bytes))), /precompiled Module/u);
	assert.deepEqual(snapshots(), before);
	await assert.rejects(() => observe(bytes, async () => new WebAssembly.Instance(new WebAssembly.Module(bytes))), /did not instantiate/u);
	assert.deepEqual(snapshots(), before);
});

test("different bytes exposing the same selected export fail closed", async () => {
	const bytes = fixture(), before = snapshots();
	await assert.rejects(() => observe(bytes, async () => WebAssembly.instantiate(fixture({ increment: 20 }))), /different module/u);
	assert.deepEqual(snapshots(), before);
});

test("unrelated precompiled modules pass without letting selected modules bypass byte authentication", async () => {
	const bytes = fixture(), before = snapshots();
	const result = await observe(bytes, async () => {
		const unrelated = await WebAssembly.instantiate(new WebAssembly.Module(fixture({ symbol: "other" })));
		assert.ok(unrelated instanceof WebAssembly.Instance); assert.equal(unrelated.exports.other(1), 20);
		return (await WebAssembly.instantiate(bytes)).instance.exports.frame(1);
	});
	assert.deepEqual(result, { value: 20, counts: [1] }); assert.deepEqual(snapshots(), before);
});

test("a caller cannot swallow a wrong-module refusal and report a later valid load", async () => {
	const bytes = fixture(), before = snapshots();
	await assert.rejects(() => observe(bytes, async () => {
		await assert.rejects(() => WebAssembly.instantiate(fixture({ increment: 20 })), /different module/u);
		return (await WebAssembly.instantiate(bytes)).instance.exports.frame(1);
	}), /different module/u);
	assert.deepEqual(snapshots(), before);
});

test("nested observers are refused without replacing the outer hooks", async () => {
	const bytes = fixture(), before = snapshots();
	await observe(bytes, async () => {
		const outer = snapshots();
		await assert.rejects(() => observe(bytes, async () => {}), /exclusive realm/u);
		assert.deepEqual(snapshots(), outer);
		await WebAssembly.instantiate(bytes);
	});
	assert.deepEqual(snapshots(), before);
});

test("missing selected exports and wrong signatures cannot masquerade as an observed component", async () => {
	const before = snapshots();
	const missing = fixture({ symbol: "other" });
	await assert.rejects(() => observe(missing, async () => WebAssembly.instantiate(missing)), /missing frame export/u);
	assert.deepEqual(snapshots(), before);
	const wrong = fixture({ arity: 5 });
	await assert.rejects(() => observe(wrong, async () => WebAssembly.instantiate(wrong)), WebAssembly.LinkError);
	assert.deepEqual(snapshots(), before);
});

test("duplicate sequential and concurrent component loads are refused", async () => {
	const bytes = fixture(), before = snapshots();
	await assert.rejects(() => observe(bytes, async () => {
		await WebAssembly.instantiate(bytes); await WebAssembly.instantiate(bytes);
	}), /more than once/u);
	assert.deepEqual(snapshots(), before);
	await assert.rejects(() => observe(bytes, async () => {
		const attempts = await Promise.allSettled([WebAssembly.instantiate(bytes), WebAssembly.instantiate(bytes)]);
		const failure = attempts.find(item => item.status === "rejected"); assert.ok(failure); throw failure.reason;
	}), /more than once/u);
	assert.deepEqual(snapshots(), before);
});

test("throwing loader or callee preserves the exception and restores every hook", async () => {
	const bytes = fixture(), before = snapshots(), error = new Error("caller failure");
	await assert.rejects(() => observe(bytes, async () => { throw error; }), received => received === error);
	assert.deepEqual(snapshots(), before);
	const trapped = fixture({ trap: true });
	await assert.rejects(() => observe(trapped, async () => (await WebAssembly.instantiate(trapped)).instance.exports.frame(0)), WebAssembly.RuntimeError);
	assert.deepEqual(snapshots(), before);
});

test("changing the supplied bytes or replacing a hook refuses acceptance and restores native APIs", async () => {
	const bytes = fixture(), before = snapshots();
	await assert.rejects(() => observe(bytes, async () => {
		await WebAssembly.instantiate(bytes); bytes[0] = 1;
	}), /bytes changed/u);
	assert.deepEqual(snapshots(), before);
	const intact = fixture();
	await assert.rejects(() => observe(intact, async () => {
		await WebAssembly.instantiate(intact); WebAssembly.instantiate = before[0].value;
	}), /hook was replaced/u);
	assert.deepEqual(snapshots(), before);
});

test("the selected export set must be explicit, distinct and nonempty", async () => {
	const bytes = fixture(), before = snapshots();
	for(const symbols of [[], ["frame", "frame"], [undefined], [""], ["../frame"], null])
		await assert.rejects(() => observe(bytes, async () => {}, symbols), /distinct named/u);
	await assert.rejects(() => observe(new Uint8Array(), async () => {}), /bytes are required/u);
	await assert.rejects(() => observe(new Uint8Array([0, 1, 2]), async () => {}), /valid Wasm/u);
	assert.deepEqual(snapshots(), before);
});

test("each selected symbol gets its own counter without rewriting the original module", async () => {
	const bytes = fixture(), copy = bytes.slice();
	const result = await observe(bytes, async snapshot => {
		const { instance } = await WebAssembly.instantiate(bytes);
		instance.exports.frame(0); instance.exports.unselected(0); instance.exports.unselected(0);
		assert.deepEqual(snapshot(), [1, 2]);
	}, ["frame", "unselected"]);
	assert.deepEqual(result.counts, [1, 2]); assert.deepEqual(bytes, copy);
});
