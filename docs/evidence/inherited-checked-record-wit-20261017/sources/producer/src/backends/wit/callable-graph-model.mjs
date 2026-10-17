/**
 * Separate recursive copied payloads from borrowed and owned WIT identities.
 * The finite wire schema records transport, not new facts about the Lean source.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { compileCallableGraphPackageModel } from "../c/callable-graph-model.mjs";
import { compileCopiedWitGraphModel } from "./copied-graph-model.mjs";
import { compileCopiedWitModel } from "./copied-model.mjs";

/**
 * Preserve each original callback identity while lowering its copied payloads.
 * This model does not by itself enable a release or establish installed checks.
 *
 * @param input - Original compiler-authenticated callable and copied signatures.
 * @param settings - Optional WIT package coordinates.
 */
export const compileCallableWitGraphModel = (input, settings = {}) => {
	const ir = structuredClone(input), native = compileCallableGraphPackageModel(ir, ["c"]);
	if(!native.callbacks.size) throw new TypeError("A WIT callable graph requires callback identities");
	const graph = compileCopiedWitGraphModel(native.payloads.ir, settings);
	const bindingIrSha256 = hashBindingIr(ir), nodes = new Map(graph.nodes.map(node => [node.id, node]));
	const source = id => ({ producer: "witCopiedGraph", declaration: id
		, extensions: { "lean-bridge.org/original-binding-ir-sha256": bindingIrSha256 } });
	const copy = ref => ref.kind === "named" ? ref : nodes.get(native.payloads.copy(ref).id).valueRef;
	const site = item => ({ ...item, type: native.callbacks.has(item.type.id) ? item.type : copy(item.type) });
	const types = graph.wireIr.types.map(type => ({ ...type, source: source(type.id) }));
	for(const type of ir.types.filter(type => type.kind === "callback")) types.push({ ...type
		, callable: { ...type.callable, parameters: type.callable.parameters.map(site), result: site(type.callable.result) }
		, source: source(type.id), assurance: [] });
	const wireIr = { ...graph.wireIr, types, errors: ir.errors
		, declarations: ir.declarations.map(declaration => ({ ...declaration
			, parameters: declaration.parameters.map(site)
			, result: site(declaration.result)
			, source: source(declaration.id), assurance: [] })) };
	// Distinct aliases and callback contracts can lower to identical structural
	// payloads. Their resource names must retain nominal identity, not coalesce.
	const callableResourceNames = new Map([...native.callbacks.keys()].map(id => [id, `function-${sha256(id).slice(0, 24)}`]));
	const wire = compileCopiedWitModel(wireIr, settings, { callables: true, callableResourceNames });
	for(const node of graph.nodes)
	{
		node.referenceCopy = wire.surface.copy(node.referenceRef);
		node.rowCopy = wire.surface.copy(node.rowRef);
		node.valueCopy = wire.surface.copy(node.valueRef);
	}
	const callbacks = new Map([...native.callbacks].map(([id, callback]) => [
		id, { ...callback
			, resource: wire.resources.find(resource => resource.type.id === id)
			, parameters: callback.parameters.map(ref => nodes.get(native.payloads.copy(ref).id))
			, result: nodes.get(native.payloads.copy(callback.result).id) }]));
	const nativeSite = ref => callbacks.get(ref.id) ?? nodes.get(native.payloads.copy(ref).id);
	const functions = native.functions.map(fn => ({ ...fn
		, parameters: fn.declaration.parameters.map(parameter => nativeSite(parameter.type))
		, result: nativeSite(fn.declaration.result.type)
		, wire: wire.surface.functions.find(item => item.declaration.id === fn.declaration.id) }));
	const declarations = functions.map(fn => ({ id: fn.declaration.id
		, witName: fn.wire.witName
		, parameters: fn.declaration.parameters.map((item, index) => ({
			name: item.name, type: item.type
			, ownership: item.ownership, lifetime: item.lifetime
			, witType: fn.wire.parameters[index].copy.wit }))
		, result: { ...fn.declaration.result, witType: fn.wire.resultCopy.wit } }));
	const manifest = { ...graph.manifest
		, backend: "ordinary-wit-native-callable-graph-v1", bindingIrSha256
		, wit: wire.manifest.wit, declarations
		, assurance: ir.assurance, assuranceScope: "original-lean-binding-ir"
		, graph: { ...graph.manifest.graph, wireBindingIrSha256: hashBindingIr(wireIr) }
		, callables: [...callbacks.values()].map(callback => ({
			id: callback.id, signatureKey: callback.key
			, witName: callback.resource.witName
			, invoke: `invoke-${callback.resource.witName}`
			, parameter: "borrow", result: "own"
			, signature: ir.types.find(type => type.id === callback.id).callable
		}))
		, native: { descriptorSha256: sha256(canonicalJson(native.descriptor)), layoutSha256: native.layoutSha256 }
		, deferred: ["resource-containing-aggregates", "retained-host-callbacks", "asynchronous-callables"] };
	return { ...graph, ir, native, callbacks, functions, wireIr, wire, manifest
		, prefix: native.prefix, layoutSha256: native.layoutSha256
		, wit: wire.wit, wat: wire.wat };
};
