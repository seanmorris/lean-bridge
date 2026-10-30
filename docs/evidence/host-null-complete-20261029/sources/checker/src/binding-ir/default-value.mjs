/**
 * Validate canonical Lean-declared parameter defaults without using a host
 * language's omission or null conventions.
 *
 * @file
 */

const INTEGER = /^-?(?:0|[1-9][0-9]*)$/u;

const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys) => object(value)
	&& Object.keys(value).sort().join(",") === [...keys].sort().join(",");

/**
 * Report a structural problem in one canonical default value.
 *
 * `null` is deliberately absent from this value algebra. Binding IR reserves
 * it for a required parameter with no default; host null is an ordinary input
 * that must still pass the parameter's own type validator.
 *
 * @param value - Candidate canonical default.
 * @param depth - Recursion guard for nested Option.some defaults.
 * @returns {string | null} A diagnostic, or null when the shape is canonical.
 */
export const defaultValueShapeProblem = (value, depth = 0) => {
	if(depth > 32) return "default nesting exceeds 32";
	if(!object(value) || typeof value.kind !== "string") return "default must be a tagged object";
	if(value.kind === "unit" || value.kind === "option-none")
		return exact(value, ["kind"]) ? null : `${value.kind} default has unexpected fields`;
	if(value.kind === "boolean")
		return exact(value, ["kind", "value"]) && typeof value.value === "boolean"
			? null : "boolean default must contain one boolean value";
	if(value.kind === "integer")
		return exact(value, ["kind", "value"]) && typeof value.value === "string" && INTEGER.test(value.value)
			? null : "integer default must contain one canonical decimal string";
	if(value.kind === "string")
		return exact(value, ["kind", "value"]) && typeof value.value === "string"
			? null : "string default must contain one string value";
	if(value.kind === "char")
	{
		if(!exact(value, ["kind", "value"]) || typeof value.value !== "string" || Array.from(value.value).length !== 1)
			return "char default must contain one Unicode scalar value";
		const point = value.value.codePointAt(0);
		return point >= 0xD800 && point <= 0xDFFF ? "char default cannot contain a surrogate" : null;
	}
	if(value.kind === "option-some")
	{
		if(!exact(value, ["kind", "value"])) return "option-some default must contain one value";
		return defaultValueShapeProblem(value.value, depth + 1);
	}
	return `unsupported default kind ${value.kind}`;
};

const integerProblem = (value, name) => {
	let number;
	try
	{ number = BigInt(value.value); }
	catch
	{ return "integer default is not an exact integer"; }
	const widths = new Map([
		["uint8", [0n, 255n]]
		, ["uint16", [0n, 65535n]]
		, ["uint32", [0n, 4294967295n]]
		, ["uint64", [0n, 18446744073709551615n]]
		, ["int8", [-128n, 127n]]
		, ["int16", [-32768n, 32767n]]
		, ["int32", [-2147483648n, 2147483647n]]
		, ["int64", [-9223372036854775808n, 9223372036854775807n]]
	]);
	const bounds = widths.get(name);
	if(bounds && (number < bounds[0] || number > bounds[1])) return `${name} default is out of range`;
	if(["nat", "usize"].includes(name) && number < 0n) return `${name} default cannot be negative`;
	return null;
};

/**
 * Report whether a canonical default disagrees with its compiler-owned type.
 * Supports both native metadata shapes and Binding IR references.
 *
 * @param value - Canonical default value.
 * @param type - Native metadata type or Binding IR type reference.
 * @param resolveNamed - Resolve one Binding IR named type definition.
 * @param seen - Alias-cycle guard.
 * @returns {string | null} A diagnostic, or null when the value belongs to the type.
 */
export const defaultValueTypeProblem = (value, type, resolveNamed = () => null, seen = new Set()) => {
	const shape = defaultValueShapeProblem(value);
	if(shape) return shape;
	if(!object(type)) return "default has no runtime type";
	if(type.kind === "alias") return defaultValueTypeProblem(value, type.target, resolveNamed, seen);
	if(type.kind === "named")
	{
		if(seen.has(type.id)) return `default type alias cycle at ${type.id}`;
		const definition = resolveNamed(type.id);
		if(definition?.kind !== "alias") return `defaults for named type ${type.id} are not supported`;
		return defaultValueTypeProblem(value, definition.target, resolveNamed, new Set([...seen, type.id]));
	}
	if(type.kind === "option" || type.kind === "apply" && type.constructor === "option")
	{
		if(value.kind === "option-none") return null;
		if(value.kind !== "option-some") return "Option default must be option-none or option-some";
		const element = type.kind === "option" ? type.element : type.arguments?.[0];
		return defaultValueTypeProblem(value.value, element, resolveNamed, seen);
	}
	if(type.kind !== "primitive") return `defaults for ${type.kind} values are not supported`;
	if(type.name === "unit") return value.kind === "unit" ? null : "Unit default must be unit";
	if(type.name === "bool") return value.kind === "boolean" ? null : "Bool default must be boolean";
	if(type.name === "string") return value.kind === "string" ? null : "String default must be string";
	if(type.name === "char") return value.kind === "char" ? null : "Char default must be char";
	if(["uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64", "nat", "int", "usize", "isize"].includes(type.name))
		return value.kind === "integer" ? integerProblem(value, type.name) : `${type.name} default must be integer`;
	return `defaults for primitive ${type.name} are not supported`;
};
