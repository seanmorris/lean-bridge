/**
 * Synchronous typed calls through the owned wasm32 codec and lease registry.
 * Bindings come from an authenticated component in the existing shared heap.
 *
 * @file
 */
import { assertOwnedWasmSpan } from "./owned-wasm-scalars.mjs";
import { createOwnedWasmValueBudget, createOwnedWasmValueCodec, ownedWasmValueLimits } from "./owned-wasm-values.mjs";
import { createOwnedWasmRegistry } from "./owned-wasm-registry.mjs";
import { createOwnedWasmBorrowRegistry } from "./owned-wasm-borrow-registry.mjs";
import { createOwnedWasmCallbacks, withOwnedWasmRecovery } from "./owned-wasm-callbacks.mjs";

const budgetFailure = error => error instanceof RangeError
	&& (/^Owned wasm32 (?:depth limit|(?:bytes|visits|retained|copy) budget) exceeded$/u.test(error.message)
		|| error.message === "Owned wasm32 resource registry is full");

/**
 * The generated native binding owns opaque result slots and claims their exact
 * allocations and nominal identities. A trap retires the shared heap before
 * cleanup can enter it again. Recoverable conversion failures release all
 * temporary storage and unpublished leases while preserving the first error.
 *
 * @param module - Prepared Emscripten heap, allocator and deallocator.
 * @param suppliedLayout - Compiler-checked descriptor, snapshotted before binding.
 * @param bindings - Authenticated private native functions for one component.
 * @param options - Private deterministic allocation and publication test hooks.
 */
