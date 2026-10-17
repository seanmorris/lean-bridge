/**
 * Internal copied payload catalog for native callbacks.
 * These entries allocate codec roots, not additional public Lean exports.
 *
 * @file
 */
import { canonicalJson } from "../../capsule/node.mjs";
import { nativeCallableGraphCarrierAbi } from "../../build/native-callable-graph.mjs";
import { componentStructuredCopiedView } from "../../build/component-structured-callable-lean.mjs";
import { assertComponentRecursiveBindings } from "../../abi/component-recursive-abi.mjs";
import { compileCopiedCGraphLayout } from "./copied-graph-layout.mjs";

/**
 * Reuse the existing bounded graph layout without treating callback identities
 * as copied fields. Every input contract is checked before making the catalog.
 *
 * @param ir - Authenticated original public exports.
 * @param descriptor - Native copied callback descriptor matched to those exports.
 * @param options - Target pointer width for internal native or PHP-Wasm layout.
 */
export const compileNativeCallableGraphPayloads = (ir, descriptor, options = {}) => {
	const original = nativeCallableGraphCarrierAbi(descriptor, ir);
	const abi = componentStructuredCopiedView(original);
	const copied = type => ({ type, ownership: "copy", lifetime: null });
	const template = ir.declarations[0];
	const document = { ...ir
		, types: ir.types.filter(type => type.kind !== "callback")
		, errors: []
		, capabilities: []
		, declarations: abi.exports.map((entry, index) => ({ ...template
			, id: entry.bindingId
			, name: `copiedPayload${index}`
			, overloadKey: entry.bindingId
			, parameters: entry.parameters.map((type, index) => ({ name: `value${index}`
				, ...copied(type)
				, mutability: "immutable"
				, optional: false
				, default: null }))
			, result: copied(entry.result), effects: [], assurance: [], capabilities: []
			, failure: { mode: "none", errors: [], unexpected: "poison-runtime" }
			, documentation: { summary: "Internal copied callback payload catalog.", details: "" } })) };
	assertComponentRecursiveBindings(abi, document);
	const layout = compileCopiedCGraphLayout(document, options);
	const nodes = new Map(layout.nodes.map(node => [node.id, node]));
	const copies = new Map();
	for(const entry of abi.exports)
	{
		const root = layout.roots.find(root => root.bindingId === entry.bindingId);
		entry.parameters.forEach((type, index) => copies.set(canonicalJson(type), nodes.get(root.parameters[index])));
		copies.set(canonicalJson(entry.result), nodes.get(root.result));
	}
	const copy = type => {
		const node = copies.get(canonicalJson(type));
		if(!node) throw new TypeError("Type is not a copied native callable payload root");
		return node;
	};
	return { ir: document, abi, layout, copy };
};
