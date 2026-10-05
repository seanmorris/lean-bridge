/**
 * Independent compound signatures, including asymmetric success/error types.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const compoundPrimitives = ["unit", "bool", "uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64", "nat", "int", "float32", "float64", "string", "bytes", "char", "usize", "isize"];
const option = type => ({ option: type }), result = (ok, error) => ({ result: [ok, error] }), tuple = (a, b) => ({ tuple: [a, b] });
export const packet = {
	record: "Compounds.Packet"
	, fields: {
		choice: option(result(tuple("nat", "unit"), "string"))
		, products: tuple(tuple("uint32", "string"), tuple("bool", "char"))
		, rows: { array: option(result(tuple("string", "uint64"), tuple("bytes", "int"))) }
		, nested: result(option(result(tuple("uint32", "unit"), "string")), option("nat"))
	}
};
let deep = result(tuple("uint32", "unit"), "string");
for(let level = 0; level < 24; level++) deep = option(deep);
export const compoundSignatures = [
	...compoundPrimitives.flatMap(primitive => [
		{ name: `Compounds.option_${primitive}`, parameters: [option(primitive)], result: option(primitive) }
		, { name: `Compounds.result_${primitive}`, parameters: [result(primitive, primitive)], result: result(primitive, primitive) }
		, { name: `Compounds.tuple_${primitive}`, parameters: [tuple(primitive, primitive)], result: tuple(primitive, primitive) }
	])
	, { name: "Compounds.classify", parameters: [option(option("unit"))], result: "uint32" }
	, { name: "Compounds.next", parameters: [option(option("unit"))], result: option(option("unit")) }
	, { name: "Compounds.flip", parameters: [result(tuple("uint32", option("unit")), option("string"))], result: result(option("string"), tuple("uint32", option("unit"))) }
	, { name: "Compounds.transform", parameters: [packet], result: packet }
	, { name: "Compounds.duplicate", parameters: [option("bytes")], result: result(option({ array: "bytes" }), "string") }
	, { name: "Compounds.deep", parameters: [deep], result: deep }
	, { name: "Compounds.make", parameters: [], result: option(result(tuple("uint64", "unit"), "string")) }
];

/** Reviewed independently of the metadata extractor and generated transport. */
export const compoundReviewedIr = () => corpusReviewedIr({ id: "compounds" }, compoundSignatures);
