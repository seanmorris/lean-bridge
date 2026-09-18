/**
 * Private runtime loader and scalar-frame transport, also exercised directly in tests.
 *
 * @file
 */
import {
	assertComponentSignature, componentScalarAbi, componentScalarTypes,
	scalarCopyLimit, scalarFrameHeaderBytes, scalarSlotBytes, validateComponentScalar,
} from "../abi/component-scalars.mjs";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
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

const integerBytes = value => {
	let magnitude = value < 0n ? -value : value;
	const count = magnitude === 0n ? 0 : Math.ceil(magnitude.toString(16).length / 8);
	if(count * 4 > scalarCopyLimit) throw new RangeError("Integer exceeds the component copy budget");
	const bytes = new Uint8Array(count * 4);
	const view = new DataView(bytes.buffer);
	for(let index = 0; index < count; index += 1)
	{
		view.setUint32(index * 4, Number(magnitude & 0xffffffffn), true);
		magnitude >>= 32n;
	}
	return bytes;
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
			const type = parameter.name;
			const value = validateComponentScalar(type, args[index]);
			const slot = frame + scalarFrameHeaderBytes + index * scalarSlotBytes;
			view().setUint32(slot, componentScalarTypes.indexOf(type), true);
			if(type === "string" || type === "bytes" || type === "nat" || type === "int")
			{
				const bytes = type === "string" ? encoder.encode(value) : type === "bytes" ? value : integerBytes(value);
				const pointer = allocate(bytes.length);
				module.HEAP8.set(bytes, pointer);
				view().setUint32(slot + 4, typeof value === "bigint" && value < 0n ? 1 : 0, true);
				view().setUint32(slot + 8, pointer, true);
				view().setUint32(slot + 12, type === "nat" || type === "int" ? bytes.length / 4 : bytes.length, true);
			}
			else if(type === "float32") view().setFloat32(slot + 8, value, true);
			else if(type === "float64") view().setFloat64(slot + 8, value, true);
			else if(type === "char") view().setBigUint64(slot + 8, BigInt(value.codePointAt(0)), true);
			else view().setBigUint64(slot + 8, BigInt.asUintN(64, type === "unit" ? 0n : BigInt(value)), true);
		}
		const status = operation(frame);
		if(status !== 0 || view().getUint32(frame + 8, true) !== 0) throw new Error(`Component scalar call failed (${status})`);
		const slot = frame + 16;
		const type = signature.result.name;
		if(view().getUint32(slot, true) !== componentScalarTypes.indexOf(type)) throw new Error("Component result type mismatch");
		let value;
		if(type === "unit") value = undefined;
		else if(type === "bool")
		{
			const bits = view().getBigUint64(slot + 8, true);
			if(bits > 1n) throw new Error("Invalid component boolean representation");
			value = bits === 1n;
		}
		else if(type === "float32") value = view().getFloat32(slot + 8, true);
		else if(type === "float64") value = view().getFloat64(slot + 8, true);
		else if(type === "char")
		{
			const point = view().getBigUint64(slot + 8, true);
			if(view().getUint32(slot + 4, true) !== 0 || point > 0x10ffffn || (point >= 0xd800n && point <= 0xdfffn)) throw new TypeError("Invalid component Unicode scalar representation");
			value = String.fromCodePoint(Number(point));
		}
		else if(type === "string" || type === "bytes" || type === "nat" || type === "int")
		{
			const pointer = view().getUint32(slot + 8, true);
			const length = view().getUint32(slot + 12, true);
			const byteLength = length * (type === "nat" || type === "int" ? 4 : 1);
			if(byteLength > scalarCopyLimit || pointer + byteLength > module.HEAP8.length) throw new RangeError("Invalid component result buffer");
			const bytes = new Uint8Array(module.HEAP8.buffer, pointer, byteLength);
			if(type === "string") value = decoder.decode(bytes);
			else if(type === "bytes") value = bytes.slice();
			else
			{
				value = 0n;
				for(let index = length - 1; index >= 0; index -= 1) value = (value << 32n) | BigInt(view().getUint32(pointer + index * 4, true));
				if(view().getUint32(slot + 4, true) & 1) value = -value;
			}
		}
		else
		{
			value = type.startsWith("int") ? view().getBigInt64(slot + 8, true) : view().getBigUint64(slot + 8, true);
			if(!type.endsWith("64")) value = Number(value);
		}
		return validateComponentScalar(type, value);
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
	let linkQueue = Promise.resolve();
	const loadComponent = descriptor => {
		descriptor = { ...descriptor, sideModule: new URL(descriptor.sideModule.href), privateAbi: structuredClone(descriptor.privateAbi), bindingIr: structuredClone(descriptor.bindingIr) };
		const fingerprint = JSON.stringify([descriptor.buildHash, descriptor.integrity, descriptor.initializer, descriptor.privateAbi, descriptor.bindingIr]);
		const existing = loaded.get(descriptor.id);
		if(existing) return existing.fingerprint === fingerprint ? existing.promise : Promise.reject(new Error(`Lean component identity conflict for ${descriptor.id}`));
		const record = { fingerprint, promise: null, linking: false };
		loaded.set(descriptor.id, record);
		record.promise = (async () => {
			if(descriptor.privateAbi.version !== componentScalarAbi || descriptor.privateAbi.dispatch !== "scalar-frame-v2") throw new Error("Unsupported component private ABI");
			for(const abi of descriptor.privateAbi.exports) assertComponentSignature(abi);
			const symbols = new Set();
			const bindings = new Set();
			if(descriptor.bindingIr.declarations.length !== descriptor.privateAbi.exports.length) throw new Error("Component binding count mismatch");
			for(const declaration of descriptor.bindingIr.declarations)
			{
				assertComponentSignature(declaration);
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
				const calls = new Map(descriptor.privateAbi.exports.map(abi => {
					if(!descriptor.bindingIr.declarations.some(item => item.id === abi.bindingId)) throw new Error("Component binding identity mismatch");
					const symbol = encoder.encode(`${abi.symbol}\0`);
					return [abi.bindingId, args => callComponentScalar(module, frame => {
						const name = module._malloc(symbol.length);
						if(!name) throw new Error("Component call allocation failed");
						try
{ module.HEAP8.set(symbol, name); return module._bridge_scalar_call(name, frame); }
						finally
{ module._free(name); }
					}, abi, args)];
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
