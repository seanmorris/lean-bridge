/**
 * JavaScript primitives in the compiler-checked native wasm32 value layout.
 * Allocation receipts and identity lifetimes belong to the surrounding call.
 *
 * @file
 */
import { scalarCopyLimit, validateComponentScalar } from "../abi/component-scalars.mjs";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const byteLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength").get;
const formats = Object.freeze({
	unit: [1, "Uint8"], bool: [1, "Uint8"], char: [4, "Uint32"]
	, uint8: [1, "Uint8"], uint16: [2, "Uint16"], uint32: [4, "Uint32"]
	, uint64: [8, "BigUint64"]
	, int8: [1, "Int8"], int16: [2, "Int16"], int32: [4, "Int32"]
	, int64: [8, "BigInt64"]
	, usize: [4, "Uint32"], isize: [4, "Int32"]
	, float32: [4, "Float32"], float64: [8, "Float64"]
});
const dynamic = new Set(["string", "bytes", "nat", "int"]);
const view = module => new DataView(module.HEAP8.buffer);

/**
 * Check bounds before dereferencing a private wasm32 address.
 *
 * @param module - Live Emscripten heap, refreshed after memory growth.
 * @param pointer - Unsigned wasm32 address.
 * @param bytes - Complete span, never a truncated machine-word multiplication.
 * @param alignment - Required power-of-two native alignment.
 */
export const assertOwnedWasmSpan = (module, pointer, bytes, alignment = 1) => {
	if(!Number.isInteger(pointer) || pointer < 0 || pointer > 0xffffffff
		|| !Number.isInteger(bytes) || bytes < 0 || bytes > 0xffffffff
		|| ![1, 2, 4, 8].includes(alignment) || pointer % alignment
		|| (bytes > 0 && pointer === 0) || pointer + bytes > module.HEAP8.length)
		throw new RangeError("Invalid owned wasm32 memory span");
};
const chargeBytes = (bytes, charge) => {
	if(!Number.isSafeInteger(bytes) || bytes < 0 || bytes > scalarCopyLimit)
		throw new RangeError("Owned wasm32 copy budget exceeded");
	charge(bytes);
};
const checkStorage = (module, pointer, type) => {
	if(dynamic.has(type)) assertOwnedWasmSpan(module, pointer, type === "int" ? 12 : 8, 4);
	else
	{
		if(!Object.hasOwn(formats, type)) throw new TypeError("Unknown owned wasm32 primitive");
		assertOwnedWasmSpan(module, pointer, formats[type][0], formats[type][0]);
	}
};

/**
 * Encode without coercion. The call owns every allocation, including failures.
 *
 * @param module - Shared Wasm heap.
 * @param pointer - Checked native scalar storage.
 * @param type - Primitive name from the authenticated layout.
 * @param input - Public JavaScript value.
 * @param controls - Private allocation and cumulative byte-budget operations.
 */
export const writeOwnedWasmScalar = (module, pointer, type, input, controls) => {
	checkStorage(module, pointer, type);
	const value = validateComponentScalar(type, input);
	if(!dynamic.has(type))
	{
		const encoded = type === "unit" ? 0 : type === "bool" ? Number(value) : type === "char" ? value.codePointAt(0) : value;
		view(module)[`set${formats[type][1]}`](pointer, encoded, true);
		return;
	}
	const integer = type === "nat" || type === "int";
	let bytes;
	if(type === "string")
	{
		let size = value.length;
		for(const character of value)
		{
			const point = character.codePointAt(0);
			if(point >= 128) size += point < 2048 ? 1 : 2;
		}
		chargeBytes(size, controls.charge); bytes = encoder.encode(value);
	}
	else if(type === "bytes")
	{
		const size = Reflect.apply(byteLength, value, []);
		chargeBytes(size, controls.charge);
		// A host may supply a view of this heap. Snapshot before allocate can grow it.
		bytes = new Uint8Array(size); Uint8Array.prototype.set.call(bytes, value);
	}
	else
	{
		let magnitude = value < 0n ? -value : value;
		const size = magnitude === 0n ? 0 : Math.ceil(magnitude.toString(16).length / 8) * 4;
		chargeBytes(size, controls.charge);
		bytes = new Uint8Array(size); const limbs = new DataView(bytes.buffer);
		for(let offset = 0; offset < size; offset += 4)
		{
			limbs.setUint32(offset, Number(magnitude & 0xffffffffn), true); magnitude >>= 32n;
		}
	}
	const data = bytes.length ? controls.allocate(bytes.length) : 0;
	assertOwnedWasmSpan(module, data, bytes.length, integer ? 4 : 1);
	module.HEAP8.set(bytes, data);
	const result = view(module);
	result.setUint32(pointer, data, true);
	result.setUint32(pointer + 4, integer ? bytes.length / 4 : bytes.length, true);
	if(type === "int") result.setUint8(pointer + 8, value < 0n ? 1 : 0);
};

/**
 * Copy output payloads only after the native transaction authenticates the span.
 * No returned value retains a view of memory freed when the call finishes.
 *
 * @param module - Shared Wasm heap.
 * @param pointer - Checked native scalar storage.
 * @param type - Primitive name from the authenticated layout.
 * @param controls - Cumulative byte budget and native allocation-receipt claims.
 */
export const readOwnedWasmScalar = (module, pointer, type, controls) => {
	checkStorage(module, pointer, type);
	const data = view(module);
	if(!dynamic.has(type))
	{
		const stored = data[`get${formats[type][1]}`](pointer, true);
		let result = stored;
		if(type === "unit")
		{
			if(stored !== 0) throw new TypeError("Invalid owned wasm32 Unit");
			result = undefined;
		}
		else if(type === "bool")
		{
			if(stored > 1) throw new TypeError("Invalid owned wasm32 Bool");
			result = stored === 1;
		}
		else if(type === "char")
		{
			if(stored > 0x10ffff || stored >= 0xd800 && stored <= 0xdfff) throw new TypeError("Invalid owned wasm32 Char");
			result = String.fromCodePoint(stored);
		}
		return validateComponentScalar(type, result);
	}
	if(typeof controls.claim !== "function") throw new TypeError("Owned wasm32 output requires an allocation receipt");
	const integer = type === "nat" || type === "int";
	const address = data.getUint32(pointer, true), length = data.getUint32(pointer + 4, true);
	const bytes = length * (integer ? 4 : 1), negative = type === "int" ? data.getUint8(pointer + 8) : 0;
	if(negative > 1 || !length && (address || negative)) throw new TypeError("Invalid owned wasm32 scalar representation");
	chargeBytes(bytes, controls.charge);
	assertOwnedWasmSpan(module, address, bytes, integer ? 4 : 1);
	if(bytes) controls.claim(address, bytes);
	// Receipt validation may call into Wasm and grow its memory.
	assertOwnedWasmSpan(module, address, bytes, integer ? 4 : 1);
	if(integer)
	{
		const limbs = view(module);
		if(length && limbs.getUint32(address + bytes - 4, true) === 0) throw new TypeError("Invalid owned wasm32 integer magnitude");
		let value = 0n;
		for(let index = length - 1; index >= 0; --index) value = value << 32n | BigInt(limbs.getUint32(address + index * 4, true));
		return negative ? -value : value;
	}
	const payload = new Uint8Array(module.HEAP8.buffer, address, bytes);
	return type === "string" ? decoder.decode(payload) : payload.slice();
};
