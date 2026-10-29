/**
 * Render canonical Lean defaults inside exported Rust macro expansions.
 *
 * Rust has no default function arguments. The generated crate therefore keeps
 * its established full-arity function and exports a same-named macro for every
 * arity that omits a trailing declared default.
 *
 * @file
 */

const stringLiteral = value => `"${Array.from(value).map(character => {
	const point = character.codePointAt(0);
	if(character === "\\") return "\\\\";
	if(character === "\"") return "\\\"";
	if(character === "\n") return "\\n";
	if(character === "\r") return "\\r";
	if(character === "\t") return "\\t";
	if(point < 0x20 || point === 0x7F) return `\\u{${point.toString(16)}}`;
	return character;
}).join("")}"`;

const resolve = (ref, resolveNamed, seen = new Set()) => {
	if(ref.kind !== "named") return ref;
	if(seen.has(ref.id)) throw new TypeError(`Rust default type alias cycle at ${ref.id}`);
	const type = resolveNamed(ref.id);
	if(type?.kind !== "alias") return ref;
	return resolve(type.target, resolveNamed, new Set([...seen, ref.id]));
};

const owned = (value, ref, resolveNamed) => {
	ref = resolve(ref, resolveNamed);
	if(ref.kind === "apply" && ref.constructor === "option")
	{
		if(value.kind === "option-none") return "None";
		return `Some(${owned(value.value, ref.arguments[0], resolveNamed)})`;
	}
	if(ref.kind !== "primitive") throw new TypeError("Rust defaults require primitive or Option values");
	if(value.kind === "unit") return "()";
	if(value.kind === "boolean") return value.value ? "true" : "false";
	if(value.kind === "integer")
	{
		if(ref.name === "nat") return `$crate::BigUint::parse_bytes(b${stringLiteral(value.value)}, 10).unwrap()`;
		if(ref.name === "int") return `$crate::BigInt::parse_bytes(b${stringLiteral(value.value)}, 10).unwrap()`;
		return value.value;
	}
	if(value.kind === "string") return `::std::string::String::from(${stringLiteral(value.value)})`;
	if(value.kind === "char") return `'\\u{${value.value.codePointAt(0).toString(16)}}'`;
	throw new TypeError(`Unsupported canonical Rust default kind: ${value.kind}`);
};

/**
 * Render a default using the public copied crate's input representation.
 *
 * @param value - Canonical Binding IR default.
 * @param ref - Compiler-owned parameter type.
 * @param resolveNamed - Resolve a named Binding IR definition.
 */
export const renderRustDefault = (value, ref, resolveNamed) => {
	const type = resolve(ref, resolveNamed);
	if(type.kind === "apply" && type.constructor === "option") return `&${owned(value, type, resolveNamed)}`;
	if(type.kind !== "primitive") throw new TypeError("Rust defaults require primitive or Option values");
	if(type.name === "string") return stringLiteral(value.value);
	if(type.name === "nat" || type.name === "int") return `&${owned(value, type, resolveNamed)}`;
	return owned(value, type, resolveNamed);
};
