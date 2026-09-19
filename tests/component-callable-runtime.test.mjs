/**
 * Staged npm callback lifecycle checks with a synthetic Wasm transport.
 * These checks do not constitute compiled Lean or installed-package evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { assertComponentCallableAbi, componentCallableAbi, componentCallableDispatch } from "../src/abi/component-callables.mjs";
import { componentScalarTypes, assertComponentSignature } from "../src/abi/component-scalars.mjs";
import { createComponentCallableRuntime } from "../src/release/component-callable-runtime.mjs";
import { readComponentScalarSlot, writeComponentScalarSlot } from "../src/release/component-scalar-codec.mjs";

const primitive = name => ({ kind: "primitive", name });
const definition = (name, parameters = [name]) => ({ id: `callback:${name}`, key: String(componentScalarTypes.indexOf(name) + 1).padStart(40, "0"), parameters: parameters.map(primitive), result: primitive(name) });
const operation = (index, parameters, result) => ({ bindingId: `binding:${index}`, symbol: `lean_bridge_${String(index).padStart(24, "0")}`, resultMode: "value", parameters, result });
const descriptor = signatures => ({
	version: componentCallableAbi, dispatch: componentCallableDispatch
	, callbacks: signatures
	, exports: signatures.flatMap((signature, index) => [operation(index * 2, [...signature.parameters, { kind: "named", id: signature.id }], signature.result), operation(index * 2 + 1, [], { kind: "named", id: signature.id })]) });

// The synthetic native side pins an active closure independently of its lease.
const fixture = () => {
	const memory = new WebAssembly.Memory({ initial: 1, maximum: 2048 }), live = new Set(), native = new Map();
	let next = 256, nextLease = 0, released = 0, clearCount = 0;
	const module = { HEAP8: new Uint8Array(memory.buffer), _bridge_callable_abi: () => 1 };
	const data = () => new DataView(module.HEAP8.buffer);
	module._malloc = size => {
		const pointer = next; next += (Math.max(1, size) + 7) & ~7;
		if(next > memory.buffer.byteLength)
		{ memory.grow(Math.ceil((next - memory.buffer.byteLength) / 65536)); module.HEAP8 = new Uint8Array(memory.buffer); }
		live.add(pointer); return pointer;
	};
	module._free = pointer => assert.equal(live.delete(pointer), true, `double free of ${pointer}`);
	module._bridge_scalar_frame_validate = (frame, count) => {
		if(frame % 8 || frame < 0 || frame + 32 + count * 16 > module.HEAP8.length) return 1;
		return Number(data().getUint32(frame, true) !== 2 || data().getUint32(frame + 4, true) !== 32 + count * 16 || data().getUint32(frame + 12, true) !== count || data().getBigUint64(frame + 24, true) !== 0n || data().getUint32(frame + 20, true) !== 0);
	};
	module._bridge_scalar_frame_clear = frame => {
		clearCount++;
		if(data().getUint32(frame + 20, true) & 2) module._free(data().getUint32(frame + 24, true));
		module.HEAP8.fill(0, frame + 16, frame + 32);
	};
	const readKey = pointer => new TextDecoder().decode(module.HEAP8.subarray(pointer, pointer + 40));
	const result = (frame, type, value) => {
		let copied = false;
		writeComponentScalarSlot(module, frame + 16, type, value, size => { copied = true; return module._malloc(size); });
		if(copied) data().setUint32(frame + 20, data().getUint32(frame + 20, true) | 2, true);
		return 0;
	};
	module._bridge_callable_invoke = (token, key, frame) => {
		const state = native.get(token);
		if(!state || state.signature.key !== readKey(key) || state.disposed) return 9;
		state.active++;
		try
		{ return state.invoke(frame); }
		finally
		{ state.active--; if(state.disposed && state.active === 0) native.delete(token); }
	};
	module._bridge_callable_release = (token, key) => {
		const state = native.get(token);
		if(!state || state.signature.key !== readKey(key) || state.disposed) return 0;
		state.disposed = true; released++;
		if(state.active === 0) native.delete(token);
		return 1;
	};
	const store = (signature, invoke) => {
		const token = ++nextLease; native.set(token, { signature, invoke, disposed: false, active: 0 }); return token;
	};
	const invokeHost = (token, signature, args, key = signature.key) => {
		const allocations = [], allocate = size => { const pointer = module._malloc(size); allocations.push(pointer); return pointer; };
		const size = 32 + args.length * 16, frame = allocate(size);
		module.HEAP8.fill(0, frame, frame + size);
		data().setUint32(frame, 2, true); data().setUint32(frame + 4, size, true); data().setUint32(frame + 12, args.length, true);
		try
		{
			args.forEach((value, index) => writeComponentScalarSlot(module, frame + 32 + index * 16, signature.parameters[index].name, value, allocate));
			const status = module.bridgeCallableDispatch(token, key, frame);
			return { status, value: status === 0 ? readComponentScalarSlot(module, frame + 16, signature.result.name) : undefined };
		}
		finally
		{
			module._bridge_scalar_frame_clear(frame);
			for(const pointer of allocations.reverse()) module._free(pointer);
		}
	};
	const runtime = createComponentCallableRuntime(module);
	return { module, native, result, store, invokeHost, runtime
		, read: (frame, index, type) => readComponentScalarSlot(module, frame + 32 + index * 16, type)
		, counts: () => ({ allocations: live.size, leases: native.size, released, clearCount }) };
};

const primitiveValues = [undefined, true, 255, 65535, 0xffffffff, (1n << 64n) - 1n, -128, -32768, -0x80000000, -(1n << 63n), (1n << 4096n) + 23n, -(1n << 4096n), -0, NaN, "\uFEFF\0🌱", new Uint8Array([0, 128, 255]), "🌱", 0xffffffff, -0x80000000];

test("the staged callable ABI is closed, bounded and leaves ordinary scalar admission unchanged", () => {
	const abi = descriptor(componentScalarTypes.map(name => definition(name)));
	assertComponentCallableAbi(abi);
	assert.throws(() => assertComponentSignature(abi.exports[0]), { code: "unsupported-component-signature" });
	for(const corrupt of [
		value => { value.extra = true; }, value => { value.version = 2; }
			, value => { value.callbacks[0].parameters = []; }
			, value => { value.callbacks[0].parameters = new Array(1); }
		, value => { value.callbacks[0].parameters = Array(17).fill(primitive("unit")); }
		, value => { value.callbacks[0].result = { kind: "named", id: "callback:bool" }; }
		, value => { value.callbacks[0].key = value.callbacks[1].key; }
		, value => { value.callbacks[0].id = value.callbacks[1].id; }
		, value => { value.exports[0].resultMode = "promise"; }
			, value => { value.exports[0].parameters = Array(33).fill(primitive("unit")); }
			, value => { value.exports[0].parameters = new Array(1); }
		, value => { value.exports[0].parameters[1].id = "unknown"; }
		, value => { value.exports[0].symbol = value.exports[1].symbol; }
		, value => { value.exports[0].bindingId = value.exports[1].bindingId; }
		, value => { value.exports.splice(0, 2); }
	]){
		const invalid = structuredClone(abi); corrupt(invalid);
		assert.throws(() => assertComponentCallableAbi(invalid), { code: "invalid-component-callable-abi" });
	}
});

test("synthetic callback frames preserve nineteen primitive types, including copied results and large integers", () => {
	const f = fixture(), abi = descriptor(componentScalarTypes.map(name => definition(name)));
	const operations = new Map();
	for(const [index, signature] of abi.callbacks.entries())
	{
		operations.set(`binding:${index * 2}`, frame => {
			const type = signature.result.name, value = f.read(frame, 0, type), token = f.read(frame, 1, "uint32");
			const returned = f.invokeHost(token, signature, [value]);
			return f.result(frame, type, returned.status ? value : returned.value);
		});
		operations.set(`binding:${index * 2 + 1}`, frame => f.result(frame, "uint32", f.store(signature, inner => f.result(inner, signature.result.name, f.read(inner, 0, signature.result.name)))));
	}
	const api = f.runtime.bind(abi, operations);
	for(const [index, value] of primitiveValues.entries())
	{
		let count = 0;
		assert.deepEqual(api.call(`binding:${index * 2}`, [value, input => { count++; assert.deepEqual(input, value); return input; }]), value);
		assert.equal(count, 1);
		const closure = api.call(`binding:${index * 2 + 1}`, []);
		assert.equal(closure.disposed, false); assert.deepEqual(closure(value), value);
		assert.throws(() => closure(), /Expected 1 arguments/);
		assert.equal(closure.dispose(), true); assert.equal(closure.dispose(), false);
		assert.equal(closure.disposed, true); assert.throws(() => closure(value), /disposed/);
	}
	assert.equal(f.counts().allocations, 0); assert.equal(f.counts().leases, 0);
});

const single = (nativeCall, name = "uint32") => {
	const f = fixture(), signature = definition(name), abi = descriptor([signature]);
	const operations = new Map([["binding:0", frame => nativeCall(f, frame, signature)]
		, ["binding:1", frame => f.result(frame, "uint32", f.store(signature, inner => f.result(inner, name, f.read(inner, 0, name))))]]);
	return { ...f, signature, api: f.runtime.bind(abi, operations) };
};

test("callback exceptions, including thrown undefined, retain identity after arena cleanup and suppress repeated callbacks", () => {
	for(const error of [new Error("original callback"), undefined, null, 0])
	{
		let calls = 0;
		const f = single((f, frame, signature) => {
			const token = f.read(frame, 1, "uint32");
			assert.equal(f.invokeHost(token, signature, [1]).status, 8);
			assert.equal(f.invokeHost(token, signature, [2]).status, 8);
			return f.result(frame, "uint32", 0);
		});
		let caught = false;
		try
{ f.api.call("binding:0", [1, () => { calls++; throw error; }]); }
		catch(actual)
{ caught = true; assert.equal(actual, error); }
		assert.equal(caught, true); assert.equal(calls, 1); assert.equal(f.counts().allocations, 0);
	}
});

test("callback scopes expire after return, tokens are not recycled, and signatures cannot be substituted", () => {
	const tokens = [];
	const f = single((f, frame, signature) => {
		const token = f.read(frame, 1, "uint32"); tokens.push(token);
		if(tokens.length > 1) assert.equal(f.invokeHost(tokens[0], signature, [1]).status, 8);
		else assert.equal(f.invokeHost(token, signature, [1]).status, 0);
		return f.result(frame, "uint32", 1);
	});
	assert.equal(f.api.call("binding:0", [1, value => value]), 1);
	assert.throws(() => f.api.call("binding:0", [1, value => value]), /Expired/);
	assert.notEqual(tokens[0], tokens[1]);
	assert.equal(f.invokeHost(tokens[0], f.signature, [1]).status, 8);
	const wrong = single((f, frame, signature) => {
		assert.equal(f.invokeHost(f.read(frame, 1, "uint32"), signature, [1], "f".repeat(40)).status, 8);
		return f.result(frame, "uint32", 1);
	});
	assert.throws(() => wrong.api.call("binding:0", [1, () => assert.fail("wrong signature invoked")]), /wrong-signature/);
	assert.equal(f.counts().allocations, 0); assert.equal(wrong.counts().allocations, 0);
});

test("nested callbacks keep independent arenas and reject the sixty-fifth frame before invocation", () => {
	const f = single((f, frame, signature) => {
		const input = f.read(frame, 0, "uint32"), token = f.read(frame, 1, "uint32");
		const result = f.invokeHost(token, signature, [input]);
		return f.result(frame, "uint32", result.status ? 0 : result.value);
	});
	const recurse = value => value === 0 ? 42 : f.api.call("binding:0", [value - 1, recurse]);
	assert.equal(f.api.call("binding:0", [63, recurse]), 42);
	assert.throws(() => f.api.call("binding:0", [64, recurse]), /reentry limit/);
	assert.equal(f.api.call("binding:0", [1, recurse]), 42);
	assert.equal(f.counts().allocations, 0);
});

test("invalid host returns and out-of-range arguments reject with deterministic cleanup", () => {
	const f = single((f, frame, signature) => {
		const result = f.invokeHost(f.read(frame, 1, "uint32"), signature, [1]);
		return f.result(frame, "uint32", result.status ? 0 : result.value);
	});
	for(const value of [-1, 0x100000000, 1n, "1", Promise.resolve(1)]) assert.throws(() => f.api.call("binding:0", [1, () => value]));
	assert.throws(() => f.api.call("binding:0", [-1, value => value]));
	assert.throws(() => f.api.call("binding:0", [1, null]));
	assert.equal(f.api.call("binding:0", [1, value => value]), 1);
	assert.equal(f.counts().allocations, 0);
});

test("owned calls can dispose themselves while their synthetic native pin remains active", () => {
	const f = fixture(), signature = definition("uint32"), abi = descriptor([signature]);
	let closure, token;
	const make = frame => {
		token = f.store(signature, inner => {
			assert.equal(closure.dispose(), true);
			assert.equal(f.native.get(token).active, 1);
			assert.throws(() => closure(1), /disposed/);
			return f.result(inner, "uint32", 42);
		});
		return f.result(frame, "uint32", token);
	};
	const api = f.runtime.bind(abi, new Map([["binding:0", () => 1], ["binding:1", make]]));
	closure = api.call("binding:1", []); assert.equal(closure(1), 42);
	assert.equal(f.counts().leases, 0); assert.equal(f.counts().released, 1); assert.equal(f.counts().allocations, 0);
});

test("failed callbacks release an unreturned Lean lease and preserve the first exception", () => {
	const f = fixture(), signature = definition("uint32"), abi = descriptor([signature]);
	abi.exports[0].result = { kind: "named", id: signature.id };
	const error = new Error("must not expose closure");
	const attempt = frame => {
		f.invokeHost(f.read(frame, 1, "uint32"), signature, [1]);
		return f.result(frame, "uint32", f.store(signature, () => 0));
	};
	const api = f.runtime.bind(abi, new Map([["binding:0", attempt], ["binding:1", () => 1]]));
	assert.throws(() => api.call("binding:0", [1, () => { throw error; }]), actual => actual === error);
	assert.equal(f.counts().leases, 0); assert.equal(f.counts().released, 1); assert.equal(f.counts().allocations, 0);
});

test("descriptor mutation cannot change an already bound call and allocation failure does not poison the runtime", () => {
	const f = fixture(), signature = definition("uint32"), abi = descriptor([signature]);
	const api = f.runtime.bind(abi, new Map([["binding:0", frame => f.result(frame, "uint32", 42)], ["binding:1", () => 1]]));
	abi.exports[0].parameters.length = 0; signature.parameters[0].name = "string";
	const allocate = f.module._malloc; f.module._malloc = () => 0;
	assert.throws(() => api.call("binding:0", [1, value => value]), /allocation failed/);
	f.module._malloc = allocate;
	assert.equal(api.call("binding:0", [1, value => value]), 42);
	assert.equal(f.counts().allocations, 0);
});

test("failed native status cannot leak a populated owned result", () => {
	const f = fixture(), signature = definition("uint32");
	const make = frame => {
		f.result(frame, "uint32", f.store(signature, () => 0)); return 9;
	};
	const api = f.runtime.bind(descriptor([signature]), new Map([["binding:0", () => 1], ["binding:1", make]]));
	assert.throws(() => api.call("binding:1", []), /call failed/);
	assert.equal(f.counts().leases, 0); assert.equal(f.counts().released, 1); assert.equal(f.counts().allocations, 0);
});

test("the shared host-callback capacity recovers after an overfull nested call", () => {
	const f = fixture(), signature = definition("uint32"), abi = descriptor([signature]);
	abi.exports[0].parameters = Array.from({ length: 32 }, () => ({ kind: "named", id: signature.id }));
	const attempt = frame => {
		const returned = f.invokeHost(f.read(frame, 0, "uint32"), signature, [1]);
		return f.result(frame, "uint32", returned.status ? 0 : returned.value);
	};
	const api = f.runtime.bind(abi, new Map([["binding:0", attempt], ["binding:1", () => 1]]));
	const recurse = () => api.call("binding:0", Array(32).fill(recurse));
	assert.throws(recurse, /registry is full/);
	assert.equal(api.call("binding:0", Array(32).fill(() => 42)), 42);
	assert.equal(f.counts().allocations, 0);
});

test("owned lease capacity rejects and releases overflow, then recovers after disposal", () => {
	const f = single(() => 1), closures = [];
	for(let index = 0; index < 1024; index++) closures.push(f.api.call("binding:1", []));
	assert.throws(() => f.api.call("binding:1", []), /registry is full/);
	assert.equal(f.counts().leases, 1024); assert.equal(f.counts().released, 1);
	for(const closure of closures) closure[Symbol.dispose]();
	for(let index = 0; index < 2050; index++)
	{
		const closure = f.api.call("binding:1", []); assert.equal(closure(42), 42); closure.dispose();
	}
	assert.equal(f.counts().leases, 0); assert.equal(f.counts().allocations, 0);
});

test("the sixteen MiB budget counts all copied callback arguments and results in one call", () => {
	const payload = "x".repeat(512 * 1024);
	const f = single((f, frame, signature) => {
		const token = f.read(frame, 1, "uint32");
		for(let index = 0; index < 18; index++) f.invokeHost(token, signature, [payload]);
		return f.result(frame, "string", "");
	}, "string");
	let calls = 0;
	assert.throws(() => f.api.call("binding:0", ["", value => { calls++; return value; }]), /copy budget/);
	assert.equal(calls, 16); assert.equal(f.counts().allocations, 0);
});

test("Wasm traps poison the shared callable runtime and stale leases cannot reenter it", () => {
	const failure = new WebAssembly.RuntimeError("synthetic trap");
	const f = single(() => { throw failure; });
	const closure = f.api.call("binding:1", []);
	assert.throws(() => f.api.call("binding:0", [1, value => value]), actual => actual === failure);
	assert.throws(() => closure(1), /poisoned/); assert.equal(closure.disposed, true);
	assert.throws(() => f.runtime.assertOpen(), /poisoned/);
	assert.equal(closure.dispose(), true); assert.equal(closure.dispose(), false);
	assert.equal(f.counts().allocations, 0);
});

test("callable initialization rejects old runtimes and duplicate dispatchers", () => {
	assert.throws(() => createComponentCallableRuntime({}), /lacks/);
	const f = fixture(); assert.throws(() => createComponentCallableRuntime(f.module), /already initialized/);
	assert.throws(() => createComponentCallableRuntime({ ...f.module, _bridge_callable_abi: () => 9 }), /version/);
});

test("sixteen-argument callbacks keep order across differently sized copied payloads", () => {
	const names = ["string", "nat", "int", "bytes", "bool", "char", "float32", "float64", "uint64", "int64", "uint8", "uint16", "uint32", "int32", "usize", "isize"];
	const signature = definition("string", names), abi = descriptor([signature]), f = fixture();
	const values = names.map(name => primitiveValues[componentScalarTypes.indexOf(name)]);
	const invoke = frame => {
		const token = f.read(frame, 16, "uint32");
		const args = names.map((type, index) => f.read(frame, index, type));
		const returned = f.invokeHost(token, signature, args);
		return f.result(frame, "string", returned.status ? "" : returned.value);
	};
	const api = f.runtime.bind(abi, new Map([["binding:0", invoke], ["binding:1", () => 1]]));
	assert.equal(api.call("binding:0", [...values, (...args) => { assert.deepEqual(args, values); return "\uFEFFsixteen\0🌱"; }]), "\uFEFFsixteen\0🌱");
	assert.equal(f.counts().allocations, 0);
});

test("finalizer fallback queues disposal and does not double-release an explicitly disposed lease", async t => {
	let collected, held;
	/**
	 * Capture a collection notification without depending on GC scheduling.
	 *
	 * @param callback - Runtime-owned finalization callback.
	 */
	function Registry(callback)
	{
		collected = callback;
		return { register: (_target, state) => { held = state; }, unregister: () => true };
	}
	t.mock.method(globalThis, "FinalizationRegistry", Registry);
	const f = single(() => 1), closure = f.api.call("binding:1", []);
	collected(held);
	assert.equal(f.counts().released, 0);
	await Promise.resolve();
	assert.equal(f.counts().released, 1); assert.equal(closure.disposed, true);
	assert.equal(closure.dispose(), false);
	const other = f.api.call("binding:1", []); collected(held); other.dispose();
	await Promise.resolve();
	assert.equal(f.counts().released, 2); assert.equal(f.counts().allocations, 0);
});
