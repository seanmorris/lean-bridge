/**
 * Independent reviewed contract for the NativeFin Lean source fixture.
 * No compiler output or recorded observation is used to construct this input.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

/** Describe the source API, including bounds, before invoking Lean. */
export const nativeFinReviewedIr = () => {
	const signatures = [
		["impossible", ["nat"], "nat", ["0"], null]
		, ["label", ["nat", "nat", "string"], "string", [null, "4", null], null]
		, ["mirror", ["nat"], "nat", ["10"], "10"]
		, ["only", ["nat"], "nat", ["1"], null]
		, ["succHuge", ["nat"], "nat", ["1180591620717411303424"], "1180591620717411303424"]
		, ["twice", ["nat"], "nat", ["300"], null]
		, ["wrap", ["nat"], "nat", [null], "7"]];
	const ir = corpusReviewedIr({ id: "native-fin" }, signatures.map(([name, parameters, result]) => ({ name: `NativeFin.${name}`, parameters, result })));
	const fin = bound => bound === null ? null : { kind: "fin", bound };
	for(const [index, declaration] of ir.declarations.entries())
	{
		const [, , , parameters, result] = signatures[index];
		declaration.source.extensions["lean-lang.org/refinements"] = { parameters: parameters.map(fin), result: fin(result) };
	}
	return ir;
};
