/**
 * Lower copied recursive types to finite, typed Component Model node tables.
 * The wire IR describes generated transport, never compiler-derived Lean facts.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { componentRecursiveLimits } from "../../abi/component-recursive.mjs";
import { compileCopiedCGraphLayout } from "../c/copied-graph-layout.mjs";
import { compileCopiedWitModel } from "./copied-model.mjs";

const primitive = name => ({ kind: "primitive", name });
const named = id => ({ kind: "named", id });
const apply = (constructor, ...args) => ({ kind: "apply", constructor, arguments: args });
const documentation = { summary: "Generated copied-graph transport.", details: "Typed indices refer only to tables in the enclosing value." };
const member = value => value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

/**
 * Compile a finite wire schema without changing or claiming proofs about the
 * original Lean signatures. Children refer to typed tables, not opaque handles.
 * This model alone does not admit a build or establish installed acceptance.
 *
 * @param input - Original copied Binding IR, including finite nominal recursion.
 * @param settings - WIT archive coordinates and exact version.
 */
export const compileCopiedWitGraphModel = (input, settings = {}) => {
	const ir = structuredClone(input), layout = compileCopiedCGraphLayout(ir);
	const bindingIrSha256 = hashBindingIr(ir);
	// Keep internal names apart from source aliases, exports and their generated
	// constructor payloads. Original nominal names become aliases of root values.
	const occupied = [...ir.types, ...ir.declarations].map(item => member(item.name));
	let stem = "LbGraph";
	while(occupied.some(name => name.startsWith(member(stem)))) stem += "X";
	const id = suffix => `lean-bridge-wit:${stem}.${suffix}`;
	const source = declaration => ({ producer: "witCopiedGraph", declaration
		, extensions: { "lean-bridge.org/original-binding-ir-sha256": bindingIrSha256 } });
	const field = (name, type) => ({ name, type, mutability: "immutable", documentation });
	const definition = (suffix, kind, values, sourceType = null) => ({
		id: sourceType?.id ?? id(suffix), name: sourceType?.name ?? `${stem}${suffix}`
		, kind, representation: "copied", mutability: "immutable", typeParameters: []
		, fields: kind === "record" ? values : []
		, cases: kind === "variant" ? values : []
		, target: kind === "alias" ? values : null
		, resource: null, callable: null, host: null, documentation, assurance: []
		, source: source(sourceType?.id ?? id(suffix))
	});
	const nodes = layout.nodes.map((node, index) => ({ ...node, index
		, referenceRef: node.kind === "primitive" ? node.ref : named(id(`Ref${index}`))
		, rowRef: node.kind === "primitive" ? node.ref : named(id(`Node${index}`))
		, valueRef: node.kind === "primitive" ? node.ref : named(id(`Value${index}`))
		, tableField: node.kind === "primitive" ? null : `nodes${index}` }));
	const byId = new Map(nodes.map(node => [node.id, node]));
	const tables = nodes.filter(node => node.kind !== "primitive"), types = [];
	const child = nodeId => byId.get(nodeId).referenceRef;
	for(const node of tables)
	{
		types.push(definition(`Ref${node.index}`, "record", [field("index", primitive("uint32"))]));
		if(node.kind === "record") types.push(definition(`Node${node.index}`, "record", node.fields.map(item => field(item.sourceName, child(item.type)))));
		else if(node.kind === "variant") types.push(definition(`Node${node.index}`, "variant", node.cases.map(branch => ({
			name: branch.sourceName
			, fields: branch.fields.map(item => field(item.sourceName, child(item.type)))
			, documentation
		}))));
		else types.push(definition(`Node${node.index}`, "alias", apply(node.kind, ...node.element ? [child(node.element)] : node.fields.map(item => child(item.type)))));
		types.push(definition(`Value${node.index}`, "record", [field("root", node.referenceRef), field("nodes", named(id("Arena")))]));
	}
	if(tables.length) types.push(definition("Arena", "record", tables.map(node => field(node.tableField, apply("array", node.rowRef)))));
	const aliases = new Map(layout.aliases.map(alias => [alias.id, alias]));
	for(const original of ir.types)
	{
		const alias = aliases.get(original.id);
		const target = alias ? byId.get(alias.target) : nodes.find(node => node.ref.kind === "named" && node.ref.id === original.id);
		// A source alias chain does not add value nesting. Flatten only this wire
		// target; the original alias chain remains explicit in graph.types below.
		types.push(definition("", "alias", target.valueRef, original));
	}
	const rootRef = (original, nodeId) => original.kind === "named" ? original : byId.get(nodeId).valueRef;
	const declarations = ir.declarations.map((declaration, index) => ({ ...declaration
		, parameters: declaration.parameters.map((site, position) => ({ ...site, type: rootRef(site.type, layout.roots[index].parameters[position]) }))
		, result: { ...declaration.result, type: rootRef(declaration.result.type, layout.roots[index].result) }
		, source: source(declaration.id), assurance: []
	}));
	const wireIr = { ...ir, types, declarations, assurance: []
		, producers: [{ id: "witCopiedGraph"
			, adapter: "wit-copied-graph-wire", adapterVersion: 1
			, tool: "Lean Bridge typed node tables"
			, toolVersion: "1", extensions: {} }] };
	const wire = compileCopiedWitModel(wireIr, settings);
	const wireAliases = new Map((wire.manifest.aliases ?? []).map(alias => [alias.id, alias]));
	const wireType = ref => ref.kind === "named" && wireAliases.has(ref.id) ? wireAliases.get(ref.id).witName : wire.surface.copy(ref).wit;
	for(const node of nodes)
	{
		node.referenceCopy = wire.surface.copy(node.referenceRef);
		node.rowCopy = wire.surface.copy(node.rowRef);
		node.valueCopy = wire.surface.copy(node.valueRef);
	}
	const contracts = ir.declarations.map((declaration, index) => ({ id: declaration.id
		, witName: wire.surface.functions[index].witName
		, parameters: declaration.parameters.map((site, position) => ({ name: site.name, type: site.type, witType: wire.surface.functions[index].parameters[position].copy.wit }))
		, result: { type: declaration.result.type, witType: wire.surface.functions[index].resultCopy.wit } }));
	const manifest = {
		schemaVersion: 1, backend: "ordinary-wit-native-graph-v1"
		, component: ir.component, bindingIrSha256
		, wit: wire.manifest.wit, declarations: contracts
		, assurance: ir.assurance, assuranceScope: "original-lean-binding-ir"
		, graph: { schemaVersion: 1, representation: "typed-node-tables-v1"
			, layoutSha256: sha256(canonicalJson(layout))
			, wireBindingIrSha256: hashBindingIr(wireIr)
			, wordBits: 64
			, limits: { valueDepth: componentRecursiveLimits.valueDepth
				, valueNodes: componentRecursiveLimits.valueNodes, copyBytes: 16777216 }
			, arena: tables.length ? wireType(named(id("Arena"))) : null
			, nodes: nodes.map(node => ({ id: node.id, type: node.ref, kind: node.kind
				, referenceType: wireType(node.referenceRef)
				, rowType: wireType(node.rowRef)
				, valueType: node.valueCopy ? wireType(node.valueRef) : null
				, tableField: node.tableField
				, fields: node.fields.map((item, index) => ({ name: item.sourceName, type: item.type, witName: node.rowCopy.fields[index].witName ?? null }))
				, cases: node.cases.map((branch, index) => ({ name: branch.sourceName
					, witName: node.rowCopy.cases[index].witName
					, fields: branch.fields.map((item, position) => ({ name: item.sourceName, type: item.type, witName: node.rowCopy.cases[index].fields[position].witName })) }))
				, element: node.element }))
			, types: ir.types.map(type => ({ id: type.id
				, name: type.name, kind: type.kind
				, witName: wireType(named(type.id))
				, fields: type.fields, cases: type.cases, target: type.target })) }
		, deferred: ["structured-callables", "resource-containing-aggregates"]
	};
	return { ir, layout, nodes, tables, wireIr, wire, manifest, name: wire.name, version: wire.version, wit: wire.wit, wat: wire.wat };
};
