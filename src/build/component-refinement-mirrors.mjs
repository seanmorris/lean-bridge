/**
 * Normalize copied component refinements to typed mirrors without selecting constructors.
 * Public Binding IR provenance is authenticated before its closed private graph reaches this layer.
 *
 * @file
 */
import { assertRefinement, nominalRefinement } from "../abi/refinements.mjs";
import { assertComponentRecursiveAbi } from "../abi/component-recursive-abi.mjs";
import { componentRecursiveLimits } from "../abi/component-recursive.mjs";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { refinementCycleTrees, refinementMirrorNames, renderRefinementMirrors } from "./refinement-mirrors.mjs";
import { componentNominalFinGuards } from "./component-fin-guards.mjs";

const fail = message => { throw new TypeError(`Invalid component refinement mirrors: ${message}`); };
const children = definition => definition.kind === "alias" ? [definition.target]
	: definition.kind === "record" ? definition.fields.map(field => field.type)
		: definition.cases.flatMap(branch => branch.fields.map(field => field.type));

/**
 * Detect a selected nominal tree without changing the carrier path of older Fin-only packages.
 *
 * @param tree - A per-use public refinement tree.
 * @param depth - Bounded structural nesting.
 */
export const hasComponentNominalRefinements = (tree, depth = 0) => {
	if(depth > componentRecursiveLimits.schemaDepth) fail("refinement nesting exceeds its bound");
	return tree !== null && tree !== undefined && (["record", "variant"].includes(tree.kind)
		|| (tree.kind === "checked-record" && Object.hasOwn(tree, "fields"))
		|| (tree.arguments ?? []).some(child => hasComponentNominalRefinements(child, depth + 1)));
};

/**
 * Match selected field trees to the private layout. This does not replace public source-provenance checks.
 * The private ABI authenticates each lean: identity and preserves erased proof-field names.
 *
 * @param types - Validated private nominal layouts.
 */
export const componentRefinementDefinitions = types => types.map(type => ({ ...type, representation: "copied"
	, source: { declaration: type.id.slice(5), extensions: type.erased ? { "lean-lang.org/erased-proofs": type.erased } : {} } }));

/**
 * Prepare per-use checks and shared layouts for copied component carriers.
 * Constructors remain at their input sites; result-only Subtypes need no constructor.
 *
 * @param abi - Closed copied-graph ABI, authenticated against the public Binding IR by its caller.
 * @param exports - Compiler-selected exports with public per-use refinement trees.
 * @param leanType - Renderer for primitive and unrefined source types.
 * @param nominalRefinements - Compiler-owned shared Fin constraints in nominal layouts.
 */
