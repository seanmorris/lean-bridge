/**
 * Independently reviewed record fields, nominal identities and source calls.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const primitiveFields = {
	unit: "unit", flag: "bool", u8: "uint8", u16: "uint16", u32: "uint32"
	, u64: "uint64", i8: "int8", i16: "int16", i32: "int32", i64: "int64"
	, natural: "nat", integer: "int", f32: "float32", f64: "float64"
	, text: "string", bytes: "bytes", char: "char", usize: "usize", isize: "isize"
};
const record = (name, fields) => ({ record: `Records.${name}`, fields });
export const primitives = record("Primitives", primitiveFields);
const empty = record("Empty", {}), single = record("Single", { value: "uint64" }), count = record("Count", { value: "nat" });
const pair = record("Pair", { first: "uint32", second: "string" }), reversed = record("Reversed", { second: "string", first: "uint32" });
export const packet = record("Packet", { label: "string", values: { array: { array: primitives } }, empty, single, count, pair, reversed });
export const recordSignatures = [
	{ name: "Records.inspect", parameters: [primitives], result: "bool" }
	, { name: "Records.shuffle", parameters: [packet], result: packet }
	, { name: "Records.reverse", parameters: [{ array: primitives }], result: { array: primitives } }
	, { name: "Records.empty", parameters: [empty], result: empty }
	, { name: "Records.single", parameters: [single], result: single }
	, { name: "Records.count", parameters: [count], result: count }
	, { name: "Records.make", parameters: [], result: pair }
	, { name: "Records.duplicate", parameters: [packet], result: { array: packet } }
];

/** Independently specified input contract, never extracted from generated IR. */
export const recordReviewedIr = () => corpusReviewedIr({ id: "records" }, recordSignatures);
