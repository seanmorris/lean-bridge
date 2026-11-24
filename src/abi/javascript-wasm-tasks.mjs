/** @file Reconstruct pthread delivery, nominal leases and their error channels from public Binding IR. */
import {canonicalizeJsonValue,hashBindingIr} from "../binding-ir/canonical.mjs";
import {componentScalarTypes} from "./component-scalars.mjs";
import {javaScriptTaskHosts,jsMemberFailure} from "./javascript-task-hosts.mjs";

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
 * @param hostImports - Separate authored member contract, required for a JS host component.
 */
export const javaScriptTaskAbi = (ir,componentIdentity,hostImports=null) => {
	const bindingIrSha256 = hashBindingIr(ir);
	const hosts=hostImports===null?null:javaScriptTaskHosts(ir,hostImports);
	if(!/^[0-9a-f]{64}$(?![\s\S])/u.test(componentIdentity) || !hosts && ir.capabilities.length)
		throw new TypeError("Expected an in-memory Wasm task component");
	const leases=ir.types.filter(t => t.kind!=="callback" && !(hosts && t.host)).map((t,i) => {
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
	const callbackTypes=new Map(), hostError="error:JavaScriptCallbackError";
	for(const t of ir.types.filter(t => t.kind==="callback"))
	{
		const c=t.callable, arg=c?.parameters[0], result=c?.result;
		if(t.source?.producer!=="lean" || t.source.declaration!==t.name || t.id!=="bridge:"+t.name
			|| t.representation!=="identity" || t.mutability!=="immutable" || t.resource!==null || t.host!==null || t.target!==null || t.fields.length || t.cases.length
			|| t.source.extensions?.["lean-bridge.dev/callback-scheduler"]!=="javascript-owner-agent" || c?.resultMode!=="promise" || c.reentry!=="same-agent"
			|| c.selfDisposal!=="defer" || c.invocation!=="many" || c.parameters.length!==1 || t.typeParameters.length
			|| arg.optional || arg.default!==null || arg.mutability!=="immutable" || ![arg,result].every(x => x.type?.kind==="primitive" && x.ownership==="copy" && x.lifetime===null)
			|| !same(c.effects,["async","fails","host-call"]) || c.failure.mode!=="declared" || !same(c.failure.errors,[hostError]) || c.failure.unexpected!=="poison-runtime"
			|| t.id!=="bridge:Retained_"+arg.type.name+"_to_"+result.type.name)
			throw new TypeError("Inconsistent retained JavaScript callback contract");
		callbackTypes.set(t.id,[shape(arg.type),shape(result.type)]);
	}
	const callback=t => t?.kind==="named" && callbackTypes.get(t.id);
	if(callbackTypes.size)
	{
		const failure=ir.errors.find(e => e.id===hostError);
		if(failure?.name!=="JavaScriptCallbackError" || failure.category!=="domain" || failure.payload!==null
			|| [...callbackTypes.keys()].some(id => !ir.declarations.some(d => d.parameters.some(p => p.type.kind==="named" && p.type.id===id))))
			throw new TypeError("Unbound retained JavaScript callback contract");
	}
	const valueShape=(t,level=0) => {
		const nominal=hosts?.nominal(t) ?? (level===0 && resource(t));
		if(nominal) return nominal.type;
		return level<32 && t?.kind==="apply" && t.constructor==="result" && t.arguments?.length===2
			? t.arguments.map(v=>valueShape(v,level+1)) : shape(t,level);
	};
	const methods = ir.declarations.map(d => {
		const declaration = d.source?.declaration, ext = d.source?.extensions ?? {};
		const effect = ext["lean-lang.org/effect"], task = ext["lean-lang.org/delivery"], protocol = ext["lean-bridge.dev/pull-protocol"];
		const terminal = ext["lean-bridge.dev/task-failure"], delivery = task ? "task" : protocol ? "async-iterator" : null;
		const mode = task ? "promise" : protocol ? "async-iterator" : "value";
		const phases=hosts?.method(d,Boolean(protocol)),stepIO=ext["lean-bridge.dev/step-failure"];
		const validSite=x=>{
			const cb=callback(x.type);
			if(cb && (!task || x===d.result)) return false;
			if(cb || hosts?.contains(x.type) || x===d.result && resource(x.type))
				return x.ownership==="lease" && x.lifetime?.scope==="explicit" && x.lifetime.anchor===null;
			if(resource(x.type)) return x.ownership==="borrow" && x.lifetime?.scope==="call" && x.lifetime.anchor===null;
			return x.ownership==="copy" && x.lifetime===null;
		};
		if(!declaration || d.source.producer !== "lean" || !["IO","EIO","BaseIO","pure"].includes(effect) || d.kind !== "function" || d.owner !== null
			|| d.receiver !== null || d.typeParameters.length || d.parameters.some(p => p.optional || p.default !== null || p.mutability
				!== (resource(p.type) ? effect!=="pure" || protocol ? "write" : "read" : hosts?.nominal(p.type)?.mutability ?? "immutable"))
			|| !hosts && d.capabilities.length || d.resultMode !== mode || d.failure.unexpected !== "poison-runtime"
			|| (task !== undefined && (task !== "Task" || protocol)) || (protocol !== undefined && (!protocol || protocol.open !== declaration
				|| ![protocol.next,protocol.close].every(n => typeof n === "string" && n.length)
				|| new Set([protocol.open,protocol.next,protocol.close]).size !== 3))
			|| (terminal !== undefined && (terminal !== "IO.Error" || !task)) || stepIO!==undefined && (!hosts || !protocol || stepIO!=="IO.Error")
			|| !hosts && (ext["lean-bridge.dev/host-members"]?.length || ext["lean-bridge.dev/host-imports-sha256"] || ext["lean-bridge.dev/host-member-phases"])
			|| ext["lean-bridge.dev/native-effects-v1"]
			|| ![...d.parameters,d.result].every(validSite))
			throw new TypeError("Inconsistent copied Wasm task declaration: " + d.id);
		const startId = effect === "IO" ? "error:IO.Error" : effect === "EIO" ? "error:EIO."+declaration : null;
		const step = "error:AsyncStep."+declaration;
		const terminalId = terminal ? "error:TaskIO.Error" : protocol && d.failure.errors.includes(step) ? step : null;
		const callbacks=d.parameters.flatMap((p,i) => callback(p.type) ? [[i,...callback(p.type)]] : []);
		const memberEscapes=phases && ((effect==="IO" || terminal) && phases.call.length || stepIO && phases.pull.length);
		if((stepIO && !terminalId) || d.failure.mode!==(d.failure.errors.length?"declared":"none")
			|| !same([...d.failure.errors].sort(),[startId,terminalId,memberEscapes?jsMemberFailure:null,callbacks.length && (effect==="IO" || terminal) ? hostError : null].filter(Boolean).sort()))
			throw new TypeError("Inconsistent Wasm task failure channels: " + d.id);
		const errorShape = id => {
			if(!id) return null;
			const error = ir.errors.find(x => x.id === id);
			if(!error) throw new TypeError("Missing declared error: "+id);
			if(["error:IO.Error","error:TaskIO.Error"].includes(id) || stepIO && id===step)
			{
				if(error.payload !== null) throw new TypeError("Unexpected typed payload for "+id);
				return "string";
			}
			return valueShape(error.payload);
		};
		const result = valueShape(d.result.type), args = d.parameters.map(p => callback(p.type) ? "callback" : valueShape(p.type));
		const error = errorShape(startId), terminalShape = errorShape(terminalId);
		hosts?.checkErrorSite(ext["lean-bridge.dev/error-payload-site"],ir.errors.find(e=>e.id===startId)?.payload);
		hosts?.checkErrorSite(ext["lean-bridge.dev/step-error-payload-site"],ir.errors.find(e=>e.id===terminalId)?.payload);
		if(args.some(Array.isArray)) throw new TypeError("Wasm task arguments must be copied scalars or nominal leases");
		return {id: d.id
			, name: d.name
			, declaration
			, args
			, ...callbacks.length ? {callbacks} : {}
			, ...(phases ? {hostPhases: phases} : {})
			, ...(stepIO ? {stepIO: true} : {})
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
	hosts?.finish();
	return {profile: "javascript-wasm-threaded-task-v1",componentIdentity,bindingIrSha256,controlSymbol: "lb_js_task_"+componentIdentity,methods,...leases.length ? {leases} : {},...hosts?{hostIrSha256: hosts.hash}:{}};
};
