/**
 * Independent List signatures, retaining List/Array distinctions at every level.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const listPrimitives = ["unit", "bool", "uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64", "nat", "int", "float32", "float64", "string", "bytes", "char", "usize", "isize"];
export const listPacket = { record: "Lists.Packet"
	, fields: {
		sequences: { list: { list: "uint32" } }
		, branches: { list: { option: { result: [{ tuple: ["nat", "unit"] }, "string"] } } }
		, buffers: { list: "bytes" }
		, arrays: { array: { list: { tuple: ["bool", "char"] } } }
	}
};
let deep = "uint32";
for(let level = 0; level < 24; level++) deep = { list: deep };
export const listSignatures = [
	...listPrimitives.map(primitive => ({ name: `Lists.reverse_${primitive}`, parameters: [{ list: primitive }], result: { list: primitive } }))
	, { name: "Lists.join", parameters: [{ list: "string" }], result: "string" }
	, { name: "Lists.mix", parameters: [{ list: { array: "uint32" } }], result: { array: { list: "uint32" } } }
	, { name: "Lists.transform", parameters: [listPacket], result: listPacket }
	, { name: "Lists.duplicate", parameters: ["bytes"], result: { list: "bytes" } }
	, { name: "Lists.generate", parameters: ["nat"], result: { list: "uint32" } }
	, { name: "Lists.nest", parameters: [{ option: { list: { result: [{ list: "unit" }, "string"] } } }], result: { option: { list: { result: [{ list: "unit" }, "string"] } } } }
	, { name: "Lists.swap", parameters: [{ result: [{ tuple: [{ list: "nat" }, { list: "uint32" }] }, { list: "string" }] }], result: { result: [{ list: "string" }, { tuple: [{ list: "nat" }, { list: "uint32" }] }] } }
	, { name: "Lists.deep", parameters: [deep], result: deep }
];

/** Reviewed without consulting compiler metadata or generated adapters. */
export const listReviewedIr = () => corpusReviewedIr({ id: "lists" }, listSignatures);
