/**
 * Independent reviewed API for the FinProductArrays Lean fixture (VO #1441). Both exports carry
 * the array-of-product tree; the reversed result is documented only, since Lean produces it.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

/** Describe checked array-of-product decisions before Lean extraction. */
export const finProductArrayReviewedIr = () => {
	const fin = bound => ({ kind: "fin", bound });
	// Except trees keep the IR order: [ok, error].
	const rows = { array: { tuple: ["nat", { result: ["nat", "nat"] }] } };
	const bounds = () => ({ kind: "array", arguments: [{ kind: "tuple", arguments: [fin("4"), { kind: "result", arguments: [null, fin("6")] }] }] });
	const signatures = [["reversed", rows, { parameters: [bounds()], result: bounds() }], ["rows", "nat", { parameters: [bounds()], result: null }]];
	const ir = corpusReviewedIr({ id: "finproductarrays" }, signatures.map(([name, result]) => ({ name: `FinProductArrays.${name}`, parameters: [rows], result })));
	for(const declaration of ir.declarations)
	{
		// Keep the public argument labels shared with the ordinary-source consumers.
		declaration.parameters.forEach((parameter, position) => { parameter.name = `arg${position}`; });
		declaration.source.extensions["lean-lang.org/refinements"] = signatures.find(([name]) => declaration.id === `lean:FinProductArrays.${name}`)[2];
	}
	return ir;
};
