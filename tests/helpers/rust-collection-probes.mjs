/**
 * Resolve private layouts only for separate Rust conversion and failure probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * Bind independent malformed-value probes to compiler-checked private layouts.
 *
 * @param model - Generated Rust projection, never an expected public value oracle.
 */
export const rustCollectionConversionProbe = async model => {
	const source = await readFile("tests/fixtures/collection-consumers/rust-conversions.rs", "utf8");
	const imports = [];
	for(const fn of model.surface.functions.filter(fn => fn.field.startsWith("array_reverse_")))
	{
		const name = fn.field.slice("array_reverse_".length), copy = model.surface.copy(fn.declaration.result.type);
		imports.push(`use super::{to${copy.index} as encode_${name}, from${copy.index} as decode_${name}};`);
	}
	for(const [name, copy] of [["packet", model.surface.copies.find(copy => copy.record?.name === "Packet")]
		, ["deep", model.surface.copy(model.surface.functions.find(fn => fn.field === "deep").declaration.result.type)]])
		imports.push(`use super::{to${copy.index} as encode_${name}, from${copy.index} as decode_${name}};`);
	for(const [name, copy, type] of [["words", model.surface.copies.find(copy => copy.element?.scalarName === "uint32"), "NativeWords"]
		, ["text", model.surface.copies.find(copy => copy.scalarName === "string"), "NativeText"]
		, ["scalar_char", model.surface.copies.find(copy => copy.scalarName === "char"), null]])
		imports.push(`use super::{from${copy.index} as decode_${name}${type ? `, ${copy.ctype} as ${type}` : ""}};`);
	assert.equal(imports.length, 24);
	const probe = source.replace("{{CONVERTERS}}", imports.join("\n    "));
	assert.doesNotMatch(probe, /\{\{[A-Z_]+\}\}/);
	return { source, probe };
};
