/**
 * Render compiler-authenticated Lean defaults in generated Perl wrappers.
 *
 * The wrapper counts arguments before applying defaults, so an explicitly
 * supplied undef remains a supplied Unit, Option.none, or invalid host value.
 *
 * @file
 */
import { perlStringLiteral } from "./naming.mjs";

const resolve = (ref, resolveNamed, seen = new Set()) => {
	if(ref.kind !== "named") return ref;
	if(seen.has(ref.id)) throw new TypeError(`Perl default type alias cycle at ${ref.id}`);
	const type = resolveNamed(ref.id);
	if(type?.kind !== "alias") return ref;
	return resolve(type.target, resolveNamed, new Set([...seen, ref.id]));
};

/**
 * Render one canonical Binding IR default in the public CPAN representation.
 *
 * @param value - Canonical default authenticated from Lean metadata.
 * @param ref - Compiler-owned parameter type.
 * @param resolveNamed - Resolve a named Binding IR definition.
 * @param moduleName - Generated Perl package namespace.
 */
export const renderPerlDefault = (value, ref, resolveNamed, moduleName) => {
	ref = resolve(ref, resolveNamed);
	if(ref.kind === "apply" && ref.constructor === "option")
	{
		if(value.kind === "option-none") return "undef";
		return `${moduleName}::Some->new(${renderPerlDefault(value.value
			, ref.arguments[0], resolveNamed, moduleName)})`;
	}
	if(ref.kind !== "primitive")
		throw new TypeError("Perl defaults require primitive or Option values");
	if(value.kind === "unit") return "undef";
	if(value.kind === "boolean") return value.value ? "true()" : "false()";
	if(value.kind === "integer")
		return ["nat", "int"].includes(ref.name)
			? `Math::BigInt->new(${perlStringLiteral(value.value)})` : value.value;
	if(value.kind === "string" || value.kind === "char")
		return perlStringLiteral(value.value);
	throw new TypeError(`Unsupported canonical Perl default kind: ${value.kind}`);
};
