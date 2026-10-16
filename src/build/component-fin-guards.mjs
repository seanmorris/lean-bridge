/**
 * Fin-only guards for erased component values, before any selected Subtype constructor runs.
 *
 * @file
 */
/**
 * Find bounds without treating a Subtype constructor as a numeric range.
 *
 * @param tree - A normalized refinement tree, or null.
 * @param cycles - Finite recursive refinement targets.
 * @param seen - Backedge tokens already inspected.
 */
const hasFin = (tree, cycles = new Map(), seen = new Set()) => {
	if(tree?.kind === "fin") return true;
	if(tree?.kind === "recursive")
	{
		if(seen.has(tree.cycle)) return false;
		const target = cycles.get(tree.cycle);
		return target ? hasFin(target, cycles, new Set([...seen, tree.cycle])) : false;
	}
	return (tree?.arguments ?? []).some(child => hasFin(child, cycles, seen))
		|| (tree?.cases ?? []).some(branch => branch.arguments.some(child => hasFin(child, cycles, seen)));
};
const conjunction = checks => checks.filter(check => check !== "true").join(" && ") || "true";

/**
 * Check a complete erased tree's Fin bounds without constructing any proof-carrying source value.
 * Nominal helpers share the layout's bounds, independent of its per-use constructor selections.
 *
 * @param tree - Authenticated normalized refinement tree.
 * @param value - Lean expression for its erased transport value.
 * @param depth - Fresh binder suffix for nested structural containers.
 * @param cycles - Finite recursive refinement targets.
 */
export const componentFinGuard = (tree, value, depth = 0, cycles = new Map()) => {
	if(!hasFin(tree, cycles)) return "true";
	const input = `(${value})`, name = `_bridgeFinValue${depth}`;
	if(tree.kind === "fin") return `(decide (${input} < ${tree.bound}))`;
	if(tree.kind === "recursive") return `(LbErased.${tree.definition}.validFin ${input})`;
	if(["record", "variant", "checked-record"].includes(tree.kind)) return `(LbErased.${tree.definition}.validFin ${input})`;
	const child = (index, expression) => componentFinGuard(tree.arguments[index], expression, depth + 1, cycles);
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
 * @param cycles - Finite recursive refinement targets.
 * @param mutualGroups - Mutually recursive nominal definition names.
 */
export const componentNominalFinGuards = (types, trees, cycles = new Map(), mutualGroups = []) => {
	const typeByName = new Map(types.map(type => [type.lean, type]));
	const mutualByName = new Map(mutualGroups.flatMap(group => group.map(name => [name, group])));
	const emitted = new Set(), lines = [];
	const render = (type, recursiveRecord = false) => {
		const tree = trees.get(`lean:${type.lean}`);
		if(!hasFin(tree, cycles)) return [];
		const name = `LbErased.${type.lean}`, header = `def ${name}.validFin (value : ${name}) : _root_.Bool :=`;
		if(type.kind === "record")
		{
			if(!recursiveRecord) return [header
				, `  ${conjunction(type.fields.map((field, index) => componentFinGuard(tree.arguments[index], `value.«${field.name}»`, 0, cycles)))}`
				, ""];
			const names = type.fields.map((_, position) => `_bridgeFinField${position}`);
			const checks = tree.arguments.map((child, position) => componentFinGuard(child, names[position], 0, cycles));
			return [header, "  match value with", `  | ⟨${names.join(", ")}⟩ => ${conjunction(checks)}`, ""];
		}
		return [header, "  match value with"
			, ...type.cases.map((branch, index) => {
				const names = branch.fields.map((_, position) => `_bridgeFinField${position}`);
				const checks = tree.cases[index].arguments.map((child, position) => componentFinGuard(child, names[position], 0, cycles));
				return `  | .«${branch.name}» ${names.join(" ")} => ${conjunction(checks)}`;
			})
			, ""];
	};
	for(const type of types)
	{
		const group = mutualByName.get(type.lean);
		if(!group)
		{
			lines.push(...render(type, Boolean(trees.get(`lean:${type.lean}`)?.cycle)));
			continue;
		}
		const identity = group.join("\0");
		if(emitted.has(identity)) continue;
		emitted.add(identity);
		const definitions = group.map(name => render(typeByName.get(name), true)).filter(body => body.length > 0);
		if(definitions.length) lines.push("mutual", ...definitions.flat(), "end", "");
	}
	return lines;
};
