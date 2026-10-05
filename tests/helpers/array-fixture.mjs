/**
 * Independently reviewed nested-array signatures and installed typed checks.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const arrayPrimitives = [
	["Unit", "unit"]
	, ["Bool", "bool"]
	, ["UInt8", "uint8"]
	, ["UInt16", "uint16"]
	, ["UInt32", "uint32"]
	, ["UInt64", "uint64"]
	, ["Int8", "int8"]
	, ["Int16", "int16"]
	, ["Int32", "int32"]
	, ["Int64", "int64"]
	, ["Nat", "nat"]
	, ["Int", "int"]
	, ["Float32", "float32"]
	, ["Float64", "float64"]
	, ["String", "string"]
	, ["Bytes", "bytes"]
	, ["Char", "char"]
	, ["USize", "usize"]
	, ["ISize", "isize"]
];
const rows = type => ({ array: { array: type } });
export const arraySignatures = [...arrayPrimitives.map(([name, type]) => ({ name: `Arrays.reverse${name}`, parameters: [rows(type)], result: rows(type) }))
	, { name: "Arrays.add", parameters: ["int", rows("int")], result: rows("int") }
	, { name: "Arrays.total", parameters: [rows("nat")], result: "nat" }
	, { name: "Arrays.words", parameters: [], result: rows("string") }
	, { name: "Arrays.duplicate", parameters: [{ array: "bytes" }], result: { array: "bytes" } }
	, { name: "Arrays.size", parameters: [{ array: "unit" }], result: "usize" }
	, { name: "Arrays.checkElements", parameters: arrayPrimitives.map(([, type]) => ({ array: type })), result: "bool" }];

/** The contract is authored independently from Lean extraction and adapters. */
export const arrayReviewedIr = () => corpusReviewedIr({ id: "arrays" }, arraySignatures);
