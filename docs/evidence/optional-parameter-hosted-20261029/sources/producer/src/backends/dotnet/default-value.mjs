/**
 * Render compiler-authenticated Lean defaults in generated C# overloads.
 *
 * The full-arity public method remains the canonical ABI.  Shorter overloads
 * supply only omitted trailing arguments, so explicit values (including
 * Option.None and Unit) never become omission sentinels.
 *
 * @file
 */

const resolve = (ref, model, seen = new Set()) => {
	if(ref.kind !== "named") return ref;
	if(seen.has(ref.id)) throw new TypeError(`C# default type alias cycle at ${ref.id}`);
	const type = model.ir.types.find(candidate => candidate.id === ref.id);
	if(type?.kind !== "alias") return ref;
	return resolve(type.target, model, new Set([...seen, ref.id]));
};

const integer = (value, scalar) => {
	const names = {
		uint8: "Byte", uint16: "UInt16", uint32: "UInt32", uint64: "UInt64"
		, int8: "SByte", int16: "Int16", int32: "Int32", int64: "Int64"
	};
	if(scalar === "nat" || scalar === "int")
		return `global::System.Numerics.BigInteger.Parse(${JSON.stringify(value)}, global::System.Globalization.CultureInfo.InvariantCulture)`;
	const name = names[scalar];
	if(!name) throw new TypeError(`Unsupported canonical C# integer type: ${scalar}`);
	return `global::System.${name}.Parse(${JSON.stringify(value)}, global::System.Globalization.CultureInfo.InvariantCulture)`;
};

/**
 * Render one canonical Binding IR default in the public copied-value model.
 *
 * @param value - Canonical default authenticated from Lean metadata.
 * @param ref - Compiler-owned parameter type.
 * @param model - Closed copied-value C# projection.
 */
export const renderDotnetDefault = (value, ref, model) => {
	const resolved = resolve(ref, model);
	if(resolved.kind === "apply" && resolved.constructor === "option")
	{
		const type = model.publicType(model.surface.copy(ref));
		if(value.kind === "option-none") return `${type}.None`;
		return `${type}.Some(${renderDotnetDefault(value.value, resolved.arguments[0], model)})`;
	}
	if(resolved.kind !== "primitive")
		throw new TypeError("C# defaults require primitive or Option values");
	if(value.kind === "unit") return "default(Unit)";
	if(value.kind === "boolean") return value.value ? "true" : "false";
	if(value.kind === "integer")
		return integer(value.value, model.surface.copy(ref).scalarName);
	if(value.kind === "string") return JSON.stringify(value.value);
	if(value.kind === "char")
		return `new global::System.Text.Rune(0x${value.value.codePointAt(0).toString(16)})`;
	throw new TypeError(`Unsupported canonical C# default kind: ${value.kind}`);
};
