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
 * @param types - Binding IR type definitions, to document record and variant fields.
 */
export const nativeFinRefinements = (declaration, types = []) => {
	const declared = declaration.source?.extensions?.["lean-lang.org/refinements"];
	const expanded = nativeFinExpansion(declaration, types);
	if(declared === undefined) return expanded;
	const value = declared;
	if(value === null || typeof value !== "object" || Array.isArray(value)
		|| JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(["parameters", "result"])
		|| !Array.isArray(value.parameters) || value.parameters.length !== declaration.parameters.length)
		throw new TypeError(`${declaration.id} has malformed refinement metadata`);
	value.parameters.forEach((refinement, index) => assertRefinement(refinement, declaration.parameters[index].type));
	assertRefinement(value.result, declaration.result.type);
	// Checked records have generated mirror carriers only for C, C++ and npm packages so far.
	if([...value.parameters, value.result].some(refinement => refinement?.kind === "checked-record"))
		throw new TypeError(`${declaration.id}: checked records are implemented only for C, C++ and npm packages`);
	// Only Fin, alone or inside arrays, lists, options, products and results, reaches native
	// hosts; any other constraint must fail rather than vanish from the docs.
	const supported = (refinement, top) => refinement === null || refinement.kind === "fin" || (top && refinement.kind === "subtype")
		|| (["array", "list", "option"].includes(refinement.kind) && refinement.arguments.length === 1 && supported(refinement.arguments[0], false))
		|| (["tuple", "result"].includes(refinement.kind) && refinement.arguments.length === 2 && refinement.arguments.every(child => supported(child, false)));
	if(![...value.parameters, value.result].every(refinement => supported(refinement, true)))
		throw new TypeError(`${declaration.id}: native packages document only top-level Subtype and Fin refinements at top level or inside arrays, lists, options, products and results`);
	return expanded ?? value;
};

/**
 * Add the bounds of records and variants with checked fields to a declaration's trees.
 * Declaration trees stop at a nominal type; its definition carries the field bounds as
 * lean-lang.org/nominal-refinements. Aliases are not expanded, so packages without refined
 * records or variants document exactly what they did before.
 *
 * @param declaration - Binding IR declaration.
 * @param types - Binding IR type definitions of the same document.
 */
const nativeFinExpansion = (declaration, types) => {
	const definitions = new Map(types.map(type => [type.id, type]));
	const refined = type => type?.kind === "named" && ["record", "variant"].includes(definitions.get(type.id)?.kind)
		&& definitions.get(type.id).source?.extensions?.["lean-lang.org/nominal-refinements"] !== undefined;
	const reaches = (type, seen = new Set()) => refined(type) || (type?.kind === "apply" && type.arguments.some(child => reaches(child, seen)))
		|| (type?.kind === "named" && definitions.get(type.id)?.kind === "alias" && !seen.has(type.id) && reaches(definitions.get(type.id).target, new Set([...seen, type.id])));
	const sites = [...declaration.parameters.map(parameter => parameter.type), declaration.result.type];
	if(!sites.some(type => reaches(type))) return null;
	const expand = (type, tree, seen = new Set()) => {
		if(type?.kind === "named")
		{
			const definition = definitions.get(type.id);
			if(definition?.kind === "alias" && !seen.has(type.id)) return expand(definition.target, tree, new Set([...seen, type.id]));
			if(!refined(type) || seen.has(type.id)) return tree;
			const inner = new Set([...seen, type.id]), nominal = definition.source.extensions["lean-lang.org/nominal-refinements"];
			const names = fields => fields.map(field => field.name);
			if(definition.kind === "record")
			{
				const children = definition.fields.map((field, index) => expand(field.type, nominal.fields[index], inner));
				return { kind: "record", definition: type.id, fields: names(definition.fields), arguments: children };
			}
			const branch = (item, index) => {
				const children = item.fields.map((field, position) => expand(field.type, nominal.cases[index][position], inner));
				return { name: item.name, fields: names(item.fields), arguments: children };
			};
			return { kind: "variant", definition: type.id, cases: definition.cases.map(branch) };
		}
		if(type?.kind !== "apply" || !["array", "list", "option", "tuple", "result"].includes(type.constructor)) return tree;
		const children = type.arguments.map((child, index) => expand(child, tree?.arguments?.[index] ?? null, seen));
		return children.every(child => child === null) ? null : { kind: type.constructor, arguments: children };
	};
	const declared = declaration.source?.extensions?.["lean-lang.org/refinements"];
	return { parameters: declaration.parameters.map((parameter, index) => expand(parameter.type, declared?.parameters[index] ?? null))
		, result: expand(declaration.result.type, declared?.result ?? null) };
};

