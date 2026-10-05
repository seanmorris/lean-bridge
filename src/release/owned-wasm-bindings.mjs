/**
 * Bind generated owned wasm32 control frames to the shared loader's trampoline.
 * The loader supplies the authenticated operation and its shared retirement state.
 *
 * @file
 */
import { ownedWasmControlBytes, ownedWasmControlOperations, ownedWasmControlVersion, ownedWasmBorrowOperations } from "../abi/owned-wasm-control.mjs";
import { assertOwnedWasmSpan } from "./owned-wasm-scalars.mjs";
const op = { ...ownedWasmControlOperations, ...ownedWasmBorrowOperations };

/**
 * Resolve no raw symbols or input-controlled code. One verified component entry
 * point executes every operation; borrowed callback dispatch stays synchronous.
 *
 * @param module - The already created Emscripten heap and allocator.
 * @param operation - Authenticated generated control entry point, taking a frame.
 * @param lifecycle - Shared assertOpen and poison hooks, with optional close hook.
 * @param callbackKey - Generated component-specific callback dispatch key, if any.
 */
export const createOwnedWasmBindings = (module, operation, lifecycle, callbackKey = null) => {
	if(typeof operation !== "function" || typeof lifecycle?.assertOpen !== "function" || typeof lifecycle?.poison !== "function"
		|| typeof module?._malloc !== "function" || typeof module?._free !== "function")
		throw new TypeError("Owned wasm32 binding requires a shared heap and lifecycle");
	if(callbackKey !== null && !/^leanBridgeOwnedCallbacks_[a-f0-9]{64}$/u.test(callbackKey))
		throw new TypeError("Invalid owned wasm32 callback key");
	let poisoned = false;
	const assertOpen = () => {
		if(poisoned) throw new Error("Owned wasm32 binding is poisoned");
		lifecycle.assertOpen();
	};
	const poison = () => {
		if(poisoned) return;
		poisoned = true; lifecycle.poison();
	};
	const invoke = (code, arguments_ = [], token = 0n) => {
		assertOpen();
		if(arguments_.length > 8 || arguments_.some(value => !Number.isInteger(value) || value < 0 || value > 0xffffffff)
			|| typeof token !== "bigint" || token < 0n || token > 0xffffffffffffffffn)
			throw new TypeError("Invalid owned wasm32 control arguments");
		let pointer = 0, failed = false, failure, result;
		try
		{
			pointer = module._malloc(ownedWasmControlBytes);
			if(!pointer) return { status: 3, value: 0 };
			assertOwnedWasmSpan(module, pointer, ownedWasmControlBytes, 8);
			module.HEAP8.fill(0, pointer, pointer + ownedWasmControlBytes);
			let view = new DataView(module.HEAP8.buffer);
			view.setUint32(pointer, ownedWasmControlVersion, true);
			view.setUint32(pointer + 4, ownedWasmControlBytes, true);
			view.setUint32(pointer + 12, code, true);
			arguments_.forEach((value, i) => view.setUint32(pointer + 16 + i * 4, value, true));
			view.setBigUint64(pointer + 48, token, true);
			const status = operation(pointer);
			assertOpen(); view = new DataView(module.HEAP8.buffer);
			if(!Number.isInteger(status) || status < 0 || status > 10
				|| view.getUint32(pointer, true) !== ownedWasmControlVersion
				|| view.getUint32(pointer + 4, true) !== ownedWasmControlBytes
				|| view.getUint32(pointer + 8, true) !== status
				|| view.getUint32(pointer + 12, true) !== code
				|| Array.from({ length: 8 }, (_, i) => view.getUint32(pointer + 16 + i * 4, true))
					.some((value, i) => value !== (arguments_[i] ?? 0))
				|| view.getBigUint64(pointer + 48, true) !== token
				|| view.getUint32(pointer + 60, true) !== 0)
				throw new TypeError("Malformed owned wasm32 control reply");
			result = { status, value: view.getUint32(pointer + 56, true) };
		}
		catch(error)
		{
			failed = true; failure = error;
			try
			{ poison(); }
			catch { /* Preserve the dispatch failure. */ }
		}
		finally
		{
			if(pointer && !poisoned)
			{
				try
				{ assertOpen(); module._free(pointer); }
				catch(error)
				{
					if(!failed)
					{ failed = true; failure = error; }
					try
					{ poison(); }
					catch { /* Preserve the first failure. */ }
				}
			}
		}
		if(failed) throw failure;
		return result;
	};
	const value = (code, arguments_, token) => {
		const result = invoke(code, arguments_, token);
		if(result.status) throw new Error(`Owned wasm32 control failed (${result.status})`);
		return result.value;
	};
	const bindings = {
		assertOpen, poison
		, openOwner: () => { const result = invoke(op.open); return result.status ? 0 : result.value; }
		, validOwner: owner => value(op.valid, [owner])
		, releaseOwner: owner => invoke(op.release, [owner]).status
		, claimAllocation: (owner, pointer, bytes) => value(op.claim, [owner, pointer, bytes])
		, claimIdentity: (owner, type, token) => value(op.identity, [owner, type], token)
		, dispatch: (index, args, out, owner, transfers = 0, anchor = 0) => invoke(op.dispatch, [index, args, out, owner, ...anchor ? [transfers, anchor] : transfers ? [transfers] : []]).status
		, retain: (type, token, out, owner) => invoke(op.retain, [type, out, owner], token).status
		, copy: (type, input, out, owner) => invoke(op.copy, [type, input, out, owner]).status
		, aliveOwner: owner => value(op.alive, [owner])
		, revokeOwner: owner => invoke(op.revoke, [owner]).status
		, close: () => {
			const status = invoke(op.close).status;
			if(!status) lifecycle.close?.();
			return status;
		}
	};
	if(callbackKey) bindings.callbacks = Object.freeze({
		begin: (type, id, fallback, out, owner) => invoke(op.callbackBegin, [type, id, fallback, out, owner]).status
		, end: id => invoke(op.callbackEnd, [id]).status
		, valid: (key, host, type, owner, args, reply) => value(op.callbackValid, [key, host, type, owner, args, reply])
		, install: handlers => {
			assertOpen();
			if(Object.hasOwn(module, callbackKey)) throw new Error("Owned wasm32 callback handler already installed");
			if(typeof handlers?.dispatch !== "function" || typeof handlers?.finish !== "function")
				throw new TypeError("Owned wasm32 callback handlers are incomplete");
			Object.defineProperty(module, callbackKey, { value: handlers, configurable: true });
			let detached = false;
			return () => {
				if(detached) return;
				if(module[callbackKey] !== handlers) throw new Error("Owned wasm32 callback handler changed");
				delete module[callbackKey]; detached = true;
			};
		}
	});
	return Object.freeze({ bindings: Object.freeze(bindings)
		, initialize: () => invoke(op.init).status
		, metadataHash: () => Array.from({ length: 8 }, (_, index) => value(op.metadata, [index]).toString(16).padStart(8, "0")).join("")
		, allocations: () => value(op.live), owners: () => value(op.results)
		, callbacks: () => callbackKey ? value(op.callbackLive) : 0 });
};
