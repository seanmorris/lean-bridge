/**
 * Staged npm callable transport, scoped to one prepared shared Wasm runtime.
 * Callback exceptions stay in JavaScript until Lean returns and cleanup completes.
 *
 * @file
 */
import { assertComponentCallableAbi, componentCallableCapacity, componentCallableDepth } from "../abi/component-callables.mjs";
import { componentScalarAbi, scalarCopyLimit, scalarFrameHeaderBytes, scalarSlotBytes } from "../abi/component-scalars.mjs";
import { readComponentScalarSlot, writeComponentScalarSlot } from "./component-scalar-codec.mjs";

const encoder = new TextEncoder();
const required = ["_bridge_callable_abi", "_bridge_callable_invoke", "_bridge_callable_release", "_bridge_scalar_frame_validate", "_bridge_scalar_frame_clear", "_malloc", "_free"];
const runtimes = new WeakSet();
const tokenValid = token => Number.isInteger(token) && token > 0 && token <= 0xffffffff;

/**
 * Own callbacks and closure leases for a shared heap, without exposing raw tokens.
 * Call bind only after the loader has authenticated a descriptor and its side module.
 *
 * @param module - Prepared Emscripten module implementing the private callable helpers.
 */
export const createComponentCallableRuntime = module => {
	if(runtimes.has(module)) throw new TypeError("Component callable runtime already initialized");
	if(required.some(name => typeof module[name] !== "function") || module.bridgeCallableDispatch !== undefined) throw new TypeError("Shared runtime lacks the component callable ABI");
	if(module._bridge_callable_abi() !== 1) throw new TypeError("Unsupported component callable runtime version");
	const callbacks = new Map(), leases = new Map(), frames = [];
	let nextToken = 0, poisoned = false;
	const requireOpen = () => { if(poisoned) throw new Error("Component callable runtime is poisoned"); };
	const record = (frame, error) => {
		if(frame && !frame.failed)
		{ frame.failed = true; frame.error = error; }
	};
	const allocate = bytes => {
		if(!Number.isSafeInteger(bytes) || bytes < 0 || bytes > scalarCopyLimit) throw new RangeError("Component copy budget exceeded");
		const pointer = module._malloc(Math.max(1, bytes));
		if(!pointer) throw new Error("Component allocation failed");
		return pointer;
	};
	const charge = (frame, bytes) => {
		if(bytes > frame.remaining) throw new RangeError("Component callable copy budget exceeded");
		frame.remaining -= bytes;
	};
	const withKind = (key, operation) => {
		const bytes = encoder.encode(`${key}\0`), pointer = allocate(bytes.length);
		try
		{ module.HEAP8.set(bytes, pointer); return operation(pointer); }
		finally
		{ module._free(pointer); }
	};
	const release = state => {
		if(state.disposed) return false;
		state.disposed = true; leases.delete(state.token);
		finalizer?.unregister(state);
		if(!poisoned)
		{
			try
			{ withKind(state.signature.key, key => module._bridge_callable_release(state.token, key)); }
			catch(error)
			{ poisoned = true; throw error; }
		}
		return true;
	};
	// Finalizers only enqueue work. Explicit dispose remains the deterministic API.
	const finalizer = typeof FinalizationRegistry === "function" ? new FinalizationRegistry(state => {
		queueMicrotask(() => {
			try
			{ release(state); }
			catch { /* The runtime is poisoned by release. */ }
		});
	}) : null;
	const owned = (token, signature) => {
		if(!tokenValid(token) || leases.has(token)) throw new TypeError("Invalid or duplicate Lean closure token");
		const state = { token, signature, disposed: false };
		if(leases.size >= componentCallableCapacity)
		{
			withKind(signature.key, key => module._bridge_callable_release(token, key));
			throw new RangeError("Lean closure registry is full");
		}
		leases.set(token, state);
		try
		{
			const callable = (...args) => {
				requireOpen();
				if(state.disposed) throw new Error("Lean closure is disposed");
				return withKind(signature.key, key => call(frame => module._bridge_callable_invoke(token, key, frame), signature, args, new Map()));
			};
			Object.defineProperties(callable, {
				disposed: { get: () => state.disposed || poisoned }
				, dispose: { value: () => release(state) }
				, [Symbol.dispose]: { value: () => { release(state); } }
			});
			finalizer?.register(callable, state, state);
			return Object.freeze(callable);
		}
		catch(error)
		{ release(state); throw error; }
	};
	const call = (operation, signature, args, types) => {
		requireOpen();
		if(!Array.isArray(args) || args.length !== signature.parameters.length) throw new TypeError(`Expected ${signature.parameters.length} arguments`);
		if(frames.length >= componentCallableDepth) throw new RangeError("Component callable reentry limit (64) exceeded");
		const scope = { failed: false, error: undefined, remaining: scalarCopyLimit, callbacks: [], allocations: [] };
		let frame = 0, pendingLease = 0;
		const arena = bytes => { const pointer = allocate(bytes); scope.allocations.push(pointer); return pointer; };
		frames.push(scope);
		try
		{
			const size = scalarFrameHeaderBytes + scalarSlotBytes * args.length;
			frame = arena(size); module.HEAP8.fill(0, frame, frame + size);
			let data = new DataView(module.HEAP8.buffer);
			data.setUint32(frame, componentScalarAbi, true); data.setUint32(frame + 4, size, true); data.setUint32(frame + 12, args.length, true);
			for(const [index, type] of signature.parameters.entries())
			{
				let value = args[index];
				if(type.kind === "named")
				{
					if(typeof value !== "function") throw new TypeError("Expected a synchronous callback");
					if(callbacks.size >= componentCallableCapacity || nextToken === 0xffffffff) throw new RangeError("Host callback registry is full or exhausted");
					const token = ++nextToken;
					callbacks.set(token, { value, signature: types.get(type.id), scope }); scope.callbacks.push(token); value = token;
				}
				writeComponentScalarSlot(module, frame + scalarFrameHeaderBytes + index * scalarSlotBytes, type.kind === "named" ? "uint32" : type.name, value, bytes => { charge(scope, bytes); return arena(bytes); });
			}
			let status;
			try
			{ status = operation(frame); }
			catch(error)
			{ poisoned = true; throw error; }
			data = new DataView(module.HEAP8.buffer);
			if(signature.result.kind === "named")
			{
				// A failed call can still have populated an owned result. Never lose it.
				try
				{ pendingLease = readComponentScalarSlot(module, frame + 16, "uint32"); }
				catch { /* The ordinary result check below reports malformed slots. */ }
			}
			if(status !== 0 || data.getUint32(frame + 8, true) !== 0) throw new Error(`Component callable call failed (${status})`);
			const result = readComponentScalarSlot(module, frame + 16, signature.result.kind === "named" ? "uint32" : signature.result.name, bytes => charge(scope, bytes));
			if(scope.failed) throw scope.error;
			if(signature.result.kind === "named")
			{
				pendingLease = 0; // owned either accepts the lease or releases it on failure.
				return owned(result, types.get(signature.result.id));
			}
			return result;
		}
		catch(error)
		{ if(scope.failed) throw scope.error; throw error; }
		finally
		{
			for(const token of scope.callbacks) callbacks.delete(token);
			frames.pop();
			try
			{
				if(tokenValid(pendingLease) && !leases.has(pendingLease) && !poisoned)
					withKind(types.get(signature.result.id).key, key => module._bridge_callable_release(pendingLease, key));
			}
			finally
			{
				try
				{ if(frame) module._bridge_scalar_frame_clear(frame); }
				finally
				{ for(const pointer of scope.allocations.reverse()) module._free(pointer); }
			}
		}
	};
	const dispatch = (token, key, frame) => {
		const current = frames.at(-1), callback = callbacks.get(token), allocations = [];
		try
		{
			requireOpen();
			if(!current || !callback || !frames.includes(callback.scope) || callback.signature.key !== key) throw new TypeError("Expired or wrong-signature host callback");
			if(callback.scope.failed || current.failed) return 8;
			if(module._bridge_scalar_frame_validate(frame, callback.signature.parameters.length) !== 0 || new DataView(module.HEAP8.buffer).getUint32(frame + 8, true) !== 0) throw new TypeError("Invalid callback frame");
			const args = callback.signature.parameters.map((type, index) => readComponentScalarSlot(module, frame + scalarFrameHeaderBytes + index * scalarSlotBytes, type.name, bytes => charge(current, bytes)));
			const result = Reflect.apply(callback.value, undefined, args);
			if(callback.scope.failed || current.failed) return 8;
			writeComponentScalarSlot(module, frame + 16, callback.signature.result.name, result, bytes => {
				charge(current, bytes); const pointer = allocate(bytes); allocations.push(pointer); return pointer;
			});
			if(allocations.length)
			{
				const data = new DataView(module.HEAP8.buffer);
				data.setUint32(frame + 20, data.getUint32(frame + 20, true) | 2, true);
				allocations.length = 0; // The C trampoline now owns the copied result.
			}
			return 0;
		}
		catch(error)
		{ record(current, error); record(callback?.scope, error); return 8; }
		finally
		{ for(const pointer of allocations) module._free(pointer); }
	};
	Object.defineProperty(module, "bridgeCallableDispatch", { value: dispatch });
	runtimes.add(module);
	return Object.freeze({
		assertOpen: requireOpen
		, poison: () => { poisoned = true; }
		, bind: (descriptor, operations) => {
			requireOpen();
			const abi = structuredClone(descriptor); assertComponentCallableAbi(abi);
			const types = new Map(abi.callbacks.map(signature => [signature.id, signature]));
			const exports = new Map(abi.exports.map(signature => {
				const operation = operations.get(signature.bindingId);
				if(typeof operation !== "function") throw new TypeError("Missing compiled callable operation");
				return [signature.bindingId, args => call(operation, signature, args, types)];
			}));
			return Object.freeze({ call: (id, args) => {
				const operation = exports.get(id);
				if(!operation) throw new TypeError(`Unknown Lean declaration ${id}`);
				return operation(args);
			} });
		}
	});
};
