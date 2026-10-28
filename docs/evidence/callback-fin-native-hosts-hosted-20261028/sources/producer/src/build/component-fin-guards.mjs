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
 * @param members - Collection membership binders needed by recursive termination proofs.
 */
export const componentFinGuard = (tree, value, depth = 0, cycles = new Map(), members = null) => {
	if(!hasFin(tree, cycles)) return "true";
	const input = `(${value})`, name = `_bridgeFinValue${depth}`;
	if(tree.kind === "fin") return `(decide (${input} < ${tree.bound}))`;
	if(tree.kind === "recursive") return `(LbErased.${tree.definition}.validFin ${input})`;
	if(["record", "variant", "checked-record"].includes(tree.kind)) return `(LbErased.${tree.definition}.validFin ${input})`;
	const child = (index, expression) => componentFinGuard(tree.arguments[index], expression, depth + 1, cycles, members);
	if(["array", "list"].includes(tree.kind))
	{
		members?.add(`${tree.kind}:${depth}`);
		return `(${input}.attach.all (fun ⟨${name}, _bridgeFinMember${depth}⟩ => ${child(0, name)}))`;
	}
	if(tree.kind === "option") return `(match ${input} with | _root_.Option.none => true | _root_.Option.some ${name} => ${child(0, name)})`;
	if(tree.kind === "tuple")
	{
		const first = `_bridgeFinFirst${depth}`, second = `_bridgeFinSecond${depth}`;
		return `(match ${input} with | (${first}, ${second}) => ${conjunction([child(0, first), child(1, second)])})`;
	}
	return `(match ${input} with | _root_.Except.ok ${name} => ${child(0, name)} | _root_.Except.error ${name} => ${child(1, name)})`;
};

const termination = members => ["termination_by sizeOf value"
	, "decreasing_by"
	, "  all_goals"
	, "    try simp_all"
	, ...[...members].sort((left, right) => {
		const [leftKind, leftDepth] = left.split(":"), [rightKind, rightDepth] = right.split(":");
		return Number(leftDepth) - Number(rightDepth) || leftKind.localeCompare(rightKind);
	}).map(item => {
		const [kind, depth] = item.split(":");
		const type = kind === "array" ? "Array" : "List";
		return `    try have _bridgeFin${type}${depth} := _root_.${type}.sizeOf_lt_of_mem _bridgeFinMember${depth}`;
	})
	, "    try simp_all", "    try omega"];

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
		if(!hasFin(tree, cycles)) return null;
		const members = new Set();
		const name = `LbErased.${type.lean}`, header = `def ${name}.validFin (value : ${name}) : _root_.Bool :=`;
		if(type.kind === "record")
		{
			if(!recursiveRecord) return { members
				, lines: [header
					, `  ${conjunction(type.fields.map((field, index) => componentFinGuard(tree.arguments[index], `value.«${field.name}»`, 0, cycles, members)))}`] };
			const names = type.fields.map((_, position) => `_bridgeFinField${position}`);
			const checks = tree.arguments.map((child, position) => componentFinGuard(child, names[position], 0, cycles, members));
			return { members, lines: [header, "  match value with", `  | ⟨${names.join(", ")}⟩ => ${conjunction(checks)}`] };
		}
		return { members
			, lines: [header, "  match value with"
				, ...type.cases.map((branch, index) => {
					const names = branch.fields.map((_, position) => `_bridgeFinField${position}`);
					const checks = tree.cases[index].arguments.map((child, position) => componentFinGuard(child, names[position], 0, cycles, members));
					return `  | .«${branch.name}» ${names.join(" ")} => ${conjunction(checks)}`;
				})
			]
		};
	};
	const finish = (definition, wellFounded) => [...definition.lines
		, ...(wellFounded ? termination(definition.members) : []), ""];
	for(const type of types)
	{
		const group = mutualByName.get(type.lean);
		if(!group)
		{
			const recursive = Boolean(trees.get(`lean:${type.lean}`)?.cycle), definition = render(type, recursive);
			if(definition) lines.push(...finish(definition, recursive && definition.members.size > 0));
			continue;
		}
		const identity = group.join("\0");
		if(emitted.has(identity)) continue;
		emitted.add(identity);
		const definitions = group.map(name => render(typeByName.get(name), true)).filter(Boolean);
		const wellFounded = definitions.some(definition => definition.members.size > 0);
		if(definitions.length) lines.push("mutual", ...definitions.flatMap(definition => finish(definition, wellFounded)), "end", "");
	}
	return lines;
};
