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
	if(declared === undefined) return nativeFinExpansion(declaration, types);
	const value = declared;
	if(value === null || typeof value !== "object" || Array.isArray(value)
		|| JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(["parameters", "result"])
		|| !Array.isArray(value.parameters) || value.parameters.length !== declaration.parameters.length)
		throw new TypeError(`${declaration.id} has malformed refinement metadata`);
	value.parameters.forEach((refinement, index) => assertRefinement(refinement, declaration.parameters[index].type, 0, true, types));
	assertRefinement(value.result, declaration.result.type, 0, true, types, true);
	// Nominal Subtypes and checked records keep their per-use constructor decisions
	// separate from shared Fin bounds.
	const supported = refinement => refinement === null || ["fin", "subtype"].includes(refinement.kind)
		|| (refinement.kind === "checked-record" && (!Object.hasOwn(refinement, "fields")
			|| refinement.fields.every(field => supported(field.refinement))))
		|| (refinement.kind === "record" && refinement.fields.every(field => supported(field.refinement, false)))
		|| (refinement.kind === "variant" && refinement.cases.every(branch => branch.fields.every(field => supported(field.refinement, false))))
		|| (["array", "list", "option"].includes(refinement.kind) && refinement.arguments.length === 1 && supported(refinement.arguments[0], false))
		|| (["tuple", "result"].includes(refinement.kind) && refinement.arguments.length === 2 && refinement.arguments.every(child => supported(child, false)));
	if(![...value.parameters, value.result].every(supported))
		throw new TypeError(`${declaration.id}: native packages document checked records and Fin/Subtype refinements only along structural copied paths`);
	return nativeFinExpansion(declaration, types) ?? value;
};

/**
 * Add the bounds of records and variants with checked fields to a declaration's trees.
 * Shared definitions carry Fin bounds as lean-lang.org/nominal-refinements.
 * Per-use nominal trees retain each selected constructor and merge matching shared bounds.
 * Aliases resolve only when a site needs nominal paths.
 *
 * @param declaration - Binding IR declaration.
 * @param types - Binding IR type definitions of the same document.
 */
