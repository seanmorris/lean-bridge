/**
 * Read compiler-checked top-level Fin bounds for native host documentation.
 *
 * @file
 */
import { assertRefinement } from "../../abi/refinements.mjs";

/**
 * Read exact Fin bounds from the declaration's checked refinement extension.
 * Bounds are never inferred from the erased Nat transport type.
 *
 * @param declaration - Binding IR declaration.
 */
export const nativeFinRefinements = declaration => {
	const value = declaration.source?.extensions?.["lean-lang.org/refinements"];
	if(value === undefined) return null;
	if(value === null || typeof value !== "object" || Array.isArray(value)
		|| JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(["parameters", "result"])
		|| !Array.isArray(value.parameters) || value.parameters.length !== declaration.parameters.length)
		throw new TypeError(`${declaration.id} has malformed refinement metadata`);
	value.parameters.forEach((refinement, index) => assertRefinement(refinement, declaration.parameters[index].type));
	assertRefinement(value.result, declaration.result.type);
	// Only scalar Fin reaches native hosts; any other constraint must fail rather than vanish from the docs.
	if([...value.parameters, value.result].some(refinement => refinement !== null && refinement.kind !== "fin"))
		throw new TypeError(`${declaration.id}: native packages document only top-level Fin refinements`);
	return value;
};

/**
 * Summarize each checked bound for generated documentation.
 *
 * @param declaration - Binding IR declaration.
 * @param names - Public host parameter names, in declaration order.
 */
export const nativeFinSummary = (declaration, names) => {
	const value = nativeFinRefinements(declaration);
	if(!value) return null;
	const parts = value.parameters.flatMap((refinement, index) => refinement ? [`${names[index]} < ${refinement.bound}`] : []);
	if(value.result) parts.push(`result < ${value.result.bound}`);
	return parts.length ? parts.join("; ") : null;
};
