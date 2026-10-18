/**
 * Validate authored refinement decisions before comparing them with compiler facts.
 *
 * @file
 */
import { assertRefinement, callbackDefinitionRefinement, nominalRefinement } from "../abi/refinements.mjs";

// Run only after the shared validator has checked tree shape and depth.
const finOnly = refinement => {
	if(refinement === null || refinement.kind === "fin") return;
	if(refinement.kind === "subtype") throw new TypeError("Reviewed Subtype decisions require a checked constructor selection");
	if(refinement.kind === "checked-record") throw new TypeError("Reviewed checked records cross only at top-level sites");
	if(refinement.kind === "record") return refinement.fields.forEach(field => finOnly(field.refinement));
	if(refinement.kind === "variant") return refinement.cases.forEach(branch => branch.fields.forEach(field => finOnly(field.refinement)));
	refinement.arguments.forEach(finOnly);
};

/**
 * Validate a callback's nonempty Fin trees against its erased signature.
 * Checked constructors are not available inside a callback contract.
 *
 * @param definition - Reviewed callback with an authored refinement extension.
 * @param types - Reviewed definitions for copied nominal Fin trees.
 */
export const assertReviewedFinCallback = (definition, types = []) => {
	if(definition.kind !== "callback") throw new TypeError("Expected a reviewed callback");
	const refinement = callbackDefinitionRefinement(definition, types);
	if(refinement === null) throw new TypeError("Expected a reviewed callback refinement");
	refinement.parameters.forEach(finOnly);
	finOnly(refinement.result);
};

/**
 * Match Fin and per-use Subtype decisions to a declaration's erased signature,
 * including copied plain records and variants. Fresh Lean metadata must match
 * every bound and checked constructor selected by the review.
 *
 * @param declaration - Reviewed function and its transport signature.
 * @param value - Authored parameter/result constraints.
 * @param types - Reviewed definitions for per-use record and variant choices.
 */
export const assertReviewedRefinements = (declaration, value, types = []) => {
	const fail = () => { throw new TypeError("Invalid reviewed refinement decision"); };
	if(!value || typeof value !== "object" || Array.isArray(value)
		|| Object.keys(value).length !== 2 || !Object.hasOwn(value, "parameters") || !Object.hasOwn(value, "result")
		|| !Array.isArray(value.parameters) || value.parameters.length !== declaration.parameters.length) fail();
	for(const [index, refinement] of value.parameters.entries()) assertRefinement(refinement, declaration.parameters[index].type, 0, true, types);
	assertRefinement(value.result, declaration.result.type, 0, true, types, true);
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
