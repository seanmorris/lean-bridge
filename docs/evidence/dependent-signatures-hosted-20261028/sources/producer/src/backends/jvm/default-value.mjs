/**
 * Render compiler-authenticated Lean defaults in generated Java overloads.
 *
 * @file
 */

const resolve = (ref, model, seen = new Set()) => {
	if(ref.kind !== "named") return ref;
	if(seen.has(ref.id)) throw new TypeError(`Java default type alias cycle at ${ref.id}`);
	const type = model.ir.types.find(candidate => candidate.id === ref.id);
	if(type?.kind !== "alias") return ref;
	return resolve(type.target, model, new Set([...seen, ref.id]));
};

const integer = (value, scalar) => {
	if(["uint64", "nat", "int"].includes(scalar))
		return `new java.math.BigInteger(${JSON.stringify(value)})`;
	if(scalar === "int8") return `(byte)${value}`;
	if(scalar === "int16") return `(short)${value}`;
	if(["uint32", "int64"].includes(scalar)) return `${value}L`;
	if(["uint8", "uint16", "int32"].includes(scalar)) return value;
	throw new TypeError(`Unsupported canonical Java integer type: ${scalar}`);
};

/**
 * Render one canonical Binding IR default in the public copied-value model.
 *
 * @param value - Canonical default authenticated from Lean metadata.
 * @param ref - Compiler-owned parameter type.
 * @param model - Closed copied-value JVM projection.
 */
export const renderJvmDefault = (value, ref, model) => {
	const resolved = resolve(ref, model);
	if(resolved.kind === "apply" && resolved.constructor === "option")
	{
		if(value.kind === "option-none") return "Option.none()";
		return `Option.some(${renderJvmDefault(value.value, resolved.arguments[0], model)})`;
	}
	if(resolved.kind !== "primitive")
		throw new TypeError("Java defaults require primitive or Option values");
	if(value.kind === "unit") return "Unit.INSTANCE";
	if(value.kind === "boolean") return value.value ? "true" : "false";
	if(value.kind === "integer")
		return integer(value.value, model.surface.copy(ref).scalarName);
	if(value.kind === "string") return JSON.stringify(value.value);
	if(value.kind === "char") return `0x${value.value.codePointAt(0).toString(16)}`;
	throw new TypeError(`Unsupported canonical Java default kind: ${value.kind}`);
};
