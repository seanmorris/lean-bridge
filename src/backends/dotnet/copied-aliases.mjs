/**
 * Retain copied Lean alias contracts in NuGet metadata and XML documentation.
 *
 * @file
 */
/**
 * Escape text for generated XML documentation.
 *
 * @param value - Contract text, never raw XML.
 */
const xml = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const contractType = (model, ref) => ref.kind === "primitive" ? ref.name
	: ref.kind === "named" ? model.ir.types.find(type => type.id === ref.id).name
		: `${ref.constructor}<${ref.arguments.map(argument => contractType(model, argument)).join(", ")}>`;

/**
 * Keep original target references, including alias chains, beside CLR spellings.
 *
 * @param model - Closed .NET copied-value projection.
 */
export const dotnetCopiedAliases = model => model.surface.aliases.map(({ definition, copy }) => ({
	id: definition.id, name: definition.name, target: definition.target
	, managedType: model.publicType(copy)
}));

/**
 * Document the aliases on Api, since source-local C# aliases cannot be exported.
 *
 * @param model - Closed .NET copied-value projection.
 */
export const dotnetAliasCatalogDocs = model => !model.surface.aliases.length ? "" : `/// <remarks>Copied Lean aliases use their CLR target values. The binding manifest preserves their contract identities.
/// <list type="table">
${dotnetCopiedAliases(model).map(alias => `/// <item><term><c>${xml(alias.name)}</c></term><description><c>${xml(contractType(model, alias.target))}</c> projects to <c>${xml(alias.managedType)}</c>.</description></item>`).join("\n")}
/// </list></remarks>
`;

/**
 * Preserve original contract types on parameters, record fields and results.
 *
 * @param model - Closed .NET copied-value projection.
 * @param parameters - Original type references paired with generated C# names.
 * @param result - Optional original return type reference.
 * @param returnsVoid - A Lean Unit result has no CLR return value.
 */
export const dotnetAliasSiteDocs = (model, parameters, result = null, returnsVoid = false) => {
	if(!model.surface.aliases.length) return "";
	const lines = parameters.map(site => `/// <param name="${xml(site.name)}">Contract type: <c>${xml(contractType(model, site.type))}</c>.</param>`);
	if(result) lines.push(returnsVoid
		? `/// <remarks>Result contract type: <c>${xml(contractType(model, result))}</c>. Unit results return void.</remarks>`
		: `/// <returns>Contract type: <c>${xml(contractType(model, result))}</c>.</returns>`);
	return lines.length ? `${lines.join("\n")}\n` : "";
};

/**
 * Explain transparent CLR values and list every named contract target.
 *
 * @param model - Closed .NET copied-value projection.
 */
export const dotnetAliasReadme = model => !model.surface.aliases.length ? "" : `
## Copied Lean aliases

C# using aliases are local to source files; a NuGet assembly cannot export them. Pass and receive the CLR target values below. Aliases add no wrapper or distinct runtime identity. Their names, original targets and chains remain in the installed binding manifest and XML API documentation. Alias parameters, return values and record fields keep their target validation: Nat still rejects negative BigInteger values, while Int accepts them. Unit results return void. Native variants, recursive values, identity-bearing targets and compound callable payloads remain unsupported.

| Lean alias | Contract target | C# value type |
| --- | --- | --- |
${dotnetCopiedAliases(model).map(alias => `| \`${alias.name}\` | \`${contractType(model, alias.target)}\` | \`${alias.managedType.replaceAll("global::", "")}\` |`).join("\n")}
`;
