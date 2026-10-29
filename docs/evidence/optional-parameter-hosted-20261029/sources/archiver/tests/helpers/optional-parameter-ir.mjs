/**
 * Independently reviewed optional-parameter fixture shared by target tests.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

/** Build the independent primitive and Option default corpus. */
export const optionalParameterIr = () => {
	const signatures = [
		{ name: "Defaults.word", parameters: ["uint32"], result: "uint32" }
		, { name: "Defaults.natural", parameters: ["nat"], result: "nat" }
		, { name: "Defaults.text", parameters: ["string"], result: "string" }
		, { name: "Defaults.character", parameters: ["char"], result: "char" }
		, { name: "Defaults.maybe", parameters: [{ option: "uint32" }], result: { option: "uint32" } }
		, { name: "Defaults.present", parameters: [{ option: "uint32" }], result: { option: "uint32" } }
		, { name: "Defaults.unitValue", parameters: ["unit"], result: "unit" }
	];
	const ir = corpusReviewedIr({ id: "defaults" }, signatures);
	const defaults = [
		{ kind: "integer", value: "7" }
		, { kind: "integer", value: "184467440737095516160" }
		, { kind: "string", value: "Lean\nBridge" }
		, { kind: "char", value: "λ" }
		, { kind: "option-none" }
		, { kind: "option-some", value: { kind: "integer", value: "9" } }
		, { kind: "unit" }
	];
	for(const [index, declaration] of ir.declarations.entries())
	{
		declaration.parameters[0].optional = true;
		declaration.parameters[0].default = defaults[index];
	}
	return ir;
};
