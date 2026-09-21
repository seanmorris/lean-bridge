/**
 * Source-authenticated compound API, including the declared Deep alias.
 * Historical ABI 6 contracts retain their expanded signatures separately.
 *
 * @file
 */
import { compoundReviewedIr as expandedContract } from "./compound-fixture.mjs";
export { compoundSignatures } from "./compound-fixture.mjs";

/** Preserve the source alias when authenticating newly compiled packages. */
export const compoundReviewedIr = () => {
	const ir = expandedContract(), declaration = ir.declarations.find(item => item.name === "deep");
	const type = { ...structuredClone(ir.types[0])
		, id: "lean:Compounds.Deep", name: "Deep", kind: "alias"
		, fields: [], target: declaration.result.type
		, source: { producer: "corpusReview", declaration: "Compounds.Deep", extensions: {} } };
	declaration.parameters[0].type = { kind: "named", id: type.id };
	declaration.result.type = { kind: "named", id: type.id };
	ir.types.push(type); ir.types.sort((left, right) => left.id.localeCompare(right.id));
	return ir;
};
