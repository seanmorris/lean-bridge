/**
 * Independent variant contracts with distinct native type and function names.
 *
 * @file
 */
import { variantReviewedIr, variantSignatures } from "./variant-fixture.mjs";

const renamed = new Set(["mode", "nested", "scalars", "anonymous", "one"]);
const name = value => value.replace(/Variants\.(\w+)$/, (_, short) => `Variants.${renamed.has(short) ? `echo_${short}` : short}`);
export const nativeVariantSignatures = variantSignatures.map(item => ({ ...item, name: name(item.name) }));

/** Retain every independent constructor and field contract. */
export const nativeVariantReviewedIr = () => {
	const ir = variantReviewedIr();
	for(const item of ir.declarations)
	{
		if(renamed.has(item.name)) item.name = `echo_${item.name}`;
		item.id = name(item.id); item.overloadKey = name(item.overloadKey);
		item.source.declaration = name(item.source.declaration);
	}
	return ir;
};
