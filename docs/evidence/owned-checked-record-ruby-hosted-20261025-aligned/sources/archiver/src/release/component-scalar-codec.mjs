/**
 * Exact scalar slots shared by component calls and synchronous callback frames.
 *
 * @file
 */
import { componentScalarTypes, scalarCopyLimit, validateComponentScalar } from "../abi/component-scalars.mjs";

const encoder = new TextEncoder();
// A leading U+FEFF is user data, not a transport byte-order marker.
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const copied = type => ["string", "bytes", "nat", "int"].includes(type);
const view = module => new DataView(module.HEAP8.buffer);

const integerBytes = value => {
	let magnitude = value < 0n ? -value : value;
	const count = magnitude === 0n ? 0 : Math.ceil(magnitude.toString(16).length / 8);
	if(count * 4 > scalarCopyLimit) throw new RangeError("Integer exceeds the component copy budget");
	const bytes = new Uint8Array(count * 4), data = new DataView(bytes.buffer);
	for(let index = 0; index < count; index += 1)
	{
		data.setUint32(index * 4, Number(magnitude & 0xffffffffn), true);
		magnitude >>= 32n;
	}
	return bytes;
};

/**
 * Encode a checked value; the caller owns every allocation supplied by allocate.
 *
 * @param module - Shared Wasm memory, which may grow during allocation.
 * @param slot - Aligned scalar slot address in that memory.
 * @param type - Admitted primitive name.
 * @param input - Exact host value, without coercion.
 * @param allocate - Call-arena allocator for copied payloads.
 */
export const writeComponentScalarSlot = (module, slot, type, input, allocate) => {
	const value = validateComponentScalar(type, input);
	view(module).setUint32(slot, componentScalarTypes.indexOf(type), true);
	view(module).setUint32(slot + 4, 0, true);
	view(module).setBigUint64(slot + 8, 0n, true);
	if(copied(type))
	{
		const bytes = type === "string" ? encoder.encode(value) : type === "bytes" ? value : integerBytes(value);
		if(bytes.length > scalarCopyLimit) throw new RangeError("Component copy budget exceeded");
		const pointer = allocate(bytes.length);
		module.HEAP8.set(bytes, pointer);
		view(module).setUint32(slot + 4, typeof value === "bigint" && value < 0n ? 1 : 0, true);
		view(module).setUint32(slot + 8, pointer, true);
		view(module).setUint32(slot + 12, type === "nat" || type === "int" ? bytes.length / 4 : bytes.length, true);
	}
	else if(type === "float32") view(module).setFloat32(slot + 8, value, true);
	else if(type === "float64") view(module).setFloat64(slot + 8, value, true);
	else if(type === "char") view(module).setBigUint64(slot + 8, BigInt(value.codePointAt(0)), true);
	else view(module).setBigUint64(slot + 8, BigInt.asUintN(64, type === "unit" ? 0n : BigInt(value)), true);
};

/**
 * Decode copied values before their owner releases the frame, retaining no views.
 *
 * @param module - Shared Wasm memory.
 * @param slot - Scalar slot address.
 * @param type - Expected primitive name, independently supplied by the signature.
 * @param charge - Optional cumulative copy-budget accounting for callback scopes.
 */
export const readComponentScalarSlot = (module, slot, type, charge = () => {}) => {
	const data = view(module);
	if(!componentScalarTypes.includes(type) || data.getUint32(slot, true) !== componentScalarTypes.indexOf(type)) throw new TypeError("Component result type mismatch");
	const flags = data.getUint32(slot + 4, true), bits = data.getBigUint64(slot + 8, true);
	const allowed = copied(type) ? type === "int" ? 3 : 2 : 0;
	if((flags & ~allowed) !== 0) throw new TypeError(`Invalid component ${type === "char" ? "Unicode scalar" : type} flags`);
	let value;
	if(type === "unit")
	{
		if(bits !== 0n) throw new TypeError("Invalid component unit representation");
		value = undefined;
	}
	else if(type === "bool")
	{
		if(bits > 1n) throw new TypeError("Invalid component boolean representation");
		value = bits === 1n;
	}
	else if(type === "float32")
	{
		if(data.getUint32(slot + 12, true) !== 0) throw new TypeError("Invalid component float32 padding");
		value = data.getFloat32(slot + 8, true);
	}
	else if(type === "float64") value = data.getFloat64(slot + 8, true);
	else if(type === "char")
	{
		if(bits > 0x10ffffn || (bits >= 0xd800n && bits <= 0xdfffn)) throw new TypeError("Invalid component Unicode scalar representation");
		value = String.fromCodePoint(Number(bits));
	}
	else if(copied(type))
	{
		const integer = type === "nat" || type === "int";
		const pointer = data.getUint32(slot + 8, true), length = data.getUint32(slot + 12, true);
		const byteLength = length * (integer ? 4 : 1);
		if(byteLength > scalarCopyLimit || pointer + byteLength > module.HEAP8.length || (integer && pointer % 4)) throw new RangeError("Invalid component result buffer");
		charge(byteLength);
		const bytes = new Uint8Array(module.HEAP8.buffer, pointer, byteLength);
		if(type === "string") value = decoder.decode(bytes);
		else if(type === "bytes") value = bytes.slice();
		else
		{
			if((length && data.getUint32(pointer + (length - 1) * 4, true) === 0) || (!length && (flags & 1))) throw new TypeError("Invalid component integer magnitude");
			value = 0n;
			for(let index = length - 1; index >= 0; index -= 1) value = (value << 32n) | BigInt(data.getUint32(pointer + index * 4, true));
			if(flags & 1) value = -value;
		}
	}
	else
	{
		value = type.startsWith("int") || type === "isize" ? data.getBigInt64(slot + 8, true) : bits;
		if(!type.endsWith("64")) value = Number(value);
	}
	return validateComponentScalar(type, value);
};
