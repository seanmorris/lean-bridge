/**
 * Private runtime loader and scalar-frame transport, also exercised directly in tests.
 *
 * @file
 */
import {
	assertComponentSignature, componentScalarAbi,
	scalarCopyLimit, scalarFrameHeaderBytes, scalarSlotBytes,
} from "../abi/component-scalars.mjs";
import { readComponentScalarSlot, writeComponentScalarSlot } from "./component-scalar-codec.mjs";
import { assertComponentCallableBindings, componentCallableSignatureText } from "../abi/component-callables.mjs";
import { createComponentCallableRuntime } from "./component-callable-runtime.mjs";
import { assertComponentCopiedBindings, componentCopiedAbi } from "../abi/component-copied.mjs";
import { compileComponentCopiedCall } from "./component-copied-runtime.mjs";
import { componentRecordAbi, componentCompoundAbi, assertComponentRecordBindings } from "../abi/component-records.mjs";

const encoder = new TextEncoder();
const digest = async bytes => [...new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes))]
	.map(byte => byte.toString(16).padStart(2, "0")).join("");

const readArtifact = async url => {
	if(url.protocol === "file:")
	{
		const { readFile } = await import("node:fs/promises");
		return new Uint8Array(await readFile(url));
	}
	const response = await fetch(url);
	if(!response.ok) throw new Error(`Unable to read Lean component: HTTP ${response.status}`);
	return new Uint8Array(await response.arrayBuffer());
};

/**
 * Allocates one call arena; the generated C adapter consumes owned Lean arguments.
 *
 * @param module - Initialized Emscripten module owning the shared memory and allocation helpers.
 * @param operation - Compiled scalar adapter invoked once with the allocated frame pointer.
 * @param signature - Pure primitive parameter and result types for this call.
 * @param args - Host arguments in declaration order.
 */
export const callComponentScalar = (module, operation, signature, args) => {
	assertComponentSignature(signature);
	if(args.length !== signature.parameters.length) throw new TypeError(`Expected ${signature.parameters.length} arguments`);
	const allocations = [];
	const allocate = size => {
		if(!Number.isSafeInteger(size) || size < 0 || size > scalarCopyLimit) throw new RangeError("Component copy budget exceeded");
		const pointer = module._malloc(Math.max(1, size));
		if(!pointer) throw new Error("Component allocation failed");
		allocations.push(pointer);
		return pointer;
	};
	const view = () => new DataView(module.HEAP8.buffer);
	let frame = 0;
	try
	{
		const size = scalarFrameHeaderBytes + scalarSlotBytes * args.length;
		frame = allocate(size);
		module.HEAP8.fill(0, frame, frame + size);
		view().setUint32(frame, componentScalarAbi, true);
		view().setUint32(frame + 4, size, true);
		view().setUint32(frame + 12, args.length, true);
		for(const [index, parameter] of signature.parameters.entries())
		{
			const slot = frame + scalarFrameHeaderBytes + index * scalarSlotBytes;
			writeComponentScalarSlot(module, slot, parameter.name, args[index], allocate);
		}
		const status = operation(frame);
		if(status !== 0 || view().getUint32(frame + 8, true) !== 0) throw new Error(`Component scalar call failed (${status})`);
		return readComponentScalarSlot(module, frame + 16, signature.result.name);
	} finally
	{
		if(frame) module._bridge_scalar_frame_clear(frame);
		for(const pointer of allocations.reverse()) module._free(pointer);
	}
};

/**
 * Creates one shared Lean heap and a deduplicating component loader.
 *
 * @param createMain - Factory for the prepared shared Emscripten runtime.
 * @param mainWasm - URL of the prepared main Wasm artifact.
 */
