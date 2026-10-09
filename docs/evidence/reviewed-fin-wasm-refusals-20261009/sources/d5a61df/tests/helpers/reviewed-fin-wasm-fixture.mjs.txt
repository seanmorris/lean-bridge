/**
 * Independent scalar and structural reviewed contracts for installed Wasm Fin checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

const fin = bound => ({ kind: "fin", bound });
const unary = (kind, value) => ({ kind, arguments: [value] });
const binary = (kind, first, second) => ({ kind, arguments: [first, second] });
export const reviewedFinWasmSelections = Object.freeze(["scalar", "structural"]);
export const reviewedFinWasmWide = "184467440737095516170";
const nestedType = { list: { option: { tuple: ["nat", { result: ["nat", "nat"] }] } } };
const nestedRefinement = unary("list", unary("option", binary("tuple", fin("3"), binary("result", fin("5"), fin("2")))));
const rowRefinement = unary("array", unary("array", fin("10")));
const emptyRefinement = unary("array", fin("0"));
const scalar = [
	["mirror", ["nat"], "nat", [fin("10")], fin("10")]
	, ["never", ["nat"], "nat", [fin("0")], null]
	, ["only", ["nat"], "nat", [fin("1")], null]
	, ["huge", ["nat"], "nat", [fin(reviewedFinWasmWide)], fin(reviewedFinWasmWide)]
	, ["tenth", ["nat"], "nat", [null], fin("10")]
	, ["label", ["string", "nat", "string"], "string", [null, fin("10"), null], null]];
const structural = [
	["rows", [{ array: { array: "nat" } }], { array: { array: "nat" } }
		, [rowRefinement], rowRefinement]
	, ["empty", [{ array: "nat" }], { array: "nat" }
		, [emptyRefinement], emptyRefinement]
	, ["nested", [nestedType], nestedType, [nestedRefinement], nestedRefinement]];

/**
 * Author the expected transport and bounds before invoking the compiler.
 *
 * @param selection - Scalar private ABI alone, or scalar plus structural exports.
 */
export const reviewedFinWasmIr = selection => {
	assert.ok(reviewedFinWasmSelections.includes(selection), "Unknown reviewed Wasm Fin selection");
	const signatures = selection === "scalar" ? scalar : [...scalar, ...structural];
	const document = corpusReviewedIr({ id: "reviewed-fin" }, signatures.map(([name, parameters, result]) => ({
		name: `ReviewedFin.${name}`, parameters, result
	})));
	for(const [index, declaration] of document.declarations.entries())
	{
		declaration.parameters.forEach((parameter, position) => { parameter.name = `arg${position}`; });
		const [, , , parameters, result] = signatures[index];
		declaration.source.extensions["lean-lang.org/refinements"] = structuredClone({ parameters, result });
	}
	return document;
};
