/**
 * Extend the independent variant contract with both Buffers branches as inputs.
 *
 * @file
 */
import { nativeVariantReviewedIr, nativeVariantSignatures } from "./native-variant-fixture.mjs";

const buffers = { kind: "named", id: "lean:Variants.Buffers" };
const all = [...nativeVariantSignatures, { name: "Variants.echo_buffers", parameters: [buffers], result: buffers }];
const usesGmp = name => ["Variants.echo_scalars", "Variants.inspect", "Variants.produce"].includes(name);
/**
 * Retain only signatures admitted by the selected C dependency profile.
 *
 * @param gmp - Include the arbitrary-integer constructor payload.
 */
export const cVariantSignatures = (gmp = true) => all.filter(item => gmp || !usesGmp(item.name));

/**
 * Both empty and populated buffer constructors cross the installed C boundary.
 *
 * @param gmp - Include the arbitrary-integer constructor payload.
 */
export const cVariantReviewedIr = (gmp = true) => {
	const ir = nativeVariantReviewedIr(), fn = structuredClone(ir.declarations.find(item => item.name === "echo"));
	fn.name = "echo_buffers"; fn.id = "lean:Variants.echo_buffers"; fn.overloadKey = "Variants.echo_buffers";
	fn.source.declaration = "Variants.echo_buffers";
	fn.parameters[0].type = structuredClone(buffers); fn.result.type = structuredClone(buffers);
	ir.declarations.push(fn);
	if(!gmp)
	{
		ir.declarations = ir.declarations.filter(item => !usesGmp(item.source.declaration));
		ir.types = ir.types.filter(type => type.name !== "Scalars");
	}
	return ir;
};
