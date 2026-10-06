/**
 * Document compiler-checked top-level Fin sites in generated Python packages.
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
export const pythonFinRefinements = declaration => {
	const value = declaration.source?.extensions?.["lean-lang.org/refinements"];
	if(value === undefined) return null;
	if(value === null || typeof value !== "object" || Array.isArray(value)
		|| JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(["parameters", "result"])
		|| !Array.isArray(value.parameters) || value.parameters.length !== declaration.parameters.length)
		throw new TypeError(`${declaration.id} has malformed refinement metadata`);
	value.parameters.forEach((refinement, index) => assertRefinement(refinement, declaration.parameters[index].type));
	assertRefinement(value.result, declaration.result.type);
	// Only scalar Fin reaches Python; any other constraint must fail rather than vanish from the docs.
	if([...value.parameters, value.result].some(refinement => refinement !== null && refinement.kind !== "fin"))
		throw new TypeError(`${declaration.id}: Python packages document only top-level Fin refinements`);
	return value;
};

/**
 * Summarize each checked bound for a docstring, stub or README line.
 *
 * @param declaration - Binding IR declaration.
 * @param names - Public Python parameter names, in declaration order.
 */
export const pythonFinSummary = (declaration, names) => {
	const value = pythonFinRefinements(declaration);
	if(!value) return null;
	const parts = value.parameters.flatMap((refinement, index) => refinement ? [`${names[index]} < ${refinement.bound}`] : []);
	if(value.result) parts.push(`result < ${value.result.bound}`);
	return parts.length ? parts.join("; ") : null;
};

/** Shared README contract for packages with at least one checked Fin site. */
export const pythonFinReadme = "\nLean Fin n parameters and results are exact Python int values below n. The bundled native library compares each argument with its exact bound, including bounds wider than 64 bits, before any Lean code runs. A Boolean or other non-int argument raises TypeError and a negative int raises ValueError, as for Nat; an int at or above its bound raises LeanBridgeError with status 1, naming the parameter and bound. Fin 0 has no values, so every call to a function taking one is rejected. Results are int values below their declared bound. Fin inside containers, records, variants, callbacks or reviewed Binding IR is not supported in Python packages.\n";
