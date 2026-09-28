/**
 * Borrowed synchronous host callbacks for the owned wasm32 call transport.
 * The native trampoline consumes replies before it releases their temporary pins.
 *
 * @file
 */
import { assertOwnedWasmSpan } from "./owned-wasm-scalars.mjs";

const recoveries = new WeakMap();

/**
 * Supply a typed recovery value when a callback cannot construct one from its
 * arguments. Lean uses it only to finish cleanup after the original JS error.
 *
 * @param operation - Synchronous JavaScript callback.
 * @param recovery - Value of the callback's declared result type.
 */
export const withOwnedWasmRecovery = (operation, recovery) => {
	if(typeof operation !== "function") throw new TypeError("Expected a synchronous callback");
	const callback = (...args) => Reflect.apply(operation, undefined, args);
	recoveries.set(callback, recovery); return Object.freeze(callback);
};

/**
 * Install one component's checked callback dispatcher. All native operations
 * share the enclosing call runtime's trap, cleanup and retirement policy.
 *
 * @param module - Existing Emscripten heap.
 * @param layout - Authenticated owned wasm32 layout.
 * @param bindings - Generated native callback entry points and handler installer.
 * @param controls - Call frames, registry, codec, allocator and shared error guards.
 */
export const createOwnedWasmCallbacks = (module, layout, bindings, controls) => {
	for(const name of ["begin", "end", "valid", "install"])
		if(typeof bindings[name] !== "function") throw new TypeError(`Owned wasm32 callbacks require ${name}`);
	const { frames, registry, codec, native, requireNative, status, isPoisoned, releaseOwner, readNative } = controls;
	const types = new Map(layout.types.map(type => [type.id, type]));
	for(const alias of layout.native.aliases) types.set(alias.id, types.get(alias.target));
	const callbacks = new Map(), pending = new Map(); let next = 0, building = 0;
	const record = (frame, error) => {
		if(frame && !frame.callbackFailed)
		{ frame.callbackFailed = true; frame.callbackError = error; }
	};
	const finished = state => {
		let failed = false, failure;
		const cleanup = operation => {
			try
			{ operation(); }
			catch(error)
			{
				if(!failed)
				{ failed = true; failure = error; }
			}
		};
		cleanup(() => state.borrow?.rollback());
		cleanup(() => state.scope?.close());
		for(const pointer of state.allocations.reverse()) if(!isPoisoned()) cleanup(() => native(() => module._free(pointer)));
		if(failed) throw failure;
	};
	const register = (type, value, frame, scope) => {
		registry.assertOpen();
		if(typeof value !== "function") throw new TypeError("Expected a synchronous callback");
		if(callbacks.size === 4096 || next === 0xffffffff || building === 64)
			throw new RangeError("Owned wasm32 host callback limit exceeded");
		const entry = { id: ++next, type, value, frame, owner: 0, begun: false };
		callbacks.set(entry.id, entry); frame.callbacks.push(entry.id); building++;
		try
		{
			let recovery = 0;
			if(recoveries.has(value))
			{
				const result = types.get(type.callable.result.type); recovery = frame.allocate(result.size);
				codec.write(module, result.id, recovery, recoveries.get(value), {
					allocate: frame.allocate
					, toToken: (type, value) => toToken(type, value, frame, scope)
				}, frame.budget);
			}
			const output = frame.allocate(type.size);
			entry.owner = native(() => controls.bindings.openOwner());
			if(!entry.owner) throw new Error("Owned wasm32 callback allocation failed");
			requireNative(Number.isInteger(entry.owner) && entry.owner > 0 && entry.owner <= 0xffffffff, "callback owner");
			status(native(() => bindings.begin(type.index, entry.id, recovery, output, entry.owner)));
			entry.begun = true;
			const token = new DataView(module.HEAP8.buffer).getBigUint64(output, true);
			requireNative(token > 0n && native(() => controls.bindings.claimIdentity(entry.owner, type.index, token)) === 1, "callback identity");
			return token;
		}
		finally
		{ building--; }
	};
	const toToken = (type, value, frame, scope) => {
		if(type.kind !== "callback" || registry.isHandle(value)) return scope.toToken(type, value);
		return register(type, value, frame, scope);
	};
	const dispatch = (key, id, typeIndex, owner, argumentsPointer, reply) => {
		const frame = frames.at(-1), callback = callbacks.get(id);
		let state;
		try
		{
			registry.assertOpen();
			requireNative(frame && callback && frames.includes(callback.frame) && callback.type.index === typeIndex, "host callback context");
			requireNative(Number.isInteger(key) && key > 0 && key <= 0xffffffff && !pending.has(key), "callback frame key");
			requireNative(native(() => bindings.valid(key, id, typeIndex, owner, argumentsPointer, reply)) === 1, "callback frame");
			if(frame.callbackFailed || callback.frame.callbackFailed) return 10;
			state = { key, frame, callback, allocations: [], scope: null, borrow: null };
			pending.set(key, state); state.scope = registry.borrowPin(); state.borrow = registry.borrow(owner);
			const args = readNative(() => {
				const parameters = callback.type.callable.parameters;
				assertOwnedWasmSpan(module, argumentsPointer, parameters.length * 4, 4);
				assertOwnedWasmSpan(module, reply, types.get(callback.type.callable.result.type).size, types.get(callback.type.callable.result.type).alignment);
				return parameters.map(parameter => parameter.type).map((id, index) => codec.read(module, id,
					new DataView(module.HEAP8.buffer).getUint32(argumentsPointer + index * 4, true), {
						claim: (pointer, bytes) => requireNative(native(() => controls.bindings.claimAllocation(owner, pointer, bytes)) === 1, "callback allocation")
						, fromToken: state.borrow.project
					}, frame.budget));
			}, frame);
			const result = Reflect.apply(callback.value, undefined, args);
			registry.assertOpen();
			if(frame.callbackFailed || callback.frame.callbackFailed) return 10;
			codec.write(module, callback.type.callable.result.type, reply, result, {
				allocate: bytes => frame.allocate(bytes, state.allocations)
				, toToken: (type, value) => toToken(type, value, frame, state.scope)
			}, frame.budget);
			return 0;
		}
		catch(error)
		{
			record(frame, error); record(callback?.frame, error);
			if(isPoisoned()) throw error;
			return 10;
		}
		finally
		{
			// The C argument owner stays alive until the typed reply is consumed.
			// Only the JavaScript borrowed views expire when the callback returns.
			state?.borrow?.rollback();
		}
	};
	const finish = key => {
		const state = pending.get(key);
		if(!state) return 0;
		pending.delete(key);
		try
		{ finished(state); return 0; }
		catch(error)
		{
			record(state.frame, error); record(state.callback.frame, error);
			if(isPoisoned()) throw error;
			return 10;
		}
	};
	const uninstall = bindings.install(Object.freeze({ dispatch, finish }));
	if(typeof uninstall !== "function") throw new TypeError("Callback installer must return its detach operation");
	return Object.freeze({
		toToken
		, cleanup: frame => {
			for(const [key, state] of pending) if(state.frame === frame) finish(key);
			for(const id of frame.callbacks.reverse())
			{
				const entry = callbacks.get(id); callbacks.delete(id);
				if(isPoisoned()) continue;
				try
				{
					if(entry.begun) requireNative(native(() => bindings.end(id)) === 0, "host callback release");
					if(entry.owner) releaseOwner(entry.owner);
				}
				catch(error)
				{ record(frame, error); }
			}
		}
		, close: () => { if(callbacks.size || pending.size) throw new Error("Closing active host callbacks"); uninstall(); }
	});
};
