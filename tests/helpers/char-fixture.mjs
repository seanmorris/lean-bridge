/**
 * Independent Unicode cases and reviewed signatures for the Char milestone.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const charPoints = Object.freeze([0, 0x41, 0x7f, 0x80, 0xe9, 0x301, 0x7ff, 0x800, 0xd7ff, 0xe000, 0xffff, 0x10000, 0x1f331, 0x10ffff]);
export const invalidChars = Object.freeze(["", "ab", "e\u0301", "☀️", "🇨🇦", "\ud800", "\udfff", "a\ud800", "\udfffa", "\udfff\ud800", 65, 65n, null, undefined, true, {}, ["a"]]);
export const invalidCharPoints = Object.freeze([0xd800n, 0xdbffn, 0xdc00n, 0xdfffn, 0x110000n, 0x100000041n, 0xffffffffffffffffn]);
export const charSignatures = Object.freeze([
	{ name: "Characters.echo", parameters: ["char"], result: "char" }
	, { name: "Characters.codePoint", parameters: ["char"], result: "uint32" }
	, { name: "Characters.text", parameters: ["char"], result: "string" }
	, { name: "Characters.sprout", parameters: [], result: "char" }
	, { name: "Characters.choose", parameters: ["bool", "char", "char"], result: "char" }
]);

/** Describe the API independently of the compiler's captured metadata. */
export const charReviewedIr = () => corpusReviewedIr({ id: "onboarding-characters" }, charSignatures);