export const createOwnedWasmCalls = (module, suppliedLayout, bindings, options = {}) => {
	const layout = structuredClone(suppliedLayout), codec = createOwnedWasmValueCodec(layout);
	const types = new Map(layout.types.map(type => [type.id, type]));
	for(const alias of layout.native.aliases) types.set(alias.id, types.get(alias.target));
	const signatures = [...layout.native.functions, ...layout.native.callbacks];
	const anchored = layout.native.functions.some(signature => signature.anchor !== undefined);
	const exports = new Map(layout.native.functions.map((signature, index) => [signature.id, index]));
	for(const name of ["assertOpen", "openOwner", "validOwner", "releaseOwner", "claimAllocation", "claimIdentity", "dispatch", "retain", "close", "poison"])
		if(typeof bindings[name] !== "function") throw new TypeError(`Owned wasm32 calls require native ${name}`);
	if(anchored) for(const name of ["copy", "aliveOwner", "revokeOwner"])
		if(typeof bindings[name] !== "function") throw new TypeError(`Owned wasm32 borrowed results require native ${name}`);
	if(typeof module?._malloc !== "function" || typeof module?._free !== "function")
		throw new TypeError("Owned wasm32 calls require the shared allocator");
	const frames = []; let poisoned = false, registry, callbacks;
	const poison = () => {
		if(poisoned) return;
		poisoned = true; registry?.poison(); bindings.poison();
	};
	const native = operation => {
		if(poisoned) throw new Error("Owned wasm32 heap is poisoned");
		try
		{ bindings.assertOpen(); return operation(); }
		catch(error)
		{ poison(); throw error; }
	};
	const requireNative = (condition, message) => {
		if(!condition)
		{ poison(); throw new TypeError(`Malformed owned wasm32 ${message}`); }
	};
	const status = value => {
		if(value === 0) return;
		if(!Number.isInteger(value) || value < 1 || value > 10 || [4, 5, 6, 7, 9].includes(value)) poison();
		const messages = ["", "invalid argument", "ownership limit exceeded"
			, "native allocation failed"
			, "component closed", "wrong thread", "wrong process", "runtime unavailable"
			, "invalid call order", "malformed result"
			, "host callback failed or expired"];
		const error = new Error(`Owned Lean call failed: ${messages[value] ?? "invalid native status"} (${value})`);
		error.status = value; throw error;
	};
	const releaseOwner = owner => {
		const released = native(() => bindings.releaseOwner(owner));
		requireNative(released === 0, "owner release");
	};
	const checkpoint = () => {
		try
		{ options.registry?.checkpoint?.(); }
		catch(error)
		{
			const frame = frames.at(-1);
			if(frame)
			{ frame.hostFailed = true; frame.hostError = error; }
			throw error;
		}
	};
	const readNative = (operation, frame) => {
		try
		{ return operation(); }
		catch(error)
		{
			if(!(frame.hostFailed && Object.is(frame.hostError, error)) && !budgetFailure(error)) poison();
			throw error;
		}
	};
	const invoke = (index, args, identity = null, existingScope = null) => {
		registry.assertOpen();
		const signature = identity?.copy ? { parameters: [identity.type.id], result: identity.type.id }
			: identity?.retain ? { parameters: [], result: identity.type.id } : signatures[index];
		if(!signature || !Array.isArray(args) || args.length !== signature.parameters.length)
			throw new TypeError(`Expected ${signature?.parameters.length ?? "a declared number of"} arguments`);
		const scope = existingScope ?? registry.pin(), allocations = [], frame = {
			hostFailed: false, hostError: undefined, callbacks: []
			, callbackFailed: false, callbackError: undefined
			, budget: createOwnedWasmValueBudget()
		};
		frames.push(frame);
		let owner = 0, output = null, failed = false, failure, value, transfers = null, transferPointer = 0, transferIndex = -1;
		let anchor = null;
		const allocate = (bytes, arena = allocations) => {
			registry.assertOpen();
			if(!Number.isSafeInteger(bytes) || bytes < 0 || bytes > ownedWasmValueLimits.bytes)
				throw new RangeError("Owned wasm32 bytes budget exceeded");
			const pointer = native(() => module._malloc(Math.max(1, bytes)));
			if(pointer === 0) throw new Error("Owned wasm32 allocation failed");
			try
			{ assertOwnedWasmSpan(module, pointer, Math.max(1, bytes), 8); }
			catch(error)
			{ poison(); throw error; }
			arena.push(pointer); return pointer;
		};
		frame.allocate = allocate;
		const controls = { allocate
			, toToken: (type, value) => transferIndex >= 0 ? transfers.toToken(transferIndex, type, value)
				: callbacks ? callbacks.toToken(type, value, frame, scope) : scope.toToken(type, value)
			, claim: (pointer, bytes) => requireNative(native(() => bindings.claimAllocation(owner, pointer, bytes)) === 1, "allocation claim")
			, fromToken: (type, token) => output.project(type, token)
		};
		try
		{
			const budget = frame.budget, pointerBytes = args.length * 4;
			if(signature.transfers?.length)
			{
				budget.charge(16); transferPointer = allocate(16);
				module.HEAP8.fill(0, transferPointer, transferPointer + 16);
				transfers = scope.transfers(signature.transfers.length, () => poisoned || new DataView(module.HEAP8.buffer).getUint32(transferPointer + 12, true) === 1);
			}
			budget.charge(pointerBytes); const argumentsPointer = allocate(pointerBytes);
			for(const [i, id] of signature.parameters.entries())
			{
				const pointer = allocate(types.get(id).size);
				transferIndex = signature.transfers?.indexOf(i) ?? -1;
				let input = args[i];
				if(anchored)
				{
					if(signature.anchor === i)
					{ anchor = scope.whole(id, input); input = anchor.payload; }
					else if(transferIndex >= 0) input = transfers.whole(transferIndex, id, input);
					else input = scope.unwrap(id, input);
				}
				if(i === 0 && identity && !identity.copy)
					new DataView(module.HEAP8.buffer).setBigUint64(pointer, identity.token, true);
				else codec.write(module, id, pointer, input, controls, budget);
				new DataView(module.HEAP8.buffer).setUint32(argumentsPointer + i * 4, pointer, true);
			}
			transferIndex = -1;
			if(transfers)
			{
				const rows = transfers.owners();
				budget.charge(rows.length * 8); const groups = allocate(rows.length * 8);
				for(const [index, owners] of rows.entries())
				{
					budget.charge(owners.length * 4); const pointer = allocate(owners.length * 4);
					const view = new DataView(module.HEAP8.buffer);
					owners.forEach((owner, i) => view.setUint32(pointer + i * 4, owner, true));
					view.setUint32(groups + index * 8, pointer, true);
					view.setUint32(groups + index * 8 + 4, owners.length, true);
				}
				const view = new DataView(module.HEAP8.buffer);
				view.setUint32(transferPointer, 1, true); view.setUint32(transferPointer + 4, rows.length, true);
				view.setUint32(transferPointer + 8, groups, true);
			}
			const result = allocate(types.get(signature.result).size);
			module.HEAP8.fill(0, result, result + types.get(signature.result).size);
			registry.assertOpen(); owner = native(() => bindings.openOwner());
			if(owner === 0) throw new Error("Owned wasm32 result allocation failed");
			requireNative(Number.isInteger(owner) && owner > 0 && owner <= 0xffffffff, "result owner");
			const nativeStatus = native(() => identity?.copy
				? bindings.copy(identity.type.index, new DataView(module.HEAP8.buffer).getUint32(argumentsPointer, true), result, owner)
				: identity?.retain ? bindings.retain(identity.type.index, identity.token, result, owner)
					: bindings.dispatch(index, argumentsPointer, result, owner, transferPointer, anchor?.owner ?? 0));
			if(transfers)
			{
				const consumed = new DataView(module.HEAP8.buffer).getUint32(transferPointer + 12, true);
				requireNative([0, 1].includes(consumed) && (nativeStatus !== 0 || consumed === 1), "input-transfer handoff");
			}
			if(frame.callbackFailed) throw frame.callbackError;
			status(nativeStatus);
			try
			{ output = registry.output(owner, { independent: Boolean(identity?.retain)
				, ...anchored ? { type: signature.result, anchor: anchor?.group ?? null } : {} }); }
			catch(error)
			{
				// Adoption consumes a valid owner even if host allocation fails.
				if(!poisoned && native(() => bindings.validOwner(owner)) === 0) owner = 0;
				throw error;
			}
			value = readNative(() => codec.read(module, signature.result, result, controls, frame.budget), frame);
			options.afterProjection?.(value);
			if(anchored) value = output.commit(value);
			else output.commit();
		}
		catch(error)
		{ failed = true; failure = frame.callbackFailed ? frame.callbackError : error; }
		const cleanup = operation => {
			try
			{ operation(); }
			catch(error)
			{
				if(!failed)
				{ failed = true; failure = error; }
			}
		};
		if(output) cleanup(output.rollback);
		else if(owner && !poisoned) cleanup(() => releaseOwner(owner));
		if(transfers) cleanup(transfers.finish);
		if(callbacks) cleanup(() => callbacks.cleanup(frame));
		for(const pointer of allocations.reverse()) if(!poisoned) cleanup(() => native(() => module._free(pointer)));
		if(!existingScope) cleanup(scope.close);
		frames.pop();
		if(!failed && frame.callbackFailed)
		{ failed = true; failure = frame.callbackError; }
		if(failed) throw failure;
		return value;
	};
	registry = (anchored ? createOwnedWasmBorrowRegistry : createOwnedWasmRegistry)(layout, {
		assertOpen: () => { if(poisoned) throw new Error("Owned wasm32 heap is poisoned"); bindings.assertOpen(); }
		, assertOwner: owner => requireNative(native(() => bindings.validOwner(owner)) === 1, "result owner claim")
		, claimIdentity: (owner, type, token) => requireNative(native(() => bindings.claimIdentity(owner, type.index, token)) === 1, "identity claim")
		, releaseOwner
		, ...anchored ? {
			revokeOwner: owner => requireNative(native(() => bindings.revokeOwner(owner)) === 0, "owner revocation")
			, copy: (type, value, scope) => invoke(-1, [value], { type, copy: true }, scope)
		} : {}
		, invoke: (type, token, args, scope) => invoke(signatures.findIndex(signature => signature.id === type.id), [null, ...args], { type, token }, scope)
		, retain: (type, token, scope) => invoke(-1, [], { type, token, retain: true }, scope)
		, close: () => { callbacks?.close(); requireNative(native(() => bindings.close()) === 0, "component close"); }
		, poison
	}, { ...options.registry, checkpoint });
	if(bindings.callbacks) callbacks = createOwnedWasmCallbacks(module, layout, bindings.callbacks, {
		frames, registry, codec, bindings, native, requireNative, status
		, releaseOwner, readNative
		, isPoisoned: () => poisoned
	});
	return Object.freeze({
		call: (id, args) => {
			if(!exports.has(id)) throw new TypeError(`Unknown owned Lean declaration ${id}`);
			return invoke(exports.get(id), args);
		}
		, close: registry.close
		, withRecovery: withOwnedWasmRecovery
		, ...anchored ? { copyValue: (id, value) => {
			const type = types.get(id);
			if(!type || type.representation === "copied") throw new TypeError("Expected a declared owned value type");
			return invoke(-1, [value], { type, copy: true });
		} } : {}
	});
};
