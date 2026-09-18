/**
 * Independent source contract and consumer cases for native Char packages.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { charPoints as scalarPoints } from "./char-fixture.mjs";
export { invalidCharPoints } from "./char-fixture.mjs";
export const charPoints = [...scalarPoints, 9, 10, 13];

const array = { array: "char" };
const label = { record: "Glyphs.Label", fields: { marker: "char", line: array } };
export const nativeCharSignatures = [
	{ name: "Glyphs.keep", parameters: ["char"], result: "char" }
	, { name: "Glyphs.point", parameters: ["char"], result: "uint32" }
	, { name: "Glyphs.text", parameters: ["char"], result: "string" }
	, { name: "Glyphs.sprout", parameters: [], result: "char" }
	, { name: "Glyphs.choose", parameters: ["bool", "char", "char"], result: "char" }
	, { name: "Glyphs.keepArray", parameters: [array], result: array }
	, { name: "Glyphs.keepLabel", parameters: [label], result: label }
	, { name: "Glyphs.keepRows", parameters: [{ array }], result: { array } }
];

/** Describe all tested exports independently of captured compiler metadata. */
export const nativeCharReviewedIr = () => corpusReviewedIr({ id: "glyphs" }, nativeCharSignatures);
