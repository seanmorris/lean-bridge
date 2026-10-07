/**
 * Read compiler-checked Fin bounds, at top level and inside arrays, lists and
 * options, for native host documentation.
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
	// Only Fin, alone or inside arrays, lists and options, reaches native hosts; any
	// other constraint must fail rather than vanish from the docs.
	const supported = refinement => refinement === null || refinement.kind === "fin"
		|| (["array", "list", "option"].includes(refinement.kind) && refinement.arguments.length === 1 && supported(refinement.arguments[0]));
	if(![...value.parameters, value.result].every(supported))
		throw new TypeError(`${declaration.id}: native packages document only Fin refinements at top level or inside arrays, lists and options`);
	return value;
};

/**
 * Describe each bound inside a refinement with its path from the site:
 * `[*]` for every array or list element and `?` for a present option value.
 *
 * @param refinement - Validated refinement tree.
 * @param path - Site name followed by the path so far.
 */
export const nativeFinBoundPaths = (refinement, path) => refinement === null ? []
	: refinement.kind === "fin" ? [`${path} < ${refinement.bound}`]
		: nativeFinBoundPaths(refinement.arguments[0], `${path}${refinement.kind === "option" ? "?" : "[*]"}`);

/**
 * Summarize each checked bound for generated documentation.
 *
 * @param declaration - Binding IR declaration.
 * @param names - Public host parameter names, in declaration order.
 */
export const nativeFinSummary = (declaration, names) => {
	const value = nativeFinRefinements(declaration);
	if(!value) return null;
	const parts = value.parameters.flatMap((refinement, index) => nativeFinBoundPaths(refinement, names[index]));
	parts.push(...nativeFinBoundPaths(value.result, "result"));
	return parts.length ? parts.join("; ") : null;
};

/**
 * README sentence about container sites. Packages whose bounds are all scalar keep the
 * historical sentence byte for byte; packages with container bounds describe the paths.
 *
 * @param declarations - Binding IR declarations of the package's exports.
 * @param packages - Host package noun, such as "Ruby gems".
 */
export const nativeFinContainerNote = (declarations, packages) => {
	const structural = declarations.some(declaration => {
		const value = nativeFinRefinements(declaration);
		return value && [...value.parameters, value.result].some(refinement => refinement !== null && refinement.kind !== "fin");
	});
	return structural
		? `Fin inside arrays, lists and options is checked element by element before Lean runs; an empty array or an absent option is valid even for Fin 0. Bounds below list every element as name[*] and a present option value as name?. Fin inside records, variants, callbacks or reviewed Binding IR is not supported in ${packages}.`
		: `Fin inside containers, records, variants, callbacks or reviewed Binding IR is not supported in ${packages}.`;
};
