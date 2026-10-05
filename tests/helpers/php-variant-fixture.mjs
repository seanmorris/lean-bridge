/**
 * Independent PHP variant contract with a source-authenticated echo name.
 *
 * @file
 */
import { cVariantReviewedIr, cVariantSignatures } from "./c-variant-fixture.mjs";

const name = value => value.replace(/Variants\.echo$/, "Variants.echo_signal");
export const phpVariantSignatures = cVariantSignatures().map(item => ({ ...item, name: name(item.name) }));

/** Preserve all constructors and payloads, selecting the explicit PHP wrapper. */
export const phpVariantReviewedIr = () => {
	const ir = cVariantReviewedIr(), entry = ir.declarations.find(item => item.name === "echo");
	entry.name = "echo_signal"; entry.id = name(entry.id); entry.overloadKey = name(entry.overloadKey);
	entry.source.declaration = name(entry.source.declaration);
	return ir;
};
