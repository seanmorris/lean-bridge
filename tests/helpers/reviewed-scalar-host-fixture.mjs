/**
 * Independent reviewed scalar Fin input using the existing host argument labels.
 *
 * @file
 */
import { nativeFinReviewedIr } from "./reviewed-fin-fixture.mjs";

/** Keep the original reviewed C fixture intact while naming host arguments. */
export const reviewedScalarHostIr = () => {
	const ir = nativeFinReviewedIr();
	for(const declaration of ir.declarations)
		declaration.parameters.forEach((parameter, index) => { parameter.name = `arg${index}`; });
	return ir;
};
