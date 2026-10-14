/**
 * Fin-only guards for erased component values, before any selected Subtype constructor runs.
 *
 * @file
 */
/**
 * Find bounds without treating a Subtype constructor as a numeric range.
 *
 * @param tree - A normalized refinement tree, or null.
 */
const hasFin = tree => tree?.kind === "fin" || (tree?.arguments ?? []).some(hasFin)
	|| (tree?.cases ?? []).some(branch => branch.arguments.some(hasFin));
const conjunction = checks => checks.filter(check => check !== "true").join(" && ") || "true";

/**
 * Check a complete erased tree's Fin bounds without constructing any proof-carrying source value.
 * Nominal helpers share the layout's bounds, independent of its per-use constructor selections.
 *
 * @param tree - Authenticated normalized refinement tree.
 * @param value - Lean expression for its erased transport value.
 * @param depth - Fresh binder suffix for nested structural containers.
 */
export const componentFinGuard = (tree, value, depth = 0) => {
	if(!hasFin(tree)) return "true";
	const input = `(${value})`, name = `_bridgeFinValue${depth}`;
	if(tree.kind === "fin") return `(decide (${input} < ${tree.bound}))`;
	if(["record", "variant"].includes(tree.kind)) return `(LbErased.${tree.definition}.validFin ${input})`;
	const child = (index, expression) => componentFinGuard(tree.arguments[index], expression, depth + 1);
	if(["array", "list"].includes(tree.kind)) return `(${input}.all (fun ${name} => ${child(0, name)}))`;
	if(tree.kind === "option") return `(match ${input} with | _root_.Option.none => true | _root_.Option.some ${name} => ${child(0, name)})`;
	if(tree.kind === "tuple") return `(${conjunction([child(0, `${input}.fst`), child(1, `${input}.snd`)])})`;
	return `(match ${input} with | _root_.Except.ok ${name} => ${child(0, name)} | _root_.Except.error ${name} => ${child(1, name)})`;
};

/**
 * Emit Fin-only checks after mirrors exist, in their dependency order.
 * Empty containers and inactive cases perform no leaf checks; Subtype constructors are never called.
 *
 * @param types - Dependency-ordered normalized mirror definitions.
 * @param trees - Constructor-independent result trees keyed by their private lean: identities.
 */
export const componentNominalFinGuards = (types, trees) => types.flatMap(type => {
	const tree = trees.get(`lean:${type.lean}`);
	if(!hasFin(tree)) return [];
	const name = `LbErased.${type.lean}`;
	const header = `def ${name}.validFin (value : ${name}) : _root_.Bool :=`;
	if(type.kind === "record") return [header
		, `  ${conjunction(type.fields.map((field, index) => componentFinGuard(tree.arguments[index], `value.«${field.name}»`)))}`
		, ""];
	return [header, "  match value with"
		, ...type.cases.map((branch, index) => {
		const names = branch.fields.map((_, position) => `_bridgeFinField${position}`);
		const checks = tree.cases[index].arguments.map((child, position) => componentFinGuard(child, names[position]));
		return `  | .«${branch.name}» ${names.join(" ")} => ${conjunction(checks)}`;
		})
		, ""];
});
