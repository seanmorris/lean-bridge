/**
 * Independent reviewed scalar Fin input using the existing host argument labels.
 *
 * @file
 */
import { nativeFinReviewedIr } from "./reviewed-fin-fixture.mjs";

/**
 * Keep the original reviewed C fixture intact while naming host arguments.
 *
 * @param componentName - Package identity; WIT uses an unhyphenated C prefix.
 */
export const reviewedScalarHostIr = (componentName = "native-fin") => {
	const ir = nativeFinReviewedIr();
	ir.component = { ...ir.component, id: `${componentName}@1.0.0`, name: componentName };
	for(const declaration of ir.declarations)
		declaration.parameters.forEach((parameter, index) => { parameter.name = `arg${index}`; });
	return ir;
};
