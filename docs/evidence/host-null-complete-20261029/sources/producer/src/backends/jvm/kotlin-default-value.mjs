/**
 * Render compiler-authenticated Lean defaults in generated Kotlin metadata.
 *
 * @file
 */

const resolve = (ref, model, seen = new Set()) => {
	if(ref.kind !== "named") return ref;
	if(seen.has(ref.id)) throw new TypeError(`Kotlin default type alias cycle at ${ref.id}`);
	const type = model.ir.types.find(candidate => candidate.id === ref.id);
	if(type?.kind !== "alias") return ref;
	return resolve(type.target, model, new Set([...seen, ref.id]));
};

const integer = (value, scalar) => {
	if(["uint64", "nat", "int"].includes(scalar))
		return `java.math.BigInteger(${JSON.stringify(value)})`;
	if(scalar === "int8") return `(${value}).toByte()`;
	if(scalar === "int16") return `(${value}).toShort()`;
	if(["uint32", "int64"].includes(scalar)) return `${value}L`;
	if(["uint8", "uint16", "int32"].includes(scalar)) return value;
	throw new TypeError(`Unsupported canonical Kotlin integer type: ${scalar}`);
};

/**
 * Render one canonical Binding IR default in the public Kotlin model.
 *
 * @param value - Canonical default authenticated from Lean metadata.
 * @param ref - Compiler-owned parameter type.
 * @param model - Closed copied-value Kotlin projection.
 */
export const renderKotlinDefault = (value, ref, model) => {
	const resolved = resolve(ref, model);
	if(resolved.kind === "apply" && resolved.constructor === "option")
	{
		const option = model.compoundNames.option;
		if(value.kind === "option-none") return `${option}.none()`;
		return `${option}.some(${renderKotlinDefault(value.value, resolved.arguments[0], model)})`;
	}
	if(resolved.kind !== "primitive")
		throw new TypeError("Kotlin defaults require primitive or Option values");
	if(value.kind === "unit") return `${model.namespace}.Unit.INSTANCE`;
	if(value.kind === "boolean") return value.value ? "true" : "false";
	if(value.kind === "integer")
		return integer(value.value, model.surface.copy(ref).scalarName);
	if(value.kind === "string") return JSON.stringify(value.value);
	if(value.kind === "char") return `0x${value.value.codePointAt(0).toString(16)}`;
	throw new TypeError(`Unsupported canonical Kotlin default kind: ${value.kind}`);
};