export const componentRefinementMirrors = (abi, exports, leanType, nominalRefinements = []) => {
	assertComponentRecursiveAbi(abi);
	const definitions = new Map(abi.types.map(type => [type.id, type]));
	const publicTypes = componentRefinementDefinitions(abi.types), constraints = new Map();
	let previous = "";
	for(const entry of nominalRefinements)
	{
		if(!entry || Object.keys(entry).sort().join(",") !== "id,refinement" || !definitions.has(entry.id) || entry.id <= previous)
			fail("shared constraints must have declared, unique, sorted identities");
		const constraint = nominalRefinement(definitions.get(entry.id), entry.refinement);
		if(constraint === null) fail("missing shared constraint");
		constraints.set(entry.id, constraint); previous = entry.id;
	}
	if(!Array.isArray(exports) || exports.length !== abi.exports.length) fail("exports must cover the private signature table");
	const merge = (tree, shared) => {
		if(shared === null || shared === undefined) return tree;
		if(tree === null) return shared;
		if(tree.kind !== shared.kind || (tree.kind === "fin" && tree.bound !== shared.bound)
			|| (tree.kind === "fin-field" && tree.field !== shared.field))
			fail("per-use refinements conflict with shared Fin bounds");
		return ["fin", "fin-field"].includes(tree.kind) ? tree
			: { ...tree, arguments: tree.arguments.map((child, index) => merge(child, shared.arguments[index])) };
	};
	const normalize = (root, selected, produced, projections = new Map()) => {
		let nodes = 0;
		const usedCycles = new Set();
		const expand = (type, tree, seen, depth, active = new Map()) => {
			if(++nodes > componentRecursiveLimits.typeNodes || depth > componentRecursiveLimits.schemaDepth) fail("refinement expansion exceeds its bound");
			if(type.kind === "primitive") return tree;
			if(type.kind === "apply")
			{
				const arguments_ = type.arguments.map((child, index) => expand(child, tree?.arguments[index] ?? null, seen, depth + 1, active));
				return arguments_.some(Boolean) ? { kind: type.constructor, arguments: arguments_ } : null;
			}
			const definition = definitions.get(type.id), shared = constraints.get(type.id);
			if(tree === null && projections.has(type.id)) return projections.get(type.id);
			if(seen.has(type.id))
			{
				if(tree !== null) fail("recursive selected refinements require another representation");
				const cycle = active.get(type.id);
				if(cycle === undefined) return null;
				usedCycles.add(cycle);
				return { kind: "recursive", definition: type.id.slice(5), cycle };
			}
			const selectedHere = tree !== null || shared !== undefined;
			const cycle = sha256(canonicalJson({ id: type.id, selection: tree, shared: shared ?? null })).slice(0, 20);
			const inner = new Set([...seen, type.id]);
			const innerActive = new Map(active);
			if(selectedHere) innerActive.set(type.id, cycle);
			if(definition.kind === "alias") return expand(definition.target, merge(tree, shared?.target), inner, depth + 1, innerActive);
			if(definition.erased)
			{
				if(!produced && tree?.kind !== "checked-record") fail("a checked record input requires its site's constructor");
				const rich = tree?.kind === "checked-record" && Object.hasOwn(tree, "fields");
				if(produced && tree !== null && (!rich || tree.constructor !== null))
					fail("checked record results retain only their projected field refinements");
				const arguments_ = definition.fields.map((field, index) => expand(field.type,
					merge(rich ? tree.fields[index].refinement : null, shared?.fields?.[index]), inner, depth + 1, innerActive));
				if(!produced && !rich && (depth !== 0 || arguments_.some(Boolean)))
					fail("nested or field-refined checked records require an exact field selection");
				if(!rich && depth === 0 && !arguments_.some(Boolean))
					return { kind: "checked-record", definition: type.id.slice(5), constructor: produced ? null : tree.constructor };
				return {
					kind: "checked-record", definition: type.id.slice(5)
					, constructor: produced ? null : tree.constructor
					, fields: definition.fields.map(field => field.name), arguments: arguments_
					, ...(usedCycles.has(cycle) ? { cycle } : {})
				};
			}
			const fields = (members, choices, bounds) => members.map((field, index) =>
				expand(field.type, merge(choices?.[index].refinement ?? null, bounds?.[index]), inner, depth + 1, innerActive));
			if(definition.kind === "record")
			{
				const arguments_ = fields(definition.fields, tree?.fields, shared?.fields);
				return arguments_.some(Boolean) ? { kind: "record"
					, definition: type.id.slice(5)
					, fields: definition.fields.map(field => field.name)
					, arguments: arguments_
					, ...(usedCycles.has(cycle) ? { cycle } : {}) } : null;
			}
			const cases = definition.cases.map((branch, index) => ({ name: branch.name
				, fields: branch.fields.map(field => field.name)
				, arguments: fields(branch.fields, tree?.cases[index].fields, shared?.cases[index]) }));
			return cases.some(branch => branch.arguments.some(Boolean)) ? { kind: "variant"
				, definition: type.id.slice(5), cases
				, ...(usedCycles.has(cycle) ? { cycle } : {}) } : null;
		};
		return expand(root, selected, new Set(), 0);
	};
	const sites = exports.map((item, index) => {
		const signature = abi.exports[index];
		if(item.bindingId !== signature.bindingId || item.symbol !== signature.symbol || !Array.isArray(item.parameters)
			|| item.parameters.length !== signature.parameters.length) fail("export sites must match private signature order and identities");
		const selected = item.refinements ?? { parameters: signature.parameters.map(() => null), result: null };
		if(!selected || Object.keys(selected).sort().join(",") !== "parameters,result" || !Array.isArray(selected.parameters)
			|| selected.parameters.length !== signature.parameters.length) fail("refinements must cover the complete signature");
		selected.parameters.forEach((tree, i) => assertRefinement(tree, signature.parameters[i], 0, true, publicTypes));
		assertRefinement(selected.result, signature.result, 0, true, publicTypes, true);
		const parameters = signature.parameters.map((type, i) => normalize(type, selected.parameters[i], false));
		const result = normalize(signature.result, selected.result, true);
		return { ...item, refinements: { parameters, result } };
	});
	const names = refinementMirrorNames({ exports: sites });
	// A shared carrier cannot sometimes hold a checked source value and sometimes its erased payload.
	// Missing per-use trees must reject, never silently borrow another export's constructor.
	const cover = (type, tree, seen = new Set()) => {
		if(type.kind === "primitive") return;
		if(type.kind === "apply")
		{
			type.arguments.forEach((child, index) => cover(child, tree?.arguments[index] ?? null, seen));
			return;
		}
		if(seen.has(type.id)) return;
		const definition = definitions.get(type.id), inner = new Set([...seen, type.id]);
		if(definition.kind === "alias") return cover(definition.target, tree, inner);
		if(names.has(type.id.slice(5)) && (!tree || tree.definition !== type.id.slice(5))) fail(`missing per-use refinement for ${type.id}`);
		if(definition.kind === "record") definition.fields.forEach((field, index) => cover(field.type, tree?.arguments?.[index] ?? null, inner));
		else definition.cases.forEach((branch, index) => branch.fields.forEach((field, position) => cover(field.type, tree?.cases[index].arguments[position] ?? null, inner)));
	};
	for(const [index, item] of sites.entries())
	{
		const signature = abi.exports[index];
		signature.parameters.forEach((type, i) => cover(type, item.refinements.parameters[i]));
		cover(signature.result, item.refinements.result);
	}
	// The ABI may retain an unused parent definition. Its carrier must still compile against
	// a child's shared mirror. Derive only result erasure for these layouts, never an input
	// constructor borrowed from another site. Actual exports already passed coverage above.
	const projections = new Map(), layoutExports = [...sites];
	const project = tree => {
		if(tree === null) return null;
		if(["subtype", "checked-record"].includes(tree.kind)) return { ...tree, constructor: null };
		if(tree.kind === "variant") return { ...tree, cases: tree.cases.map(branch => ({ ...branch, arguments: branch.arguments.map(project) })) };
		return tree.arguments ? { ...tree, arguments: tree.arguments.map(project) } : tree;
	};
	const remember = tree => {
		if(!tree) return;
		if(["record", "variant", "checked-record"].includes(tree.kind)) projections.set(`lean:${tree.definition}`, project(tree));
		for(const child of tree.kind === "variant" ? tree.cases.flatMap(branch => branch.arguments) : tree.arguments ?? []) remember(child);
	};
	for(const item of sites) [...item.refinements.parameters, item.refinements.result].forEach(remember);
	for(const definition of abi.types)
	{
		if(definition.kind === "alias" || names.has(definition.id.slice(5))) continue;
		const tree = normalize({ kind: "named", id: definition.id }, null, true, projections);
		if(tree === null) continue;
		remember(tree);
		const item = { refinements: { parameters: [], result: tree } };
		for(const name of refinementMirrorNames({ exports: [item] })) names.add(name);
		layoutExports.push(item);
	}
	const renderType = type => {
		if(type.kind === "primitive") return leanType(type);
		if(type.kind === "named")
		{
			const definition = definitions.get(type.id);
			if(definition.kind === "alias") return renderType(definition.target);
			return `${names.has(type.id.slice(5)) ? "LbErased" : "_root_"}.${type.id.slice(5)}`;
		}
		const arguments_ = type.arguments.map(renderType);
		if(type.constructor === "result") return `(_root_.Except ${arguments_[1]} ${arguments_[0]})`;
		const constructor = { array: "Array", list: "List", option: "Option", tuple: "Prod" }[type.constructor];
		return `(_root_.${constructor} ${arguments_.join(" ")})`;
	};
	// Mirrors are emitted after their acyclic dependencies. Strongly connected nominal groups
	// are retained for one mutually recursive Lean declaration block.
	const ordered = [], done = new Set(), active = new Set();
	const visit = type => {
		if(type.kind === "primitive") return;
		if(type.kind === "apply") return type.arguments.forEach(visit);
		if(done.has(type.id)) return;
		const definition = definitions.get(type.id), mirrored = names.has(type.id.slice(5));
		if(definition.kind !== "alias" && !mirrored) return;
		if(active.has(type.id)) return;
		active.add(type.id); children(definition).forEach(visit); active.delete(type.id); done.add(type.id);
		if(!mirrored) return;
		ordered.push({ ...definition, lean: type.id.slice(5)
			, ...definition.kind === "variant" ? { cases: definition.cases.map(branch => ({ ...branch, constructor: `${type.id.slice(5)}.${branch.name}` })) } : {} });
	};
	for(const name of [...names].sort()) visit({ kind: "named", id: `lean:${name}` });
	const mirrored = new Map(ordered.filter(type => ["record", "variant"].includes(type.kind)).map(type => [type.lean, type]));
	const dependencies = new Map([...mirrored.keys()].map(name => [name, new Set()]));
	const collectDependencies = (type, found, aliases = new Set()) => {
		if(type.kind === "primitive") return;
		if(type.kind === "apply") return type.arguments.forEach(child => collectDependencies(child, found, aliases));
		const definition = definitions.get(type.id), name = type.id.slice(5);
		if(definition.kind === "alias")
		{
			if(aliases.has(type.id)) fail(`recursive alias layout ${type.id}`);
			return collectDependencies(definition.target, found, new Set([...aliases, type.id]));
		}
		if(mirrored.has(name)) found.add(name);
	};
	for(const [name, type] of mirrored)
		children(type).forEach(child => collectDependencies(child, dependencies.get(name)));
	let sequence = 0;
	const indexes = new Map(), lows = new Map(), stack = [], stacked = new Set(), components = [];
	const connect = name => {
		indexes.set(name, sequence); lows.set(name, sequence++); stack.push(name); stacked.add(name);
		for(const dependency of [...dependencies.get(name)].sort())
		{
			if(!indexes.has(dependency))
			{ connect(dependency); lows.set(name, Math.min(lows.get(name), lows.get(dependency))); }
			else if(stacked.has(dependency)) lows.set(name, Math.min(lows.get(name), indexes.get(dependency)));
		}
		if(lows.get(name) !== indexes.get(name)) return;
		const component = [];
		while(stack.length)
		{
			const member = stack.pop(); stacked.delete(member); component.push(member);
			if(member === name) break;
		}
		components.push(component.sort());
	};
	for(const name of [...mirrored.keys()].sort()) if(!indexes.has(name)) connect(name);
	const mutualGroups = components.filter(component => component.length > 1);
	const recordValue = (type, values) => `({ ${type.fields.map((field, index) => `«${field.name}» := ${values[index]}`).join(", ")} } : _root_.${type.lean})`;
	const mirrorModel = { exports: layoutExports, types: ordered, mutualGroups };
	const cycles = refinementCycleTrees(mirrorModel);
	const lines = renderRefinementMirrors(mirrorModel, names, renderType, recordValue);
	lines.push(...componentNominalFinGuards(ordered, projections, cycles, mutualGroups));
	const normalized = sites.map((item, index) => ({ ...item
		, parameters: item.parameters.map((parameter, i) => ({ ...parameter, leanType: renderType(abi.exports[index].parameters[i]) }))
		, leanResultType: renderType(abi.exports[index].result) }));
	// Compare no constructor hashes here: the shared renderer authenticates the full normalized
	// layouts and gives each input tree its own deterministic checked conversion.
	return { names, sites: normalized, lines, renderType, cycles, mutualGroups };
};
