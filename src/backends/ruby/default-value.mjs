/**
 * Render compiler-authenticated Lean defaults as ordinary Ruby values.
 *
 * Ruby evaluates a default expression only when the positional argument is
 * omitted. An explicitly supplied nil therefore still reaches the generated
 * validator as Option.none (or an invalid value for every non-Option type).
 *
 * @file
 */
import { rubyLiteral } from "./copied-assets.mjs";

const resolve = (ref, resolveNamed, seen = new Set()) => {
	if(ref.kind !== "named") return ref;
	if(seen.has(ref.id)) throw new TypeError(`Ruby default type alias cycle at ${ref.id}`);
	const type = resolveNamed(ref.id);
	if(type?.kind !== "alias") return ref;
	return resolve(type.target, resolveNamed, new Set([...seen, ref.id]));
};

/**
 * Render one canonical Binding IR default in the public Ruby representation.
 *
 * @param value - Canonical default authenticated from Lean metadata.
 * @param ref - Compiler-owned parameter type.
 * @param resolveNamed - Resolve a named Binding IR definition.
 */
export const renderRubyDefault = (value, ref, resolveNamed) => {
	ref = resolve(ref, resolveNamed);
	if(ref.kind === "apply" && ref.constructor === "option")
	{
		if(value.kind === "option-none") return "nil";
		return `Some.new(${renderRubyDefault(value.value, ref.arguments[0]
			, resolveNamed)})`;
	}
	if(ref.kind !== "primitive")
		throw new TypeError("Ruby defaults require primitive or Option values");
	if(value.kind === "unit") return "UNIT";
	if(value.kind === "boolean") return value.value ? "true" : "false";
	if(value.kind === "integer") return value.value;
	if(value.kind === "string" || value.kind === "char")
		return rubyLiteral(value.value);
	throw new TypeError(`Unsupported canonical Ruby default kind: ${value.kind}`);
};
