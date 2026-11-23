/** @file Reconstruct pthread delivery, nominal leases and their error channels from public Binding IR. */
import {canonicalizeJsonValue,hashBindingIr} from "../binding-ir/canonical.mjs";
import {componentScalarTypes} from "./component-scalars.mjs";

const shape = (t,level=0) => {
	if(t?.kind === "primitive" && componentScalarTypes.includes(t.name)) return t.name;
	if(level < 32 && t?.kind === "apply" && t.constructor === "result" && t.arguments?.length === 2)
		return t.arguments.map(v => shape(v,level+1));
	throw new TypeError("Threaded Wasm requires copied primitives or returned Except values");
};
const depth = t => Array.isArray(t) ? 1 + Math.max(...t.map(depth)) : 0;
const same = (a,b) => canonicalizeJsonValue(a) === canonicalizeJsonValue(b);

/**
 * Derive the entire callable layout independently of the C generator.
 * In particular a Task that delivers an Except does not acquire a terminal error.
 *
 * @param ir - Validated, compiler-checked public binding contract.
 * @param componentIdentity - Digest of the compiled inputs and adapter.
 */
export const javaScriptTaskAbi = (ir,componentIdentity) => {
	const bindingIrSha256 = hashBindingIr(ir);
	if(!/^[0-9a-f]{64}$(?![\s\S])/u.test(componentIdentity) || ir.capabilities.length)
		throw new TypeError("Expected an in-memory Wasm task component");
	const leases=ir.types.map((t,i) => {
		const hash=t.source?.extensions?.["lean-bridge.dev/resource-identity"];
		if(t.kind!=="resource" || t.host!==null || t.source?.producer!=="lean" || t.id!=="lean:"+t.source.declaration
			|| t.representation!=="identity" || t.mutability!=="write" || t.resource?.disposal!=="required"
			|| t.resource.fallback!=="none" || t.resource.cycles!=="explicit-cut"
			|| t.name!==t.source.declaration.split(".").at(-1) || t.fields.length || t.cases.length
			|| t.typeParameters.length || t.callable!==null || t.target!==null
			|| !/^[a-f0-9]{64}$(?![\s\S])/u.test(hash) || t.resource?.kindId!=="resource:"+t.source.declaration+"/"+hash)
			throw new TypeError("Expected an authenticated nominal Lean task resource");
		return {name: t.name,id: t.id,type: "lease:"+hash,hash,tag: i+3};
	});
	if(new Set(leases.map(r => r.hash)).size!==leases.length) throw new TypeError("Repeated nominal resource hash");
	const resource=t => t?.kind==="named" && leases.find(r => r.id===t.id);
	const valueShape=t => resource(t)?.type ?? shape(t);
	const methods = ir.declarations.map(d => {
		const declaration = d.source?.declaration, ext = d.source?.extensions ?? {};
		const effect = ext["lean-lang.org/effect"], task = ext["lean-lang.org/delivery"], protocol = ext["lean-bridge.dev/pull-protocol"];
		const terminal = ext["lean-bridge.dev/task-failure"], delivery = task ? "task" : protocol ? "async-iterator" : null;
		const mode = task ? "promise" : protocol ? "async-iterator" : "value";
		if(!declaration || d.source.producer !== "lean" || !["IO","EIO","BaseIO","pure"].includes(effect) || d.kind !== "function" || d.owner !== null
			|| d.receiver !== null || d.typeParameters.length || d.parameters.some(p => p.optional || p.default !== null || p.mutability
				!== (resource(p.type) ? effect!=="pure" || protocol ? "write" : "read" : "immutable"))
			|| d.capabilities.length || d.resultMode !== mode || d.failure.unexpected !== "poison-runtime"
			|| (task !== undefined && (task !== "Task" || protocol)) || (protocol !== undefined && (!protocol || protocol.open !== declaration
				|| ![protocol.next,protocol.close].every(n => typeof n === "string" && n.length)
				|| new Set([protocol.open,protocol.next,protocol.close]).size !== 3))
			|| (terminal !== undefined && (terminal !== "IO.Error" || !task)) || ext["lean-bridge.dev/host-members"]?.length
			|| ext["lean-bridge.dev/native-effects-v1"] || ext["lean-bridge.dev/host-imports-sha256"]
			|| [...d.parameters,d.result].some(x => resource(x.type) ? x.ownership!==(x===d.result ? "lease" : "borrow")
				|| x.lifetime?.scope!==(x===d.result ? "explicit" : "call") || x.lifetime.anchor!==null : x.ownership !== "copy" || x.lifetime !== null))
			throw new TypeError("Inconsistent copied Wasm task declaration: " + d.id);
		const startId = effect === "IO" ? "error:IO.Error" : effect === "EIO" ? "error:EIO."+declaration : null;
		const step = "error:AsyncStep."+declaration;
		const terminalId = terminal ? "error:TaskIO.Error" : protocol && d.failure.errors.includes(step) ? step : null;
		if(!same([...d.failure.errors].sort(),[startId,terminalId].filter(Boolean).sort()))
			throw new TypeError("Inconsistent Wasm task failure channels: " + d.id);
		const errorShape = id => {
			if(!id) return null;
			const error = ir.errors.find(x => x.id === id);
			if(!error) throw new TypeError("Missing declared error: "+id);
			if(["error:IO.Error","error:TaskIO.Error"].includes(id))
			{
				if(error.payload !== null) throw new TypeError("Unexpected typed payload for "+id);
				return "string";
			}
			return valueShape(error.payload);
		};
		const result = valueShape(d.result.type), args = d.parameters.map(p => valueShape(p.type));
		const error = errorShape(startId), terminalShape = errorShape(terminalId);
		if(args.some(Array.isArray)) throw new TypeError("Wasm task arguments must be copied scalars or nominal leases");
		return {id: d.id
			, name: d.name
			, declaration
			, args
			, result
			, effect
			, delivery
			, error
			, startId
			, terminal: terminalShape
			, terminalId
			, tagBytes: Math.max(1,depth(result),depth(error),depth(terminalShape))
			, stepDeclaration: protocol?.next ?? null};
	});
	if(!methods.some(m => m.delivery)) throw new TypeError("Expected a Task or async iterator");
	return {profile: "javascript-wasm-threaded-task-v1",componentIdentity,bindingIrSha256,controlSymbol: "lb_js_task_"+componentIdentity,methods,...leases.length ? {leases} : {}};
};
