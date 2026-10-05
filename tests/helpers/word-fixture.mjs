/**
 * Independent contracts and boundary values for compiled Lean platform integers.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const wordScalarSignatures = [
	{ name: "Words.keepUnsigned", parameters: ["usize"], result: "usize" }
	, { name: "Words.keepSigned", parameters: ["isize"], result: "isize" }
	, { name: "Words.unsignedText", parameters: ["usize"], result: "string" }
	, { name: "Words.signedText", parameters: ["isize"], result: "string" }
	, { name: "Words.advanceUnsigned", parameters: ["usize"], result: "usize" }
	, { name: "Words.advanceSigned", parameters: ["isize"], result: "isize" }
	, { name: "Words.wordBits", parameters: [], result: "uint32" }
];
const unsigned = { array: "usize" }, signed = { array: "isize" };
export const wordNativeSignatures = [...wordScalarSignatures
	, { name: "Words.keepUnsignedValues", parameters: [unsigned], result: unsigned }
	, { name: "Words.keepSignedValues", parameters: [signed], result: signed }
	, { name: "Words.keepUnsignedRows", parameters: [{ array: unsigned }], result: { array: unsigned } }
	, { name: "Words.keepSignedRows", parameters: [{ array: signed }], result: { array: signed } }
	, { name: "Words.keepSample", parameters: [{ record: "Words.Sample", fields: { natural: "usize", integer: "isize", unsignedValues: unsigned, signedValues: signed } }], result: { record: "Words.Sample", fields: { natural: "usize", integer: "isize", unsignedValues: unsigned, signedValues: signed } } }
];
/**
 * Independently reviewed scalar or copied API, not derived from compiler output.
 *
 * @param signatures - Explicit scalar or copied signatures.
 */
export const wordReviewedIr = (signatures = wordScalarSignatures) => corpusReviewedIr({ id: "words" }, signatures);
