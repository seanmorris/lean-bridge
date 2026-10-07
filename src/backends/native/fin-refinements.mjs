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
	const supported = (refinement, top) => refinement === null || refinement.kind === "fin" || (top && refinement.kind === "subtype")
		|| (["array", "list", "option"].includes(refinement.kind) && refinement.arguments.length === 1 && supported(refinement.arguments[0], false));
	if(![...value.parameters, value.result].every(refinement => supported(refinement, true)))
		throw new TypeError(`${declaration.id}: native packages document only top-level Subtype and Fin refinements at top level or inside arrays, lists and options`);
	return value;
};

/**
 * Describe each bound inside a refinement with its path from the site:
 * `[*]` for every array or list element and `?` for a present option value.
 *
 * @param refinement - Validated refinement tree.
 * @param path - Site name followed by the path so far.
 */
export const nativeFinBoundPaths = (refinement, path) => {
	if(refinement === null) return [];
	if(refinement.kind === "subtype") return [`${path} checked by ${refinement.constructor}`];
	if(refinement.kind === "fin") return [`${path} < ${refinement.bound}`];
	return nativeFinBoundPaths(refinement.arguments[0], `${path}${refinement.kind === "option" ? "?" : "[*]"}`);
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

/**
 * README text for a package's checked sites: the host's Fin paragraph when any Fin
 * bound exists (byte for byte as before), and a Subtype paragraph when any export
 * carries an author-checked constructor.
 *
 * @param declarations - Binding IR declarations of the package's exports.
 * @param finParagraph - The host's Fin paragraph, including its container note.
 * @param packages - Host package noun, such as "Ruby gems".
 */
export const nativeRefinementReadme = (declarations, finParagraph, packages) => {
	const kinds = new Set();
	const walk = refinement => {
		if(refinement === null) return;
		if(refinement.kind === "fin" || refinement.kind === "subtype") kinds.add(refinement.kind);
		else refinement.arguments.forEach(walk);
	};
	for(const declaration of declarations)
	{
		const value = nativeFinRefinements(declaration);
		if(value) [...value.parameters, value.result].forEach(walk);
	}
	const parts = [];
	if(kinds.has("fin")) parts.push(finParagraph);
	if(kinds.has("subtype")) parts.push(`Lean Subtype parameters cross as their base value. The bundled native library runs the author's checked constructor, named below, before the export runs; a value the constructor rejects fails the call with the invalid-argument error naming the parameter and constructor, and the export receives the constructed value, which may differ from the input. Subtype results are the base value. Subtype inside containers, records, variants, callbacks or reviewed Binding IR is not supported in ${packages}.`);
	return parts.join("\n\n");
};