const nativeFinExpansion = (declaration, types) => {
	const definitions = new Map(types.map(type => [type.id, type]));
	const refined = type => type?.kind === "named" && ["record", "variant"].includes(definitions.get(type.id)?.kind)
		&& (definitions.get(type.id).source?.extensions?.["lean-lang.org/nominal-refinements"] !== undefined
			|| definitions.get(type.id).source?.extensions?.["lean-lang.org/erased-proofs"] !== undefined);
	const reaches = (type, seen = new Set()) => {
		if(refined(type)) return true;
		if(type?.kind === "apply") return type.arguments.some(child => reaches(child, seen));
		if(type?.kind !== "named" || seen.has(type.id)) return false;
		const definition = definitions.get(type.id), inner = new Set([...seen, type.id]);
		const children = definition?.kind === "alias" ? [definition.target]
			: definition?.kind === "record" ? definition.fields.map(field => field.type)
				: definition?.kind === "variant" ? definition.cases.flatMap(branch => branch.fields.map(field => field.type)) : [];
		return children.some(child => reaches(child, inner));
	};
	const sites = [...declaration.parameters.map(parameter => parameter.type), declaration.result.type];
	const declared = declaration.source?.extensions?.["lean-lang.org/refinements"];
	const nominalSite = tree => tree !== null && (["record", "variant", "checked-record"].includes(tree.kind)
		|| (tree.arguments ?? []).some(nominalSite));
	if(!sites.some(type => reaches(type)) && ![...declared?.parameters ?? [], declared?.result ?? null].some(nominalSite)) return null;
	const merge = (tree, shared) => {
		if(shared === null || shared === undefined) return tree;
		if(tree === null) return shared;
		if(tree.kind !== shared.kind || (tree.kind === "fin" && tree.bound !== shared.bound))
			throw new TypeError("Per-use refinement conflicts with shared nominal bounds");
		return tree.kind === "fin" ? tree : { ...tree, arguments: tree.arguments.map((child, index) => merge(child, shared.arguments[index])) };
	};
	const expand = (type, tree, seen = new Set(), produced = false, depth = 0) => {
		if(type?.kind === "named")
		{
			const definition = definitions.get(type.id);
			if(definition?.kind === "alias" && !seen.has(type.id)) return expand(definition.target, tree, new Set([...seen, type.id]), produced, depth);
			if(!["record", "variant"].includes(definition?.kind) || seen.has(type.id)) return tree;
			const inner = new Set([...seen, type.id]), nominal = definition.source?.extensions?.["lean-lang.org/nominal-refinements"];
			const names = fields => fields.map(field => field.name);
			if(definition.kind === "record")
			{
				const checked = definition.source?.extensions?.["lean-lang.org/erased-proofs"] !== undefined;
				if(checked)
				{
					const selected = tree?.kind === "checked-record", rich = selected && Object.hasOwn(tree, "fields");
					const generic = definition.source?.extensions?.["lean-lang.org/instantiation"] !== undefined;
					if(generic && depth !== 0)
						throw new TypeError(`${declaration.id}: nested generic checked records require another representation`);
					if(!produced && !selected) throw new TypeError(`${declaration.id}: a checked record parameter needs its selected constructor`);
					if(produced && selected && (!rich || tree.constructor !== null))
						throw new TypeError(`${declaration.id}: checked record results retain only projected field refinements`);
					const children = definition.fields.map((field, index) => expand(field.type,
						merge(rich ? tree.fields[index].refinement : null, nominal?.fields?.[index]), inner, produced, depth + 1));
					if(!produced && !rich && (depth !== 0 || children.some(Boolean)))
						throw new TypeError(`${declaration.id}: nested or field-refined checked records need an exact field selection`);
					if(!rich && depth === 0 && !children.some(Boolean))
						return { kind: "checked-record", constructor: produced ? null : tree.constructor };
					return {
						kind: "checked-record", definition: definition.source.declaration
						, constructor: produced ? null : tree.constructor
						, fields: names(definition.fields), arguments: children
					};
				}
				const children = definition.fields.map((field, index) => expand(field.type,
					merge(tree?.fields[index].refinement ?? null, nominal?.fields?.[index]), inner, produced, depth + 1));
				return children.every(child => child === null) ? tree : { kind: "record", definition: type.id, fields: names(definition.fields), arguments: children };
			}
			const branch = (item, index) => {
				const children = item.fields.map((field, position) => expand(field.type,
					merge(tree?.cases[index].fields[position].refinement ?? null, nominal?.cases?.[index]?.[position]), inner, produced, depth + 1));
				return { name: item.name, fields: names(item.fields), arguments: children };
			};
			const cases = definition.cases.map(branch);
			return cases.every(branch => branch.arguments.every(child => child === null)) ? tree : { kind: "variant", definition: type.id, cases };
		}
		if(type?.kind !== "apply" || !["array", "list", "option", "tuple", "result"].includes(type.constructor)) return tree;
		const children = type.arguments.map((child, index) => expand(child, tree?.arguments?.[index] ?? null, seen, produced, depth + 1));
		return children.every(child => child === null) ? null : { kind: type.constructor, arguments: children };
	};
	return { parameters: declaration.parameters.map((parameter, index) => expand(parameter.type, declared?.parameters[index] ?? null))
		, result: expand(declaration.result.type, declared?.result ?? null, new Set(), true) };
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
 * @param produced - Whether Lean produces this export result, rather than checking an input.
 */
export const nativeFinBoundPaths = (refinement, path, produced = false) => {
	if(refinement === null) return [];
	if(refinement.kind === "checked-record") return [
		refinement.constructor === null
			? `${path} projects proof-backed record payload fields`
			: `${path} checked by ${refinement.constructor}`
		, ...(refinement.arguments ?? []).flatMap((child, index) =>
			nativeFinBoundPaths(child, `${path}.${refinement.fields[index]}`, produced))
	];
	if(refinement.kind === "subtype") return [produced || refinement.constructor === null
		? `${path} projects the Subtype base value` : `${path} checked by ${refinement.constructor}`];
	if(refinement.kind === "fin") return [`${path} < ${refinement.bound}`];
	if(refinement.kind === "tuple") return refinement.arguments.flatMap((child, index) => nativeFinBoundPaths(child, `${path}.${index}`, produced));
	if(refinement.kind === "result") return refinement.arguments.flatMap((child, index) => nativeFinBoundPaths(child, `${path}.${index ? "error" : "ok"}`, produced));
	if(refinement.kind === "record") return refinement.arguments.flatMap((child, index) => nativeFinBoundPaths(child, `${path}.${refinement.fields[index]}`, produced));
	if(refinement.kind === "variant") return refinement.cases.flatMap(branch => branch.arguments.flatMap((child, index) => nativeFinBoundPaths(child, `${path}.${branch.name}.${branch.fields[index]}`, produced)));
	return nativeFinBoundPaths(refinement.arguments[0], `${path}${refinement.kind === "option" ? "?" : "[*]"}`, produced);
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
	parts.push(...nativeFinBoundPaths(value.result, "result", true));
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
	let nominalSubtype = false;
	const hasSubtype = tree => tree?.kind === "subtype" || (tree?.arguments ?? []).some(hasSubtype)
		|| (tree?.cases ?? []).some(branch => branch.arguments.some(hasSubtype));
	const walk = refinement => {
		if(refinement === null) return;
		if(["record", "variant", "checked-record"].includes(refinement.kind) && hasSubtype(refinement)) nominalSubtype = true;
		if(["fin", "subtype", "checked-record"].includes(refinement.kind)) kinds.add(refinement.kind);
		const children = refinement.kind === "variant" ? refinement.cases.flatMap(branch => branch.arguments)
			: refinement.arguments ?? [];
		children.forEach(walk);
	};
	for(const declaration of declarations)
	{
		const value = nativeFinRefinements(declaration, types);
		if(value) [...value.parameters, value.result].forEach(walk);
	}
	const parts = [];
	if(kinds.has("fin")) parts.push(finParagraph);
	if(kinds.has("subtype")) parts.push(`Lean Subtype parameters cross as their base value. The bundled native library runs the author's checked constructor, named below, before the export runs; a value the constructor rejects fails the call with the invalid-argument error naming the parameter and constructor, and the export receives the constructed value, which may differ from the input. Arrays, Lists, options, products and active result branches apply the same constructor checks to each Subtype leaf. Rejections identify the argument and nested element path. Subtype results are the base value. Reviewed APIs select the constructor and reconcile it with fresh Lean compilation. ${nominalSubtype ? "Copied plain records check each selected field; variants check only the active case. Repeated uses of one type retain their own constructor choices, and every Fin bound is checked before any constructor. Recursive, generic, owned and callback Subtype positions remain unsupported." : `Subtype inside records, variants or callbacks is not supported in ${packages}.`}`);
	if(kinds.has("checked-record")) parts.push("Checked records cross as generated record values containing only their payload fields. The bundled native library validates each input through the constructor selected for that exact occurrence before calling the export. Nested arrays, Lists, options, products, Except values, plain records and active variant cases retain their own checked-record constructors. Fin and Subtype payload fields run their checks before the outer record constructor. A rejection names the argument, nested path and failing constructor or bound. A normalizing constructor changes the copied value received by Lean without changing the caller's record. Results recursively project the payload fields and refined base values of records whose proofs Lean has already constructed. No proof object or input constructor is needed for a result-only export. Ordinary and reviewed APIs retain every per-occurrence constructor choice. A top-level closed generic checked record retains its compiler-authenticated type and value indices and may select Subtype constructors for payload fields. Generic checked records nested inside another value, Fin-refined fields inside a generic checked record, recursive, owned and callback checked-record positions remain unsupported.");
	return parts.join("\n\n");
};
