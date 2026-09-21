/**
 * Preserve source type names without changing native copied-value converters.
 *
 * @file
 */
/**
 * Distinguish original contracts even when native representations coincide.
 *
 * @param ref - Original copied type reference.
 */
const key = ref => ref.kind === "primitive" ? `primitive:${ref.name}`
	: ref.kind === "named" ? `named:${ref.id}`
		: `${ref.constructor}(${ref.arguments.map(key).join(",")})`;

/**
 * Build a separate WIT type graph for original alias and nested field references.
 * Native indices and C spellings remain those of the resolved copied target.
 *
 * @param options - Admitted native copies and WIT name validation.
 * @param options.ir - Original Binding IR.
 * @param options.surface - Shared native copied representations.
 * @param options.admit - Collision-checking WIT identifier allocator.
 * @param options.admitAlias - Alias allocator preserving existing function names.
 * @param options.fail - Source-located admission diagnostic.
 */
export const compileCopiedWitAliases = ({ ir, surface, admit, admitAlias, fail }) => {
	const definitions = new Map(surface.aliases.map(alias => [alias.definition.id, alias.definition]));
	const aliases = [...definitions.values()].sort((a, b) => a.id.localeCompare(b.id));
	const names = new Map(aliases.map(alias => [alias.id, admitAlias(alias.name, ir.declarations[0])]));
	const values = new Map(), active = new Set(), types = [];
	let next = surface.copies.length;
	const visit = ref => {
		const id = key(ref);
		if(values.has(id)) return values.get(id);
		if(active.has(id)) fail(ir.declarations[0], "WIT copied aliases must be acyclic");
		active.add(id);
		const base = surface.copy(ref), alias = ref.kind === "named" && definitions.get(ref.id);
		let value;
		if(alias)
		{
			const target = visit(alias.target), witName = names.get(alias.id), witIndex = next++;
			value = { ...target, ref, aliasTarget: target, witName, wit: witName, witIndex, wat: `$t${witIndex}` };
		}
		else
		{
			const fields = base.fields.map((field, index) => ({ ...field
				, type: visit(base.record ? base.record.fields[index].type : ref.arguments[index]) }));
			const element = base.element ? visit(ref.arguments[0]) : null;
			value = { ...base, ref, fields, element };
			if(key(ref) !== key(base.ref))
			{
				const witIndex = next++, witName = admit(`bridge-alias-value-${witIndex}`, ir.declarations[0]);
				Object.assign(value, { witIndex, witName, wit: witName, wat: `$t${witIndex}` });
			}
		}
		active.delete(id); values.set(id, value);
		if(value.witName) types.push(value);
		return value;
	};
	for(const copy of surface.copies) visit(copy.ref);
	const declared = aliases.map(alias => ({ ...alias, projection: visit({ kind: "named", id: alias.id }) }));
	for(const declaration of ir.declarations) for(const site of [...declaration.parameters, declaration.result])
		if(!surface.callbacks.has(site.type.id)) visit(site.type);
	return { types, copy: visit, nextIndex: next
		, aliases: declared.map(({ id, name, target, projection }) => ({ id, name, target, witName: projection.witName, witTarget: projection.aliasTarget.wit })) };
};

/**
 * Explain named copied contracts in a prepared archive without alias wrappers.
 *
 * @param model - Admitted WIT projection with source definitions.
 */
export const witAliasReadme = model => {
	if(!model.manifest.aliases?.length) return "";
	const contract = ref => ref.kind === "primitive" ? ref.name
		: ref.kind === "named" ? model.ir.types.find(type => type.id === ref.id).name
			: `${ref.constructor}<${ref.arguments.map(contract).join(", ")}>`;
	return `
## Copied Lean aliases

The WIT source and compiled component retain named aliases, their chains and original parameter, result and record-field references. binding-manifest.json records each Lean name and original target. Callers pass ordinary target values; aliases introduce no wrapper objects or resources. Conversion rules, independent result ownership and existing copy limits apply unchanged. USize and ISize use this native profile's 64-bit widths. Alias payloads inside callback signatures, native variants, recursive copied values and identity-bearing alias targets remain unsupported.

| Lean alias | Original target | WIT name |
| --- | --- | --- |
${model.manifest.aliases.map(alias => `| \`${alias.name}\` | \`${contract(alias.target)}\` | \`${alias.witName}\` |`).join("\n")}
`;
};
