/**
 * Preserve copied Lean alias contracts beside ordinary PHP target values.
 *
 * @file
 */

/**
 * Render an original contract reference without flattening its alias chain.
 *
 * @param model - Admitted PHP projection.
 * @param ref - Original IR type reference.
 */
const contractType = (model, ref) => ref.kind === "primitive" ? ref.name
	: ref.kind === "named" ? model.ir.types.find(type => type.id === ref.id).name
		: `${ref.constructor}<${ref.arguments.map(argument => contractType(model, argument)).join(", ")}>`;
const comment = value => value.replace(/[\r\n]/g, " ").replaceAll("*/", "* /").replaceAll("?>", "? >");
const cell = value => comment(value).replaceAll("|", "\\|").replaceAll("`", "&#96;");

/**
 * Retain original names and unflattened targets with their PHP representations.
 *
 * @param model - Admitted copied PHP projection with explicit integer widths.
 */
export const phpCopiedAliases = model => model.surface.aliases.map(({ definition, copy }) => ({
	id: definition.id, name: definition.name, target: definition.target
	, phpType: copy.docType
}));

/**
 * Document names without creating PHP alias classes or changing PHPDoc types.
 *
 * @param model - Admitted copied PHP projection.
 */
export const phpAliasCatalogDocs = model => !model.surface.aliases.length ? "" : `/**
 * Copied Lean aliases use the PHP target values, without wrapper classes.
${phpCopiedAliases(model).map(alias => ` * ${comment(alias.name)} = ${comment(contractType(model, alias.target))}; PHP: ${comment(alias.phpType)}`).join("\n")}
 */
`;

/**
 * Render a source contract alongside an existing PHPDoc type annotation.
 *
 * @param model - Admitted copied PHP projection.
 * @param ref - Original, unflattened IR type reference.
 */
export const phpAliasContract = (model, ref) => comment(contractType(model, ref));

/**
 * Describe transparent aliases in the installed native Composer archive.
 *
 * @param model - Admitted copied PHP projection.
 */
export const phpAliasReadme = model => !model.surface.aliases.length ? "" : `
## Copied Lean aliases

Pass ordinary PHP target values. The binding manifest and installed public source retain alias names, original targets and chains. PHPDoc keeps the PHP target type; lean-bridge annotations record the original Lean contract at parameters, results and record fields. Aliases create no PHP wrapper classes or runtime type aliases. Nat requires a nonnegative Brick\\Math\\BigInteger, Unit uses null and Char requires one Unicode scalar. Weak and strict callers receive the same target checks. Copied values keep independent storage, the existing copy budgets and the 32-level type-depth bound. Recursive copied types, compound callable payloads and identity-bearing alias targets remain unsupported.

| Lean alias | Contract target | PHP value |
| --- | --- | --- |
${phpCopiedAliases(model).map(alias => `| \`${cell(alias.name)}\` | \`${cell(contractType(model, alias.target))}\` | \`${cell(alias.phpType)}\` |`).join("\n")}
`;
