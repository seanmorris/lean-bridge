/**
 * Typed Rust callbacks over the authenticated finite native payload graph.
 * Callable identities stay outside the copied-value catalog.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { createNativeCallableGraphDescriptor } from "../../build/native-callable-graph.mjs";
import { compileNativeCallableGraphPayloads } from "../c/native-callable-graph-payloads.mjs";
import { compileCopiedRustGraphPackageModel } from "./copied-graph-package.mjs";
import { generateCopiedRustGraphConversions } from "./copied-graph-conversions.mjs";
import { cIdentifier } from "../c/generate.mjs";

const reserved = new Set("dispatch invoke handle token __runtime std num_bigint sha2 as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while abstract become box do final gen macro override priv typeof unsized virtual yield try union Error Result Ok Err Vec String BigUint BigInt Sign Option Some None Drop Copy Clone Send Sync Default assets LeanClosure Lease CallGuard CallbackState CallbackFailure Box FnMut GraphNative graph_runtime graph_error graph_symbol GRAPH_NATIVE GRAPH_PID copied callable_status bool u8 u16 u32 u64 u128 i8 i16 i32 i64 i128 f32 f64 str usize isize char".split(" "));

/**
 * Bind public names, borrowed input types and canonical closure signatures.
 *
 * @param ir - Checked copied and synchronous callable Binding IR.
 */
export const compileCallableRustGraphPackageModel = ir => {
	const descriptor = createNativeCallableGraphDescriptor(ir);
	const payloads = compileNativeCallableGraphPayloads(ir, descriptor);
	const values = compileCopiedRustGraphPackageModel(payloads.ir);
	const generated = generateCopiedRustGraphConversions(payloads.ir);
	const occupied = new Set(reserved);
	const claim = name => {
		if(typeof name !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || name.includes("__") || occupied.has(name)
			|| /^(?:Graph(?:Raw\d+|Union\d+|Case\d+_\d+)|(?:Callback|Context)\d+|(?:call|invoke|callback)\d+)$/.test(name)
			|| /^graph_(?:ready|retire|initialize|finish|call_|check\d|to\d|from\d|clear\d)/.test(name))
			throw new TypeError(`Rust callable graph name is reserved or duplicated: ${name}`);
		occupied.add(name); return name;
	};
	for(const type of payloads.ir.types) claim(type.name);
	const hosts = new Map(generated.types.map(node => [node.id, node]));
	const inputs = new Map(generated.inputTypes.map(node => [node.id, node.name]));
	const raws = new Map(generated.rawTypes.map(node => [node.id, node.name]));
	const nodes = new Map(payloads.layout.nodes.map((node, index) => [node.id, {
		...node, index
		, publicType: hosts.get(node.id).name
		, inputType: (node.aggregate ? "&" : "") + inputs.get(node.id)
		, raw: raws.get(node.id) }]));
	const copy = ref => nodes.get(payloads.copy(ref).id);
	const annotated = ref => {
		const node = copy(ref);
		if(ref.kind !== "named") return node;
		const publicType = ir.types.find(type => type.id === ref.id).name;
		return { ...node, publicType
			, inputType: node.element || ["string", "bytes"].includes(node.ref.name) ? node.inputType : (node.aggregate ? "&" : "") + publicType };
	};
	const signatures = new Map();
	const callbacks = new Map(descriptor.callbacks.map((callback, index) => {
		const parameters = callback.parameters.map(copy), result = copy(callback.result);
		const signature = `fn(${parameters.map(node => node.inputType).join(", ")}) -> ${result.publicType}`;
		const value = { ...callback, index, parameters, result, signature
			, publicType: `LeanClosure<${signature}>`
			, inputType: `impl FnMut(${callback.parameters.map(ref => annotated(ref).publicType).join(", ")}) -> Result<${annotated(callback.result).publicType}, Error>`
			, native: `unsafe extern "C" fn(u64, ${[...parameters.map(node => `*const ${node.raw}`), `*mut ${result.raw}`].join(", ")}) -> u32` };
		if(!signatures.has(signature)) signatures.set(signature, value);
		value.hostIndex = signatures.get(signature).index;
		return [callback.id, value];
	}));
	const site = ref => callbacks.get(ref.id) ?? annotated(ref);
	const functions = ir.declarations.map((declaration, index) => {
		const parameters = declaration.parameters.map(parameter => ({ ...parameter, value: site(parameter.type) }));
		const result = site(declaration.result.type);
		return { declaration, index, name: claim(cIdentifier(declaration.name))
			, parameters, result
			, native: `unsafe extern "C" fn(${[...parameters.map(({ value }) => `*const ${value.signature ? `Callback${value.index}` : value.raw}`), `*mut ${result.signature ? "u64" : result.raw}`].join(", ")}) -> u32`
			, symbol: descriptor.exports.find(entry => entry.bindingId === declaration.id).symbol + "_graph" };
	});
	return { ...values, ir, descriptor, payloads, generated, nodes
		, callbacks, functions, callableGraph: true
		, exports: ["Error", "LeanClosure", ...values.bigint ? ["BigInt", "BigUint"] : [], ...payloads.ir.types.map(type => type.name), ...functions.map(fn => fn.name)]
		, closureSignatures: [...signatures.values()], surface: { callbacks }
		, layoutSha256: sha256(canonicalJson({ layout: values.layout, descriptor })) };
};
