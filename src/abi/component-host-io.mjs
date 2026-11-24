/** @file Source-bound public call shapes for synchronous JavaScript host imports. */
import { canonicalizeJsonValue, hashBindingIr } from "../binding-ir/canonical.mjs";
import { sha256Text } from "../binding-ir/sha256.mjs";
import { componentScalarTypes } from "./component-scalars.mjs";

export const componentHostIOAbi = 17;
export const hostCallMagic = 0x4a484331;
export const javaScriptHostBrokerSymbols=Object.freeze(["token","wrap","admit","enter","leave","error","control"].map(s=>"lb_jsh_domain_"+s+"_v1"));
const fail = () => { throw new TypeError("Inconsistent JavaScript host export contract"); };
const same = (a,b) => canonicalizeJsonValue(a) === canonicalizeJsonValue(b);
const nominal = s => typeof s==="number" || (Array.isArray(s) && s.some(nominal));
const checkSite = (s,t) => {
	const lease=nominal(t);
	if(s.ownership!==(lease?"lease":"copy") || !same(s.lifetime,lease?{scope: "explicit",anchor: null}:null)) fail();
};
/**
 * Derive the descriptor from independently checked public and import IR, not
 * a packaged list of C signatures. Nested arrays are the two Except branches
 * (ok first); a number is a component-local nominal class index.
 *
 * @param api - Public IR reconstructed from the selected Lean functions.
 * @param hosts - Authored host-import IR for this component.
 * @param identity - Compiler and source identity of the side module.
 */
export const javaScriptHostIOAbi = (api,hosts,identity) => {
	const bindingIrSha256=hashBindingIr(api),hostIrSha256=hashBindingIr(hosts);
	if(!/^[a-f0-9]{64}$(?![\s\S])/u.test(identity) || api.capabilities.length || !hosts.types.length
		|| api.types.length!==hosts.types.length || !api.declarations.length) fail();
	for(const [i,t] of hosts.types.entries())
	{
		const p=api.types[i];
		if(t.kind!=="resource" || !t.host?.targets.includes("javascript") || t.host.dynamic
			|| p.id!==t.id || p.name!==t.name || !same(p.resource,t.resource) || p.host?.identity!==t.host.identity
			|| !same(p.host.targets,["javascript"]) || p.source.declaration!=="LeanBridge.Host.Javascript."+t.name) fail();
	}
	const shape=(t,level=0)=>{
		if(t?.kind==="primitive" && componentScalarTypes.includes(t.name)) return t.name;
		if(t?.kind==="named")
		{ const i=hosts.types.findIndex(k=>k.id===t.id);if(i>=0) return i; }
		if(level<32 && t?.kind==="apply" && t.constructor==="result" && t.arguments.length===2) return t.arguments.map(v=>shape(v,level+1));
		return fail();
	};
	const names=new Set(["withHosts","dispose","then","constructor","__proto__","prototype"]);
	const methods=api.declarations.map(d=>{
		const x=d.source.extensions,effect=x["lean-lang.org/effect"],decl=d.source.declaration;
		if(!["IO","EIO","BaseIO","pure"].includes(effect) || x["lean-bridge.dev/host-imports-sha256"]!==hostIrSha256
			|| !Array.isArray(x["lean-bridge.dev/host-members"]) || d.kind!=="function" || d.owner!==null || d.resultMode!=="value"
			|| d.id!=="lean:"+decl || d.capabilities.length || d.typeParameters.length || d.parameters.length>64 || d.failure.unexpected!=="poison-runtime"
			|| d.effects.includes("async") || Object.hasOwn(x,"lean-lang.org/delivery") || Object.hasOwn(x,"lean-bridge.dev/native-effects-v1")
			|| !/^[a-z][a-z0-9_]*$/u.test(d.name) || names.has(d.name)) fail();
		names.add(d.name);
		const args=d.parameters.map(p=>{const t=shape(p.type); if(Array.isArray(t) || p.optional || p.default!==null) fail(); checkSite(p,t);return t;});
		const result=shape(d.result.type);checkSite(d.result,result);
		const errorId=effect==="EIO"?"error:EIO."+decl:effect==="IO"?"error:IO.Error":null;
		const expected=errorId?[errorId]:[];
		if(effect==="IO" && x["lean-bridge.dev/host-members"].length) expected.push("error:JavaScriptHostException");
		if(d.failure.mode!==(errorId?"declared":"none") || !same(d.failure.errors,expected)) fail();
		const payload=effect==="EIO"?api.errors.find(e=>e.id===errorId)?.payload:null;
		const error=effect==="EIO"?shape(payload):null,site=x["lean-bridge.dev/error-payload-site"];
		if(nominal(error))
		{if(!site || !same(site.type,payload)) fail();checkSite(site,error);}
		else if(site!==undefined) fail();
		return {id: d.id,name: d.name,declaration: decl,args,result,effect,errorId,error};
	});
	const key=sha256Text("javascript-wasm-host-io-v1:"+identity+":"+bindingIrSha256+":"+hostIrSha256);
	return {version: componentHostIOAbi,componentIdentity: identity,bindingIrSha256,hostIrSha256,controlSymbol: "lbjs_component_"+key.slice(0,20)+"_control",methods};
};

/**
 * Check both dynamic interfaces before linking either module. The compiler-
 * bound control is the only component call entry; EM_JS data globals install
 * the named private hooks, never extra public operations.
 *
 * @param binary - Integrity-checked application module bytes.
 * @param broker - Matching shared identity broker.
 * @param abi - Descriptor independently rederived from the two IR documents.
 */
export const validateJavaScriptHostModules = async (binary,broker,abi) => {
	if(abi.version!==componentHostIOAbi || !/^lbjs_component_[a-f0-9]{20}_control$(?![\s\S])/u.test(abi.controlSymbol)
		|| !/^[a-f0-9]{64}$(?![\s\S])/u.test(abi.componentIdentity)) fail();
	const check=async(bytes,required,allowed,imports)=>{
		const module=await WebAssembly.compile(bytes), rows=WebAssembly.Module.imports(module);
		const heap=rows.filter(r=>r.kind==="memory" || r.kind==="table").map(r=>r.kind+":"+r.module+":"+r.name).sort();
		const exports=WebAssembly.Module.exports(module).map(r=>r.kind+":"+r.name);
		if(!same(heap,["memory:env:memory","table:env:__indirect_function_table"])
			|| required.some(name=>!exports.includes(name)) || exports.some(name=>!allowed.has(name))
			|| imports.some(name=>!rows.some(r=>r.kind==="function" && r.module==="env" && r.name===name)))
			throw Object.assign(new Error("Unexpected JavaScript host Wasm interface"),{details: {heap,exports,imports: rows.filter(r=>r.name.startsWith("lb_jsh_domain_")).map(r=>r.name)}});
	};
	const std=["function:__wasm_call_ctors","function:__wasm_apply_data_relocs"];
	const prefix="global:__em_js__lb_jsh_"+abi.componentIdentity+"_";
	const main=["function:"+abi.controlSymbol,prefix+"deliver"];
	await check(binary,main,new Set([...std,...main,...["kind","send","finish","record"].map(s=>prefix+s)]),["lb_jsh_domain_enter_v1","lb_jsh_domain_leave_v1"]);
	const services=javaScriptHostBrokerSymbols.map(s=>"function:"+s);
	await check(broker,services,new Set([...std,...services,...["attach","detach","strong","discard"].map(s=>"global:__em_js__lb_jsh_"+s+"_js")]),[]);
};
