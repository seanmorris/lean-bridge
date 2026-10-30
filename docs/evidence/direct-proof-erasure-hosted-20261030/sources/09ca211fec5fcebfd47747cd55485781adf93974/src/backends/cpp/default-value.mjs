/**
 * Render compiler-authenticated Lean defaults in generated C++20 wrappers.
 *
 * @file
 */
import { copiedCppType, cppCopiedNamespace } from "./copied-values.mjs";

const resolve = (ref, surface, seen = new Set()) => {
	if(ref.kind !== "named") return ref;
	if(seen.has(ref.id)) throw new TypeError(`C++ default type alias cycle at ${ref.id}`);
	const type = surface.ir.types.find(candidate => candidate.id === ref.id);
	if(type?.kind !== "alias") return ref;
	return resolve(type.target, surface, new Set([...seen, ref.id]));
};

const byteString = value => {
	const bytes = [...new TextEncoder().encode(value)];
	const literal = bytes.length ? bytes.map(byte => `"\\x${byte.toString(16).padStart(2, "0")}"`).join("") : '""';
	return `std::string{${literal}, ${bytes.length}}`;
};

const integer = (value, scalar) => {
	if(["nat", "int"].includes(scalar)) return `${scalar === "nat" ? "Nat" : "Int"}{${JSON.stringify(value)}}`;
	const widths = { uint8: 8, uint16: 16, uint32: 32, uint64: 64
		, int8: 8, int16: 16, int32: 32, int64: 64 };
	const width = widths[scalar], number = BigInt(value);
	if(!width) throw new TypeError(`Unsupported canonical C++ integer type: ${scalar}`);
	if(scalar.startsWith("u")) return `static_cast<uint${width}_t>(UINT${width}_C(${number}))`;
	const maximum = (1n << BigInt(width - 1)) - 1n;
	const literal = number === -maximum - 1n ? `(-INT${width}_C(${maximum}) - INT${width}_C(1))`
		: number < 0n ? `(-INT${width}_C(${-number}))` : `INT${width}_C(${number})`;
	return `static_cast<int${width}_t>(${literal})`;
};

/**
 * Render one canonical Binding IR default in the copied C++ model.
 *
 * @param value - Canonical default authenticated from Lean metadata.
 * @param ref - Compiler-owned parameter type.
 * @param surface - Closed copied-value C++ surface.
 */
export const renderCppDefault = (value, ref, surface) => {
	const resolved = resolve(ref, surface), copy = surface.copy(ref);
	if(resolved.kind === "apply" && resolved.constructor === "option")
	{
		if(value.kind === "option-none") return "std::nullopt";
		const type = copiedCppType(copy, cppCopiedNamespace(surface));
		return `${type}{${renderCppDefault(value.value, resolved.arguments[0], surface)}}`;
	}
	if(resolved.kind !== "primitive")
		throw new TypeError("C++ defaults require primitive or Option values");
	if(value.kind === "unit") return "std::monostate{}";
	if(value.kind === "boolean") return value.value ? "true" : "false";
	if(value.kind === "integer") return integer(value.value, copy.scalarName);
	if(value.kind === "string") return byteString(value.value);
	if(value.kind === "char") return `static_cast<char32_t>(0x${value.value.codePointAt(0).toString(16)})`;
	throw new TypeError(`Unsupported canonical C++ default kind: ${value.kind}`);
};
