/**
 * Retain copied Lean alias contracts beside ordinary Ruby values.
 *
 * @file
 */
/**
 * Render an original contract reference without flattening alias chains.
 *
 * @param model - Admitted Ruby projection.
 * @param ref - Original type reference.
 */
const contractType = (model, ref) => ref.kind === "primitive" ? ref.name
	: ref.kind === "named" ? model.ir.types.find(type => type.id === ref.id).name
		: `${ref.constructor}<${ref.arguments.map(argument => contractType(model, argument)).join(", ")}>`;
const rubyType = (model, copy) => copy.record || copy.variant ? `${model.namespace}::${copy.publicName}`
	: copy.compound === "option" ? `nil | Some<${rubyType(model, copy.fields[0].type)}>`
		: copy.compound === "result" ? `Ok<${rubyType(model, copy.fields[0].type)}> | Err<${rubyType(model, copy.fields[1].type)}>`
			: copy.compound === "tuple" ? `[${copy.fields.map(field => rubyType(model, field.type)).join(", ")}]`
				: copy.element ? `Array<${rubyType(model, copy.element)}>`
					: copy.scalarName === "unit" ? `${model.namespace}::UNIT`
						: copy.scalarName === "bool" ? "true | false"
							: ["float32", "float64"].includes(copy.scalarName) ? "Float"
								: ({ string: "UTF-8 String", bytes: "binary String", char: "single-scalar String" }[copy.scalarName] ?? "Integer");

/**
 * Preserve names, unflattened targets and consumer value representations.
 *
 * @param model - Admitted copied Ruby projection.
 */
export const rubyCopiedAliases = model => model.surface.aliases.map(({ definition, copy }) => ({
	id: definition.id, name: definition.name, target: definition.target
	, rubyType: rubyType(model, copy)
}));

/**
 * Document contract identities without adding Ruby wrapper classes or constants.
 *
 * @param model - Admitted copied Ruby projection.
 */
export const rubyAliasCatalogDocs = model => !model.surface.aliases.length ? "" : `    # Copied Lean aliases use their Ruby target values, not separate constants.
${rubyCopiedAliases(model).map(alias => `    # ${alias.name} = ${contractType(model, alias.target)}; Ruby: ${alias.rubyType}`).join("\n")}
`;

/**
 * Preserve original types at parameters, results and record fields.
 *
 * @param model - Admitted copied Ruby projection.
 * @param sites - Named parameter or record-field references.
 * @param result - Optional result reference.
 * @param indent - Source indentation.
 */
export const rubyAliasSiteDocs = (model, sites, result = null, indent = "    ") => !model.surface.aliases.length ? ""
	: [...sites.map(site => `${indent}# ${site.name}: ${contractType(model, site.type)}\n`)
		, ...result ? [`${indent}# Returns: ${contractType(model, result)}\n`] : []].join("");

/**
 * Explain alias names and target checks in the installed gem.
 *
 * @param model - Admitted copied Ruby projection.
 */
export const rubyAliasReadme = model => !model.surface.aliases.length ? "" : `
## Copied Lean aliases

Call with ordinary Ruby target values. Alias names, original targets and chains remain in the binding manifest and public Ruby source comments. They do not create Ruby constants, wrapper classes or RBS declarations. Parameters, results and record fields retain the target checks: Nat rejects negative Integer values; fixed-width and machine-word integers retain their range; Char requires one Unicode scalar. Unit is the generated UNIT singleton, not nil. Arrays, strings and record contents copy independently. The existing copy budgets, type-depth bound and ownership rules apply. Recursion, compound callable payloads and identity-bearing targets remain unsupported.

| Lean alias | Contract target | Ruby value |
| --- | --- | --- |
${rubyCopiedAliases(model).map(alias => `| \`${alias.name}\` | \`${contractType(model, alias.target)}\` | \`${alias.rubyType.replaceAll("|", "\\|")}\` |`).join("\n")}
`;
