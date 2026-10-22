/**
 * Shared typed mirrors with per-use input checks and constructor-independent result erasure.
 * Callers authenticate and normalize layouts before rendering; no native object offsets are used.
 *
 * @file
 */
import { canonicalJson } from "../capsule/node.mjs";
import { checkedRecordVia, componentRefinementConversion, nominalRefinementCheck } from "./component-refinements.mjs";

const erasedMirror = lean => `LbErased.${lean}`;

/**
 * List a refinement tree's children: a callback keeps them as parameters and result, a variant
 * in its cases, and every other node as arguments.
 *
 * @param tree - Validated normalized refinement tree.
 */
const refinementChildren = tree => tree.kind === "variant" ? tree.cases.flatMap(branch => branch.arguments)
	: tree.kind === "callback" ? [...tree.parameters, tree.result] : tree.arguments ?? [];

/**
 * Detect projected checked-record children that intentionally have no input constructor.
 * Recursive refinement leaves are tokens rather than JavaScript backedges, so this walk is finite.
 *
 * @param tree - Validated normalized refinement tree.
 */
const containsConstructorlessCheckedRecord = tree => {
	if(!tree || typeof tree !== "object") return false;
	if(tree.kind === "checked-record" && tree.constructor === null) return true;
	return refinementChildren(tree).some(containsConstructorlessCheckedRecord);
};

/**
 * Index finite recursive refinement nodes by their deterministic backedge token.
 * Tokens are private generation facts; public Binding IR remains an acyclic JSON tree.
 *
 * @param model - Normalized mirror model.
 */
export const refinementCycleTrees = model => {
	const cycles = new Map();
	const walk = tree => {
		if(!tree || typeof tree !== "object") return;
		if(["record", "variant", "checked-record"].includes(tree.kind) && tree.cycle)
		{
			const existing = cycles.get(tree.cycle);
			if(existing && canonicalJson(existing) !== canonicalJson(tree))
				throw new TypeError(`Conflicting recursive refinement token: ${tree.cycle}`);
			cycles.set(tree.cycle, tree);
		}
		for(const child of refinementChildren(tree)) walk(child);
	};
	for(const item of model.exports) if(item.refinements)
		[...item.refinements.parameters, item.refinements.result].forEach(walk);
	return cycles;
};

/**
 * Collect the Lean names of records and variants whose fields carry refinements,
 * from every export's refinement trees, including those inside callbacks.
 *
 * @param model - Compiler-authenticated exports with normalized refinement trees.
 */
export const refinementMirrorNames = model => {
	const names = new Set();
	const walk = tree => {
		if(!tree || typeof tree !== "object") return;
		if(["record", "variant", "checked-record"].includes(tree.kind)) names.add(tree.definition);
		for(const child of refinementChildren(tree)) walk(child);
	};
	for(const item of model.exports) if(item.refinements) [...item.refinements.parameters, item.refinements.result].forEach(walk);
	return names;
};

/**
 * Define each erased mirror and its check and erase functions, children before parents.
 *
 * @param model - Compiler-authenticated normalized exports and dependency-ordered erased types.
 * @param mirrors - Lean names of the mirrored definitions.
 * @param renderType - Backend renderer for an erased payload type and the complete mirror set.
 * @param recordValue - Backend renderer for a checked source record and its ordered field values.
 */
