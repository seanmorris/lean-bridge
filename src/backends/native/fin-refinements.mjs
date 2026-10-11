/**
 * Document compiler-checked Fin bounds, Subtype constructors and checked-record
 * payloads in native host packages.
 *
 * @file
 */
import { assertRefinement } from "../../abi/refinements.mjs";

/**
 * Read exact refinements from compiler-checked declaration and type metadata.
 * Fin bounds are never inferred from the erased Nat transport type.
 *
 * @param declaration - Binding IR declaration.
 * @param types - Binding IR type definitions, to document record and variant fields.
 */
export const nativeFinRefinements = (declaration, types = []) => {
	const declared = declaration.source?.extensions?.["lean-lang.org/refinements"];
	const expanded = nativeFinExpansion(declaration, types);
	const checkedRecord = site => site.type.kind === "named" && types.some(type => type.id === site.type.id
		&& type.kind === "record" && type.source?.extensions?.["lean-lang.org/erased-proofs"] !== undefined);
	// Lean-produced records carry no input constructor, including result-only packages.
	const withResult = value => checkedRecord(declaration.result)
		? { parameters: value?.parameters ?? declaration.parameters.map(() => null)
			, result: { kind: "checked-record", constructor: null } } : value;
	if(declared === undefined)
	{
		if(declaration.parameters.some(checkedRecord))
			throw new TypeError(`${declaration.id}: a checked record parameter needs its selected constructor`);
		return withResult(expanded);
	}
	const value = declared;
	if(value === null || typeof value !== "object" || Array.isArray(value)
		|| JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(["parameters", "result"])
		|| !Array.isArray(value.parameters) || value.parameters.length !== declaration.parameters.length)
		throw new TypeError(`${declaration.id} has malformed refinement metadata`);
	value.parameters.forEach((refinement, index) => assertRefinement(refinement, declaration.parameters[index].type));
	assertRefinement(value.result, declaration.result.type);
	if(value.parameters.some((refinement, index) => (refinement?.kind === "checked-record") !== checkedRecord(declaration.parameters[index]))
		|| value.result?.kind === "checked-record")
		throw new TypeError(`${declaration.id}: checked records need an input constructor and proof-backed result projection`);
	// Fin and primitive Subtypes cross structural containers. Checked records remain
	// top-level sites; other constraints must fail rather than vanish from docs.
	const supported = (refinement, top) => refinement === null || ["fin", "subtype"].includes(refinement.kind) || (top && refinement.kind === "checked-record")
		|| (["array", "list", "option"].includes(refinement.kind) && refinement.arguments.length === 1 && supported(refinement.arguments[0], false))
		|| (["tuple", "result"].includes(refinement.kind) && refinement.arguments.length === 2 && refinement.arguments.every(child => supported(child, false)));
	if(![...value.parameters, value.result].every(refinement => supported(refinement, true)))
		throw new TypeError(`${declaration.id}: native packages document top-level checked records and Fin/Subtype refinements at top level or inside arrays, lists, options, products and results`);
	return withResult(expanded ?? value);
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
	if(refinement.kind === "checked-record") return [refinement.constructor === null
		? `${path} projects proof-backed record payload fields` : `${path} checked by ${refinement.constructor}`];
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
 * README sentence about container sites. Scalar bounds retain their short description;
 * packages with container bounds describe the paths.
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
	// Nominal fields need paths identifying the record member or active variant case.
	if(trees.some(nominal))
		return `Fin inside arrays, lists, options, products, Except values, records and variants is checked before Lean runs: every array or list element, a present option value, both product components, only the active Except branch, every record field and only the fields of the active variant case. An empty array, an absent option or an inactive branch or case is valid even for Fin 0. Bounds below list every element as name[*], a present option value as name?, product components as name.0 and name.1, the active branch as name.ok or name.error, a record field as name.field and a field of the active variant case as name.Case.field. Fin inside callbacks or generic record instantiations is not supported in ${packages}.`;
	const structural = trees.some(refinement => refinement !== null && refinement.kind !== "fin");
	const product = refinement => refinement !== null && refinement.arguments !== undefined
		&& (["tuple", "result"].includes(refinement.kind) || refinement.arguments.some(product));
	// Products check both components; results check only their active branch.
	if(trees.some(product))
		return `Fin inside arrays, lists, options, products and Except values is checked before Lean runs: every array or list element, a present option value, both product components and only the active Except branch. An empty array, an absent option or an inactive branch is valid even for Fin 0. Bounds below list every element as name[*], a present option value as name?, product components as name.0 and name.1, and the active branch as name.ok or name.error. Fin inside records, variants or callbacks is not supported in ${packages}.`;
	return structural
		? `Fin inside arrays, lists and options is checked element by element before Lean runs; an empty array or an absent option is valid even for Fin 0. Bounds below list every element as name[*] and a present option value as name?. Fin inside records, variants or callbacks is not supported in ${packages}.`
		: `Fin inside containers, records, variants or callbacks is not supported in ${packages}.`;
};

/**
 * README text for a package's checked sites: the supplied Fin paragraph, Subtype
 * constructors and proof-free checked-record inputs and results.
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
		if(["fin", "subtype", "checked-record"].includes(refinement.kind)) kinds.add(refinement.kind);
		else (refinement.kind === "variant" ? refinement.cases.flatMap(branch => branch.arguments) : refinement.arguments).forEach(walk);
	};
	for(const declaration of declarations)
	{
		const value = nativeFinRefinements(declaration, types);
		if(value) [...value.parameters, value.result].forEach(walk);
	}
	const parts = [];
	if(kinds.has("fin")) parts.push(finParagraph);
	if(kinds.has("subtype")) parts.push(`Lean Subtype parameters cross as their base value. The bundled native library runs the author's checked constructor, named below, before the export runs; a value the constructor rejects fails the call with the invalid-argument error naming the parameter and constructor, and the export receives the constructed value, which may differ from the input. Arrays, Lists, options, products and active result branches apply the same constructor checks to each Subtype leaf. Rejections identify the argument and nested element path. Subtype results are the base value. Reviewed APIs select the constructor and reconcile it with fresh Lean compilation. Subtype inside records, variants or callbacks is not supported in ${packages}.`);
	if(kinds.has("checked-record")) parts.push("Checked records cross as generated record values containing only their payload fields. The bundled native library validates each input through the selected Lean constructor before calling the export. A rejected record reports the parameter and constructor; a normalizing constructor changes the value received by Lean without changing the caller's record. Results project the payload fields of a record whose proofs Lean has already constructed. No proof object or input constructor is needed for a result-only export. Ordinary and reviewed APIs retain each parameter's constructor choice. Nested checked records, other dependent payloads and checked-record callbacks remain unsupported.");
	return parts.join("\n\n");
};
