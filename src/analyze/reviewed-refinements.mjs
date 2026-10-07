/**
 * Validate authored Fin decisions before comparing them with compiler facts.
 *
 * @file
 */
import { assertRefinement, nominalRefinement } from "../abi/refinements.mjs";

// Run only after the shared validator has checked tree shape and depth.
const finOnly = refinement => {
	if(refinement === null || refinement.kind === "fin") return;
	if(refinement.kind === "subtype") throw new TypeError("Reviewed Subtype decisions require a checked constructor selection");
	refinement.arguments.forEach(finOnly);
};

/**
 * Admit only nonempty Fin trees matching a declaration's erased signature.
 * Bounds here express the requested API; fresh Lean metadata must match them.
 *
 * @param declaration - Reviewed function and its transport signature.
 * @param value - Authored parameter/result constraints.
 */
export const assertReviewedFin = (declaration, value) => {
	const fail = () => { throw new TypeError("Invalid reviewed Fin decision"); };
	if(!value || typeof value !== "object" || Array.isArray(value)
		|| Object.keys(value).length !== 2 || !Object.hasOwn(value, "parameters") || !Object.hasOwn(value, "result")
		|| !Array.isArray(value.parameters) || value.parameters.length !== declaration.parameters.length) fail();
	const check = (refinement, type) => {
		assertRefinement(refinement, type);
		finOnly(refinement);
	};
	for(const [index, refinement] of value.parameters.entries()) check(refinement, declaration.parameters[index].type);
	check(value.result, declaration.result.type);
	if(value.result === null && value.parameters.every(refinement => refinement === null)) fail();
};

/**
 * Preserve the bound when a transparent alias names a refined container.
 * Records and variants use assertReviewedFinNominal; callbacks keep their own gate.
 *
 * @param definition - Reviewed transparent alias.
 * @param value - Closed nominal-refinement extension for its target.
 */
export const assertReviewedFinAlias = (definition, value) => {
	if(definition.kind !== "alias") throw new TypeError("Expected a reviewed alias");
	const refinement = nominalRefinement(definition, value);
	if(refinement === null) throw new TypeError("Expected a reviewed alias refinement");
	finOnly(refinement.target);
};

/**
 * Admit authored field bounds of a record, or of each variant case, against the definition's
 * own shape. Fresh Lean metadata must still match them exactly.
 *
 * @param definition - Reviewed alias, record or variant.
 * @param value - Closed nominal-refinement extension for its fields.
 */
export const assertReviewedFinNominal = (definition, value) => {
	if(definition.kind === "alias") return assertReviewedFinAlias(definition, value);
	if(!["record", "variant"].includes(definition.kind)) throw new TypeError("Expected a reviewed alias, record or variant");
	const refinement = nominalRefinement(definition, value);
	if(refinement === null) throw new TypeError("Expected a reviewed field refinement");
	(definition.kind === "record" ? refinement.fields : refinement.cases.flat()).forEach(finOnly);
};
