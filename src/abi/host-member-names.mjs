/** @file Stable names shared by authored Lean host imports and their target runtime. */
/**
 * Length-prefix a class name so two callback signatures cannot collide even
 * if the authored identifier contains the signature's "_to_" separator.
 *
 * @param name - Authenticated class name from the selected import contract.
 */
export const callbackHostName=name=>"host"+name.length+"_"+name;
/**
 * Capitalize the components of a generated Lean identifier.
 *
 * @param value - Authored target or member name.
 */
export const hostPascalName = value => value.replace(/(^|[^A-Za-z0-9]+)([A-Za-z0-9])/g, (_, __, letter) => letter.toUpperCase());
const snake = value => value
  .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
  .replace(/[^A-Za-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .toLowerCase();

/**
 * Resolve a member's Lean name, distinguishing property reads and writes.
 *
 * @param declaration - Host declaration, including property read/write arity.
 */
export const hostDeclarationName = declaration => declaration.kind === "property"
	? `${declaration.parameters.length === 0 ? "get" : "set"}${hostPascalName(declaration.name)}`
	: declaration.name;

/**
 * Resolve the same external name on the Lean importer and runtime provider.
 *
 * @param target - Host language.
 * @param type - Nominal resource declaration.
 * @param declaration - Operation whose kind distinguishes reads and writes.
 */
export const hostMemberSymbol = (target, type, declaration) =>
	`lean_bridge_host_${snake(target)}_${snake(type.name)}_${snake(hostDeclarationName(declaration))}`;
