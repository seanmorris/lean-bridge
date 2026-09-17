/**
 * Generate typed public Rust calls from independent corpus signatures and inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { corpusCases, corpusHostCase, corpusSignatures } from "../fixtures/type-corpus/cases.mjs";

const literal = value => `"${[...value].map(ch => ch === '"' ? '\\"' : ch === "\\" ? "\\\\" : ch.codePointAt(0) < 32 ? `\\u{${ch.codePointAt(0).toString(16)}}` : ch).join("")}"`;
const scalars = { unit: "()", bool: "bool", uint8: "u8", uint16: "u16"
	, uint32: "u32", uint64: "u64", int8: "i8", int16: "i16"
	, int32: "i32", int64: "i64", float32: "f32", float64: "f64"
	, nat: "api::BigUint", int: "api::BigInt", string: "String"
	, bytes: "Vec<u8>" };
const owned = type => typeof type === "string" ? scalars[type] : type.array ? `Vec<${owned(type.array)}>` : `api::${type.record.split(".").at(-1)}`;
const borrowed = type => typeof type !== "string" || ["nat", "int", "string", "bytes"].includes(type);
const inputType = type => type === "string" ? "&str" : type === "bytes" ? "&[u8]" : type.array ? `&[${owned(type.array)}]` : `${borrowed(type) ? "&" : ""}${owned(type)}`;
const value = (wire, type) => {
	if(Object.hasOwn(wire, "integer"))
	{
		if(type === "nat" || type === "int")
			return `${literal(wire.integer)}.parse::<api::${type === "int" || wire.integer.startsWith("-") ? "BigInt" : "BigUint"}>().unwrap()`;
		return `${wire.integer}${/^(?:u?int)\d+$/.test(type) ? scalars[type] : "i32"}`;
	}
	if(Object.hasOwn(wire, "bool")) return String(wire.bool);
	if(Object.hasOwn(wire, "unit")) return "()";
	if(Object.hasOwn(wire, "string")) return `${literal(wire.string)}.to_string()`;
	if(Object.hasOwn(wire, "bytes")) return `vec![${wire.bytes.map(byte => `${byte}u8`).join(", ")}]`;
	if(Object.hasOwn(wire, "array")) return `vec![${wire.array.map(item => value(item, type.array)).join(", ")}]`;
	if(Object.hasOwn(wire, "record")) return `api::${wire.record} { ${Object.entries(wire.fields).map(([name, wire]) => `${name}: ${value(wire, type.fields[name])}`).join(", ")} }`;
	for(const [kind, bits] of [["float32", 32], ["float64", 64]]) if(Object.hasOwn(wire, kind))
		return wire[kind] === "nan" ? `f${bits}::NAN` : `f${bits}::from_bits(${wire[kind]}u${bits})`;
	assert.fail("Unsupported Rust corpus value");
};
const wire = (type, expression) => {
	if(typeof type === "string") return `${({ bool: "boolean", string: "text", bytes: "bytes", unit: "unit", float32: "float32", float64: "float64" })[type] ?? "integer"}(${expression})`;
	if(type.array) return `object(&[("array", sequence((${expression}).iter().map(|item| ${wire(type.array, "item")})))])`;
	return `object(&[("record", quote(${literal(type.record.split(".").at(-1))})), ("fields", object(&[${Object.entries(type.fields).map(([name, field]) => `(${literal(name)}, ${wire(field, `&(${expression}).${name}`)})`).join(", ")}]))])`;
};
const signature = (library, entry) => corpusSignatures(library).find(signature => signature.name === `${library.module}.${entry.operation}`);
const call = (library, entry) => `api::${library.snakeOperations[library.operations.indexOf(entry.operation)]}(${signature(library, entry).parameters.map((type, index) => `${borrowed(type) ? "&" : ""}arg${index}`).join(", ")})`;
const bindings = (library, entry) => entry.arguments.map((argument, index) => `let mut arg${index} = ${value(argument, signature(library, entry).parameters[index])};`).join("\n");
const header = library => `#![deny(overflowing_literals)]\n#![forbid(unsafe_code)]\n#![allow(unused_mut)]\nuse ${library.rustModule} as api;\n`;

/**
 * Require the exact borrowed inputs and owned Result type of every public export.
 *
 * @param library - Independent expected signatures, not generated Rust metadata.
 */
export const corpusRustSignatures = library => corpusSignatures(library).map((signature, index) =>
	`let _: fn(${signature.parameters.map(inputType).join(", ")}) -> Result<${owned(signature.result)}, api::Error> = api::${library.snakeOperations[index]};`).join("\n");

/**
 * Compile one invalid input on its own, without executing or coercing it.
 *
 * @param library - Catalog API being imported.
 * @param entry - Shared case with an explicit Rust compile-rejection policy.
 */
export const corpusRustRejection = (library, entry) => {
	assert.equal(corpusHostCase(entry, "rust").expectation.kind, "compile-rejection");
	return `${header(library)}fn main() {\n${bindings(library, entry)}\nlet _ = ${call(library, entry)};\n}\n`;
};

/**
 * Emit observed runtime values, independent-copy checks and limit recovery.
 *
 * @param library - Catalog API, inputs and separately maintained Rust names.
 */
export const corpusRustSource = library => {
	const cases = corpusCases(library).map(entry => corpusHostCase(entry, "rust"));
	const blocks = cases.filter(entry => entry.expectation.kind === "lean-oracle").map(entry => {
		const type = signature(library, entry).result;
		const field = library.id === "shop" ? "batches" : "samples";
		const copy = entry.checkIndependentCopy;
		const mutate = name => {
			const selected = Object.entries(type.fields);
			return `for row in &mut ${name}.${field} { row.push(17); }
${name}.${selected.find(([, type]) => type === "string")[0]}.replace_range(0..1, "X");
${name}.${selected.find(([, type]) => type === "nat")[0]} += 1u8;
${name}.${selected.find(([, type]) => type === "int")[0]} -= 1u8;`;
		};
		return `{
${bindings(library, entry)}
${copy ? `let before = ${wire(type, "&arg0")};` : ""}
let mut result = ${call(library, entry)}.expect(${literal(entry.id)});
let observed = ${wire(type, "&result")};
${copy ? `assert_eq!(${wire(type, "&arg0")}, before);
${mutate("arg0")}
assert_eq!(${wire(type, "&result")}, observed);
let changed = ${wire(type, "&arg0")};
${mutate("result")}
assert_eq!(${wire(type, "&arg0")}, changed);` : ""}
results.push(object(&[("id", quote(${literal(entry.id)})), ("status", quote("matched")), ("observed", observed), ("independentCopy", "${copy}".into())]));
}`;
	});
	const recovery = cases.find(entry => entry.id.endsWith("/dependency"));
	return `${header(library)}include!("wire.rs");
fn main() -> Result<(), api::Error> {
${corpusRustSignatures(library)}
let mut results = Vec::new();
${blocks.join("\n")}
let mut limits = Vec::new();
for _ in 0..3 {
    let oversized = "x".repeat(16 * 1024 * 1024 + 1);
    assert!(matches!(api::${library.snakeOperations[3]}(&oversized, ""), Err(api::Error::Limit)));
    ${bindings(library, recovery)}
    let recovered = ${call(library, recovery)}?;
    limits.push(object(&[("exception", quote("Limit")), ("recovery", integer(&recovered))]));
}
println!("{}", object(&[("schemaVersion", "1".into()), ("profile", quote("rust")), ("module", quote(${literal(library.rustModule)})), ("results", sequence(results.into_iter())), ("limits", sequence(limits.into_iter()))]));
Ok(())
}
`;
};