/**
 * Describe each bound inside a refinement with its path from the site:
 * `[*]` for every array or list element, `?` for a present option value,
 * `.0` and `.1` for product components, `.ok` and `.error` for the active
 * Except branch, `.field` for a record field and `.Case.field` for a field of
 * the active variant case.
 *
 * @param refinement - Validated refinement tree.
 * @param path - Site name followed by the path so far.
 */
export const nativeFinBoundPaths = (refinement, path) => {
	if(refinement === null) return [];
	if(refinement.kind === "subtype") return [`${path} checked by ${refinement.constructor}`];
	if(refinement.kind === "fin") return [`${path} < ${refinement.bound}`];
	if(refinement.kind === "tuple") return refinement.arguments.flatMap((child, index) => nativeFinBoundPaths(child, `${path}.${index}`));
	if(refinement.kind === "result") return refinement.arguments.flatMap((child, index) => nativeFinBoundPaths(child, `${path}.${index ? "error" : "ok"}`));
	if(refinement.kind === "record") return refinement.arguments.flatMap((child, index) => nativeFinBoundPaths(child, `${path}.${refinement.fields[index]}`));
	if(refinement.kind === "variant") return refinement.cases.flatMap(branch => branch.arguments.flatMap((child, index) => nativeFinBoundPaths(child, `${path}.${branch.name}.${branch.fields[index]}`)));
	return nativeFinBoundPaths(refinement.arguments[0], `${path}${refinement.kind === "option" ? "?" : "[*]"}`);
};

/**
 * Summarize each checked bound for generated documentation.
 *
 * @param declaration - Binding IR declaration.
 * @param names - Public host parameter names, in declaration order.
 * @param types - Binding IR type definitions, to document record and variant fields.
 */
export const nativeFinSummary = (declaration, names, types = []) => {
	const value = nativeFinRefinements(declaration, types);
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
 * @param types - Binding IR type definitions, to document record and variant fields.
 */
export const nativeFinContainerNote = (declarations, packages, types = []) => {
	const trees = declarations.flatMap(declaration => {
		const value = nativeFinRefinements(declaration, types);
		return value ? [...value.parameters, value.result] : [];
	});
	const nominal = refinement => refinement !== null && typeof refinement === "object"
		&& (["record", "variant"].includes(refinement.kind) || (refinement.arguments ?? []).some(nominal));
	// Packages without record or variant bounds keep their earlier sentences byte for byte.
	if(trees.some(nominal))
		return `Fin inside arrays, lists, options, products, Except values, records and variants is checked before Lean runs: every array or list element, a present option value, both product components, only the active Except branch, every record field and only the fields of the active variant case. An empty array, an absent option or an inactive branch or case is valid even for Fin 0. Bounds below list every element as name[*], a present option value as name?, product components as name.0 and name.1, the active branch as name.ok or name.error, a record field as name.field and a field of the active variant case as name.Case.field. Fin inside callbacks or generic record instantiations is not supported in ${packages}.`;
	const structural = trees.some(refinement => refinement !== null && refinement.kind !== "fin");
	const product = refinement => refinement !== null && refinement.arguments !== undefined
		&& (["tuple", "result"].includes(refinement.kind) || refinement.arguments.some(product));
	// Packages without product or result bounds keep their earlier sentences byte for byte.
	if(trees.some(product))
		return `Fin inside arrays, lists, options, products and Except values is checked before Lean runs: every array or list element, a present option value, both product components and only the active Except branch. An empty array, an absent option or an inactive branch is valid even for Fin 0. Bounds below list every element as name[*], a present option value as name?, product components as name.0 and name.1, and the active branch as name.ok or name.error. Fin inside records, variants or callbacks is not supported in ${packages}.`;
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
 * @param types - Binding IR type definitions, to document record and variant fields.
 */
export const nativeRefinementReadme = (declarations, finParagraph, packages, types = []) => {
	const kinds = new Set();
	const walk = refinement => {
		if(refinement === null) return;
		if(refinement.kind === "fin" || refinement.kind === "subtype") kinds.add(refinement.kind);
		else (refinement.kind === "variant" ? refinement.cases.flatMap(branch => branch.arguments) : refinement.arguments).forEach(walk);
	};
	for(const declaration of declarations)
	{
		const value = nativeFinRefinements(declaration, types);
		if(value) [...value.parameters, value.result].forEach(walk);
	}
	const parts = [];
	if(kinds.has("fin")) parts.push(finParagraph);
	if(kinds.has("subtype")) parts.push(`Lean Subtype parameters cross as their base value. The bundled native library runs the author's checked constructor, named below, before the export runs; a value the constructor rejects fails the call with the invalid-argument error naming the parameter and constructor, and the export receives the constructed value, which may differ from the input. Subtype results are the base value. Subtype inside containers, records, variants, callbacks or reviewed Binding IR is not supported in ${packages}.`);
	return parts.join("\n\n");
};