export const createComponentRuntime = async (createMain, mainWasm) => {
	const module = await createMain({ locateFile: path => path === "main.wasm" ? mainWasm.href : path });
	if(!module._bridge_lean_runtime_init()) throw new Error("The shared Lean runtime failed to initialize");
	if(!module.FS || !module._bridge_scalar_frame_clear) throw new Error("Shared runtime does not implement scalar ABI 2");
	const loaded = new Map();
	const callables = module._bridge_callable_abi ? createComponentCallableRuntime(module) : null;
	let poisoned = false;
	const poison = () => { poisoned = true; callables?.poison(); };
	const assertOpen = () => { if(poisoned) throw new Error("Component runtime is poisoned"); callables?.assertOpen(); };
	let linkQueue = Promise.resolve();
	const loadComponent = descriptor => {
		assertOpen();
		descriptor = { ...descriptor, sideModule: new URL(descriptor.sideModule.href), privateAbi: structuredClone(descriptor.privateAbi), bindingIr: structuredClone(descriptor.bindingIr) };
		const fingerprint = JSON.stringify([descriptor.buildHash, descriptor.integrity, descriptor.initializer, descriptor.privateAbi, descriptor.bindingIr]);
		const existing = loaded.get(descriptor.id);
		if(existing) return existing.fingerprint === fingerprint ? existing.promise : Promise.reject(new Error(`Lean component identity conflict for ${descriptor.id}`));
		const record = { fingerprint, promise: null, linking: false };
		loaded.set(descriptor.id, record);
		record.promise = (async () => {
			const callable = descriptor.privateAbi.version === 3, copied = [componentCopiedAbi, componentRecordAbi, componentCompoundAbi].includes(descriptor.privateAbi.version);
			if(callable)
			{
				if(!callables) throw new Error("Shared runtime lacks the component callable ABI; rebuild it");
				assertComponentCallableBindings(descriptor.privateAbi, descriptor.bindingIr);
				for(const signature of descriptor.privateAbi.callbacks)
					if((await digest(encoder.encode(componentCallableSignatureText(signature)))).slice(0, 40) !== signature.key) throw new Error("Component callback signature key mismatch");
			}
			else if(copied)
			{
				if(!module._bridge_copied_frame_clear || !module._bridge_copied_abi || module._bridge_copied_abi() !== 1) throw new Error("Shared runtime lacks the component copied ABI; rebuild it");
				if([componentRecordAbi, componentCompoundAbi].includes(descriptor.privateAbi.version))
				{
					if(!module._bridge_record_abi || module._bridge_record_abi() !== 1) throw new Error("Shared runtime lacks the component record ABI; rebuild it");
					if(descriptor.privateAbi.version === componentCompoundAbi && (!module._bridge_compound_abi || module._bridge_compound_abi() !== 1)) throw new Error("Shared runtime lacks the component compound ABI; rebuild it");
					assertComponentRecordBindings(descriptor.privateAbi, descriptor.bindingIr);
				}
				else assertComponentCopiedBindings(descriptor.privateAbi, descriptor.bindingIr);
			}
			else
			{
				if(descriptor.privateAbi.version !== componentScalarAbi || descriptor.privateAbi.dispatch !== "scalar-frame-v2") throw new Error("Unsupported component private ABI");
				for(const abi of descriptor.privateAbi.exports) assertComponentSignature(abi);
			}
			const symbols = new Set();
			const bindings = new Set();
			if(descriptor.bindingIr.declarations.length !== descriptor.privateAbi.exports.length) throw new Error("Component binding count mismatch");
			for(const declaration of descriptor.bindingIr.declarations)
			{
				if(!callable && !copied) assertComponentSignature(declaration);
				const abi = descriptor.privateAbi.exports.find(item => item.bindingId === declaration.id);
				if(!abi || bindings.has(declaration.id) || symbols.has(abi.symbol) || !/^lean_bridge_[0-9a-f]{24}$/.test(abi.symbol)
					|| JSON.stringify(abi.parameters) !== JSON.stringify(declaration.parameters.map(item => item.type))
					|| JSON.stringify(abi.result) !== JSON.stringify(declaration.result.type)) throw new Error("Component binding signature mismatch");
				bindings.add(declaration.id);
				symbols.add(abi.symbol);
			}
			const bytes = await readArtifact(descriptor.sideModule);
			if(await digest(bytes) !== descriptor.integrity) throw new Error(`Lean component integrity mismatch for ${descriptor.id}`);
			const link = async () => {
				assertOpen();
				record.linking = true;
				const filename = `/lean-component-${descriptor.integrity}.wasm`;
				module.FS.writeFile(filename, bytes);
				try
{ await module.loadDynamicLibrary(filename, { global: true, loadAsync: true, nodelete: true }); }
				finally
{ module.FS.unlink(filename); }
				const symbolBytes = encoder.encode(`${descriptor.initializer}\0`);
				const pointer = module._malloc(symbolBytes.length);
				if(!pointer) throw new Error("Component initializer allocation failed");
				try
				{
					module.HEAP8.set(symbolBytes, pointer);
					if(!module._bridge_lean_component_initialize(pointer) || module._bridge_lean_component_last_error()) throw new Error(`Lean component initialization failed for ${descriptor.id}`);
				} finally
{ module._free(pointer); }
				const operations = new Map(descriptor.privateAbi.exports.map(abi => {
					if(!descriptor.bindingIr.declarations.some(item => item.id === abi.bindingId)) throw new Error("Component binding identity mismatch");
					const symbol = encoder.encode(`${abi.symbol}\0`);
					return [abi.bindingId, frame => {
						assertOpen();
						const name = module._malloc(symbol.length);
						if(!name) throw new Error("Component call allocation failed");
						try
{ module.HEAP8.set(symbol, name); return module._bridge_scalar_call(name, frame); }
						catch(error)
{ poisoned = true; callables?.poison(); throw error; }
						finally
{ module._free(name); }
					}];
				}));
				if(callable) return callables.bind(descriptor.privateAbi, operations);
				const calls = new Map(descriptor.privateAbi.exports.map(abi => {
					const copiedCall = copied ? compileComponentCopiedCall(module, operations.get(abi.bindingId), abi, poison, descriptor.privateAbi.version, descriptor.privateAbi.records) : null;
					const call = args => { assertOpen(); return copiedCall ? copiedCall(args) : callComponentScalar(module, operations.get(abi.bindingId), abi, args); };
					return [abi.bindingId, call];
				}));
				return Object.freeze({ call: (id, args) => {
					const call = calls.get(id);
					if(!call) throw new TypeError(`Unknown Lean declaration ${id}`);
					return call(args);
				} });
			};
			const promise = linkQueue.then(link);
			linkQueue = promise.catch(() => {});
			return promise;
		})().catch(error => {
			if(!record.linking && loaded.get(descriptor.id) === record) loaded.delete(descriptor.id);
			throw error;
		});
		return record.promise;
	};
	return Object.freeze({ loadComponent });
};