export const renderRefinementMirrors = (model, mirrors, renderType, recordValue = (type, values) => `_root_.${type.constructor} ${values.join(" ")}`) => {
	const trees = new Map(), layouts = new Map(), checks = new Map(), constructors = new Map();
	const cycles = refinementCycleTrees(model);
	// Constructor choices change how a source value is built, never its payload layout or erasure.
	const layout = tree => {
		if(tree?.kind === "subtype") return { kind: "subtype" };
		if(tree?.kind === "checked-record")
		{
			if(!Object.hasOwn(tree, "arguments") || tree.arguments.every(child => child === null))
				return { kind: "checked-record", definition: tree.definition };
			return {
				kind: "checked-record", definition: tree.definition, fields: tree.fields
				, arguments: tree.arguments.map(layout)
			};
		}
		if(tree?.kind === "recursive") return { kind: "recursive", definition: tree.definition };
		if(tree?.kind === "variant")
		{
			const cases = tree.cases.map(branch => ({ name: branch.name
				, fields: branch.fields, arguments: branch.arguments.map(layout) }));
			return { kind: tree.kind, definition: tree.definition, cases };
		}
		if(tree?.kind === "record")
		{
			const arguments_ = tree.arguments.map(layout);
			return { kind: tree.kind, definition: tree.definition, fields: tree.fields, arguments: arguments_ };
		}
		return tree?.arguments ? { ...tree, arguments: tree.arguments.map(layout) } : tree;
	};
	const walk = (tree, checked) => {
		if(!tree || typeof tree !== "object") return;
		if(["record", "variant"].includes(tree.kind))
		{
			const key = canonicalJson(layout(tree));
			if(layouts.has(tree.definition) && layouts.get(tree.definition) !== key)
				throw new TypeError(`Conflicting nominal refinement layouts: ${tree.definition}`);
			layouts.set(tree.definition, key);
			if(!trees.has(tree.definition)) trees.set(tree.definition, tree);
			const name = nominalRefinementCheck(tree);
			// Keep existing Fin-only generated bytes. A projected checked-record child has no
			// input constructor by design, so an output-only parent can erase but cannot check.
			const canCheckProjectedTree = !containsConstructorlessCheckedRecord(tree);
			if(checked || (name === "check" && canCheckProjectedTree))
			{
				if(!checks.has(tree.definition)) checks.set(tree.definition, new Map());
				const selected = checks.get(tree.definition);
				if(selected.has(name) && canonicalJson(selected.get(name)) !== canonicalJson(tree))
					throw new TypeError(`Conflicting nominal checked conversions: ${tree.definition}.${name}`);
				selected.set(name, tree);
			}
		}
		if(tree.kind === "checked-record")
		{
			const key = canonicalJson(layout(tree));
			if(layouts.has(tree.definition) && layouts.get(tree.definition) !== key)
				throw new TypeError(`Conflicting checked-record refinement layouts: ${tree.definition}`);
			layouts.set(tree.definition, key);
			if(!trees.has(tree.definition) || Object.hasOwn(tree, "arguments")) trees.set(tree.definition, tree);
			if(checked && tree.constructor !== null)
			{
				if(!constructors.has(tree.definition)) constructors.set(tree.definition, new Map());
				const selected = constructors.get(tree.definition);
				const name = checkedRecordVia(tree.constructor, Object.hasOwn(tree, "arguments") ? tree : null);
				if(selected.has(name) && canonicalJson(selected.get(name)) !== canonicalJson(tree))
					throw new TypeError(`Conflicting checked-record conversion: ${tree.definition}.${name}`);
				selected.set(name, tree);
			}
		}
		// Callback arguments cross in the opposite direction; the callback result crosses back.
		if(tree.kind === "callback")
		{
			tree.parameters.forEach(child => walk(child, !checked));
			walk(tree.result, checked);
		}
		else for(const child of refinementChildren(tree)) walk(child, checked);
	};
	for(const item of model.exports) if(item.refinements)
	{
		item.refinements.parameters.forEach(tree => walk(tree, true));
		walk(item.refinements.result, false);
	}
	const recursive = (refinement, value, checked) => {
		const target = cycles.get(refinement.cycle);
		if(!target || target.definition !== refinement.definition)
			throw new TypeError(`Missing recursive refinement target: ${refinement.definition}`);
		const conversion = target.kind === "checked-record"
			? checkedRecordVia(target.constructor, target) : nominalRefinementCheck(target);
		return `(LbErased.${refinement.definition}.${checked ? conversion : "erase"} (${value}))`;
	};
	const convert = (refinement, value, checked) => componentRefinementConversion(refinement, value, checked, 0, recursive);
	const selectedChecks = type => [...checks.get(type.lean) ?? []].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
	const recursiveRecordFunctions = type => {
		const mirror = erasedMirror(type.lean), source = `_root_.${type.lean}`;
		const values = type.fields.map((_, index) => `a${index}`), pattern = `⟨${values.join(", ")}⟩`, result = [];
		for(const [name, selected] of selectedChecks(type))
			result.push(`def ${mirror}.${name} (value : ${mirror}) : _root_.Option ${source} :=`, "  match value with"
				, `  | ${pattern} => do`
				, ...type.fields.map((_, index) => `    let b${index} ← ${convert(selected.arguments[index], values[index], true)}`)
				, `    pure (${recordValue(type, type.fields.map((_, index) => `b${index}`))})`, "");
		result.push(`def ${mirror}.erase (value : ${source}) : ${mirror} :=`, "  match value with"
			, `  | ${pattern} => ${mirror}.mk ${type.fields.map((_, index) => convert(trees.get(type.lean).arguments[index], values[index], false)).join(" ")}`, "");
		return result;
	};
	const recursiveVariantFunctions = type => {
		const mirror = erasedMirror(type.lean), source = `_root_.${type.lean}`, tree = trees.get(type.lean), result = [];
		const pattern = branch => `.«${branch.name}» ${branch.fields.map((_, index) => `a${index}`).join(" ")}`;
		for(const [name, selected] of selectedChecks(type))
			result.push(`def ${mirror}.${name} (value : ${mirror}) : _root_.Option ${source} :=`, "  match value with"
				, ...type.cases.map((branch, index) => `  | ${pattern(branch)} => do ${branch.fields.map((_, position) => `let b${position} ← ${convert(selected.cases[index].arguments[position], `a${position}`, true)}; `).join("")}pure (_root_.${branch.constructor} ${branch.fields.map((_, position) => `b${position}`).join(" ")})`), "");
		result.push(`def ${mirror}.erase (value : ${source}) : ${mirror} :=`, "  match value with"
			, ...type.cases.map((branch, index) => `  | ${pattern(branch)} => ${mirror}.«${branch.name}» ${branch.fields.map((_, position) => convert(tree.cases[index].arguments[position], `a${position}`, false)).join(" ")}`), "");
		return result;
	};
	const recursiveCheckedRecordFunctions = type => {
		const mirror = erasedMirror(type.lean), source = `_root_.${type.lean}`;
		const values = type.fields.map((_, index) => `a${index}`);
		const mirrorPattern = `⟨${values.join(", ")}⟩`;
		const sourcePattern = `{ ${type.fields.map((field, index) => `«${field.name}» := a${index}`).join(", ")}, .. }`;
		const tree = trees.get(type.lean), result = [];
		result.push(`def ${mirror}.erase (value : ${source}) : ${mirror} :=`, "  match value with"
			, `  | ${sourcePattern} => ${mirror}.mk ${type.fields.map((_, index) =>
				convert(tree.arguments[index], values[index], false)).join(" ")}`, "");
		for(const [name, conversion] of [...constructors.get(type.lean) ?? []]
			.sort(([left], [right]) => left.localeCompare(right)))
			result.push(`def ${mirror}.${name} (value : ${mirror}) : _root_.Option ${source} :=`, "  match value with"
				, `  | ${mirrorPattern} => do`
				, ...type.fields.map((_, index) => `    let b${index} ← ${convert(conversion.arguments[index], values[index], true)}`)
				, `    _root_.${conversion.constructor} ${type.fields.map((_, index) => `b${index}`).join(" ")}`, "");
		return result;
	};
	const lines = [], done = new Set();
	const typeByName = new Map(model.types.map(type => [type.lean, type]));
	const mutualByName = new Map((model.mutualGroups ?? []).flatMap(group => group.map(name => [name, group])));
	const emittedMutual = new Set();
	for(const type of model.types)
	{
		if(!["record", "variant"].includes(type.kind) || !mirrors.has(type.lean) || done.has(type.lean)) continue;
		const group = mutualByName.get(type.lean);
		if(group)
		{
			const identity = group.join("\0");
			if(emittedMutual.has(identity)) continue;
			emittedMutual.add(identity);
			const members = group.map(name => typeByName.get(name));
			if(members.some(member => !member))
				throw new TypeError("Mutually recursive mirrors require every nominal definition");
			members.forEach(member => done.add(member.lean));
			lines.push("mutual");
			for(const member of members)
			{
				const mirror = erasedMirror(member.lean);
				if(member.kind === "record") lines.push(`structure ${mirror} where`
					, ...member.fields.map(field => `  «${field.name}» : ${renderType(field.type, mirrors)}`));
				else lines.push(`inductive ${mirror} where`
					, ...member.cases.map(branch => `  | «${branch.name}» ${branch.fields.map((field, index) => `(a${index} : ${renderType(field.type, mirrors)})`).join(" ")} : ${mirror}`));
			}
			lines.push("end", "", "mutual");
			for(const member of members) lines.push(...(member.kind === "record"
				? Object.hasOwn(member, "erased") ? recursiveCheckedRecordFunctions(member) : recursiveRecordFunctions(member)
				: recursiveVariantFunctions(member)));
			lines.push("end", "");
			continue;
		}
		done.add(type.lean);
		const mirror = erasedMirror(type.lean), tree = trees.get(type.lean), source = `_root_.${type.lean}`;
		// A checked record's mirror holds only its payload. Lean-produced values are projected to it;
		// each site's constructor alone builds the source value back from it, so no carrier can.
		if(type.kind === "record" && Object.hasOwn(type, "erased"))
		{
			const selected = trees.get(type.lean), rich = Object.hasOwn(selected ?? {}, "arguments");
			lines.push(`structure ${mirror} where`, ...type.fields.map(field => `  «${field.name}» : ${renderType(field.type, mirrors)}`), "");
			if(selected?.cycle)
			{
				lines.push(...recursiveCheckedRecordFunctions(type));
				continue;
			}
			lines.push(`def ${mirror}.erase (value : ${source}) : ${mirror} :=`
				, `  ${mirror}.mk ${type.fields.map((field, index) => rich
					? convert(selected.arguments[index], `value.«${field.name}»`, false) : `value.«${field.name}»`).join(" ")}`, "");
			for(const [name, conversion] of [...constructors.get(type.lean) ?? []].sort(([left], [right]) => left.localeCompare(right)))
			{
				if(!Object.hasOwn(conversion, "arguments"))
				{
					lines.push(`def ${mirror}.${name} (value : ${mirror}) : _root_.Option ${source} :=`
						, `  _root_.${conversion.constructor} ${type.fields.map(field => `value.«${field.name}»`).join(" ")}`, "");
					continue;
				}
				lines.push(`def ${mirror}.${name} (value : ${mirror}) : _root_.Option ${source} := do`
					, ...type.fields.map((field, index) => `  let a${index} ← ${convert(conversion.arguments[index], `value.«${field.name}»`, true)}`)
					, `  _root_.${conversion.constructor} ${type.fields.map((_, index) => `a${index}`).join(" ")}`, "");
			}
			continue;
		}
		const selected = selectedChecks(type);
		if(type.kind === "record")
		{
			lines.push(`structure ${mirror} where`, ...type.fields.map(field => `  «${field.name}» : ${renderType(field.type, mirrors)}`), "");
			if(tree.cycle)
			{
				lines.push(...recursiveRecordFunctions(type));
				continue;
			}
			for(const [name, selectedTree] of selected)
				lines.push(`def ${mirror}.${name} (value : ${mirror}) : _root_.Option ${source} := do`
					, ...type.fields.map((field, i) => `  let a${i} ← ${convert(selectedTree.arguments[i], `value.«${field.name}»`, true)}`)
					, `  pure (${recordValue(type, type.fields.map((_, i) => `a${i}`))})`, "");
			lines.push(`def ${mirror}.erase (value : ${source}) : ${mirror} :=`
				, `  ${mirror}.mk ${type.fields.map((field, i) => convert(tree.arguments[i], `value.«${field.name}»`, false)).join(" ")}`, "");
			continue;
		}
		lines.push(`inductive ${mirror} where`, ...type.cases.map(branch => `  | «${branch.name}» ${branch.fields.map((field, j) => `(a${j} : ${renderType(field.type, mirrors)})`).join(" ")} : ${mirror}`), "");
		const pattern = branch => `.«${branch.name}» ${branch.fields.map((_, j) => `a${j}`).join(" ")}`;
		for(const [name, selectedTree] of selected)
			lines.push(`def ${mirror}.${name} (value : ${mirror}) : _root_.Option ${source} :=`, "  match value with"
				, ...type.cases.map((branch, i) => `  | ${pattern(branch)} => do ${branch.fields.map((_, j) => `let b${j} ← ${convert(selectedTree.cases[i].arguments[j], `a${j}`, true)}; `).join("")}pure (_root_.${branch.constructor} ${branch.fields.map((_, j) => `b${j}`).join(" ")})`), "");
		lines.push(`def ${mirror}.erase (value : ${source}) : ${mirror} :=`, "  match value with"
			, ...type.cases.map((branch, i) => `  | ${pattern(branch)} => ${mirror}.«${branch.name}» ${branch.fields.map((_, j) => convert(tree.cases[i].arguments[j], `a${j}`, false)).join(" ")}`), "");
	}
	return lines;
};
