/**
 * Independent Ruby variant contract with a source-authenticated inspector name.
 *
 * @file
 */
import { cVariantReviewedIr, cVariantSignatures } from "./c-variant-fixture.mjs";

const name = value => value.replace(/Variants\.inspect$/, "Variants.inspect_scalars");
export const rubyVariantSignatures = cVariantSignatures().map(item => ({ ...item, name: name(item.name) }));

/** Keep every constructor and payload, selecting only the explicit Ruby wrapper. */
export const rubyVariantReviewedIr = () => {
	const ir = cVariantReviewedIr(), entry = ir.declarations.find(item => item.name === "inspect");
	entry.name = "inspect_scalars"; entry.id = name(entry.id); entry.overloadKey = name(entry.overloadKey);
	entry.source.declaration = name(entry.source.declaration);
	return ir;
};
