/**
 * Synthetic collection converter probes, separate from installed Lean execution.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { collectionSignatures } from "./collection-fixture.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

/** Extend the independent collection contract with nested presence and result flags. */
export const witCollectionFaultIr = () => {
	const flags = { tuple: [{ option: "bool" }, { result: ["bool", "int"] }] };
	return corpusReviewedIr({ id: "probe" }, [...collectionSignatures, { name: "Probe.booleanFlags", parameters: [flags], result: flags }]);
};

/**
 * Bind probe names to generated C layouts, never to expected conversion results.
 *
 * @param model - Admitted synthetic WIT model.
 */
export const witCollectionFaultSource = async model => {
	const scalar = name => model.surface.copy({ kind: "primitive", name });
	const record = name => model.surface.copy({ kind: "named", id: `lean:Records.${name}` });
	const flags = model.surface.copy(model.surface.functions.find(fn => fn.field === "boolean_flags").declaration.result.type);
	const packet = record("Packet"), rows = packet.fields.find(field => field.name === "values").type;
	const words = model.surface.copy(model.surface.functions.find(fn => fn.field === "array_reverse_uint32").declaration.result.type);
	const copies = { bool: scalar("bool"), unit: scalar("unit")
		, uint32: scalar("uint32"), nat: scalar("nat"), int: scalar("int")
		, string: scalar("string"), bytes: scalar("bytes")
		, primitives: record("Primitives"), packet, rows
		, row: rows.element, words, flags
		, option: flags.fields[0].type, result: flags.fields[1].type };
	const names = Object.entries(copies).map(([name, copy]) => `typedef ${copy.name} native_${name};\n#define IN_${name.toUpperCase()} lb_in_${copy.index}\n#define OUT_${name.toUpperCase()} lb_out_${copy.index}`).join("\n");
	return (await readFile("tests/fixtures/collection-consumers/wit-faults.c", "utf8")).replace("/* GENERATED_NAMES */", names);
};
