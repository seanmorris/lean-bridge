/**
 * Public C-family names over the authenticated native callable graph.
 * Copied payload layouts stay separate from borrowed and leased identities.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { createNativeCallableGraphDescriptor } from "../../build/native-callable-graph.mjs";
import { compileNativeCallableGraphPayloads } from "./native-callable-graph-payloads.mjs";
import { compileCopiedGraphPackageModel, copiedGraphCAliases } from "./graph-package.mjs";
import { generateCopiedGmpGraphValues } from "./gmp-graph-values.mjs";
import { cIdentifier, cKeywords } from "./generate.mjs";
import { rejectPrimitiveSurface } from "./primitive-surface.mjs";

/**
 * Admit only implemented consumer targets and bind every public export.
 *
 * @param ir - Compiler-authenticated callable and copied type semantics.
 * @param targets - Requested C-family targets.
 */
export const compileCallableGraphPackageModel = (ir, targets) => {
	if(!Array.isArray(targets) || !targets.length || new Set(targets).size !== targets.length || targets.some(target => !["c", "cpp"].includes(target)))
		throw Object.assign(new TypeError("Recursive callable packages require an implemented C-family projection"), { code: "native-graph-projection-unavailable" });
	const descriptor = createNativeCallableGraphDescriptor(ir);
	const payloads = compileNativeCallableGraphPayloads(ir, descriptor);
	const copied = compileCopiedGraphPackageModel(payloads.ir, targets), p = copied.prefix;
	const occupied = new Set(["initialize", "status", "error", "error_code", "graph_finish", "graph_ready", "graph_retire", "graph_initialize", "runtime", "runtime_v1"]);
	if(targets.includes("cpp"))
	{
		for(const name of ["Box", "Ok", "Err", "Result", "Nat", "Int", "detail", "std", "boost", "LeanClosure", "Error"]) occupied.add(name);
		for(const type of ir.types.filter(type => type.kind !== "callback"))
		{
			if(occupied.has(type.name)) rejectPrimitiveSurface(null, `Callable graph type name collides with runtime helpers: ${type.name}`);
			occupied.add(type.name);
		}
	}
	const callbacks = new Map(descriptor.callbacks.map((signature, index) => {
		const field = cIdentifier(ir.types.find(type => type.id === signature.id).name);
		if(targets.includes("c") && (!/^[a-z][a-z0-9_]*$/.test(field) || field.includes("__") || cKeywords.has(field)))
			rejectPrimitiveSurface(null, `Invalid C callback name: ${field}`);
		const entry = { kind: "callback", ...signature, index
			, name: `${p}_callback_${signature.key}`
			, publicName: `${p}_${field}`, gmpName: `${p}_gmp_${field}`
			, publicOwnedName: `${p}_owned_${field}`
			, gmpOwnedName: `${p}_gmp_owned_${field}`
			, call: `${p}_callback_${signature.key}_lease_call`
			, dispose: `${p}_callback_${signature.key}_lease_dispose` };
		return [signature.id, entry];
	}));
	const site = ref => callbacks.get(ref.id) ?? payloads.copy(ref);
	const functions = ir.declarations.map(declaration => {
		const field = cIdentifier(declaration.name);
		if(!/^[a-z][a-z0-9_]*$/.test(field) || field.includes("__") || cKeywords.has(field) || occupied.has(field))
			rejectPrimitiveSurface(declaration, "Callable graph function name collides with a reserved or generated identifier");
		occupied.add(field);
		const native = descriptor.exports.find(item => item.bindingId === declaration.id);
		return { declaration, field, name: `${p}_${field}`
			, native: `${native.symbol}_graph`
			, parameters: declaration.parameters.map(parameter => site(parameter.type))
			, result: site(declaration.result.type) };
	});
	let cAliases = [];
	if(targets.includes("c"))
	{
		const macro = p.toUpperCase();
		const errors = new Set(["NONE", "INVALID_ARGUMENT", "RUNTIME_UNAVAILABLE", "UNEXPECTED"].map(name => `${macro}_ERROR_${name}`));
		for(const node of copied.layout.nodes) for(const branch of node.cases)
		{
			errors.add(branch.tag); errors.add(branch.tag.replace(`${macro}_`, `${macro}_GMP_`));
		}
		for(const error of ir.errors)
		{
			const field = cIdentifier(error.name).toUpperCase();
			const name = `${macro}_ERROR_${field}`;
			if(!/^[A-Z][A-Z0-9_]*$/.test(field) || errors.has(name))
				rejectPrimitiveSurface(null, `C declared error name collides with a reserved or generated identifier: ${error.name}`);
			errors.add(name);
		}
		const values = generateCopiedGmpGraphValues(payloads.ir);
		const unitId = values.layout.nodes.find(node => node.ref?.name === "unit").id;
		const roots = functions.map(fn => ({ name: fn.name
			, bindingId: fn.declaration.id
			, parameters: fn.parameters.map(node => node.kind === "callback" ? unitId : node.id)
			, result: fn.result.kind === "callback" ? unitId : fn.result.id }));
		const reservedNames = [];
		for(const callback of callbacks.values())
		{
			roots.push({ name: callback.publicName, bindingId: callback.id
				, parameters: callback.parameters.map(ref => payloads.copy(ref).id)
				, result: payloads.copy(callback.result).id });
			reservedNames.push(`${callback.publicName}_fn`, `${callback.gmpName}_fn`);
			for(const name of [callback.publicOwnedName, callback.gmpOwnedName])
				reservedNames.push(name, `${name}_call`, `${name}_dispose`);
		}
		cAliases = copiedGraphCAliases({ ...values, layout: { ...values.layout, roots } }, { copies: true, reservedNames });
	}
	return { ...copied, callableGraph: true, descriptor, payloads, cAliases
		, callbacks, functions
		, layoutSha256: sha256(canonicalJson({ layout: copied.layout, descriptor })) };
};
