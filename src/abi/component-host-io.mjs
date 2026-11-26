/** @file Source-bound public call shapes for synchronous JavaScript host imports. */
import { canonicalizeJsonValue, hashBindingIr } from "../binding-ir/canonical.mjs";
import { validateOwnedAggregateBindingIr } from "../binding-ir/contract.mjs";
import { sha256Text } from "../binding-ir/sha256.mjs";
import { componentScalarTypes } from "./component-scalars.mjs";
import { checkedWasmHostFunction } from "./wasm-host-factories.mjs";

export const componentHostIOAbi = 17;
// ABI 17 delivers exactly one leaf per successful call. Record publication
// needs a vector of leaves and a single commit point in both the guest and host.
export const componentHostRecordIOAbi = 19;
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
 * @param [zend] - Require PHP-owned classes, failures and returned functions on the standalone heap.
 */
export const javaScriptHostIOAbi = (api,hosts,identity,zend=false) => {
	const compound=api.schemaVersion===4;
	if(compound && zend) fail();
	const bindingIrSha256=compound?sha256Text(canonicalizeJsonValue(validateOwnedAggregateBindingIr(api))):hashBindingIr(api);
	const hostIrSha256=hashBindingIr(hosts),nominals=api.types.filter(t=>t.host);
	const target=zend?"php":"javascript",module=zend?"LeanBridge.Host.Php":"LeanBridge.Host.Javascript";
	const functions=new Map(api.types.filter(t=>!t.host && (!compound || t.kind!=="record")).map(t=>[t.id,t]));
	if(!/^[a-f0-9]{64}$(?![\s\S])/u.test(identity) || api.capabilities.length || !hosts.types.length
		|| nominals.length!==hosts.types.length || !api.declarations.length) fail();
	for(const [i,t] of hosts.types.entries())
	{
		const p=nominals[i];
		if(t.kind!=="resource" || !t.host?.targets.includes(target) || t.host.dynamic
			|| p.id!==t.id || p.name!==t.name || !same(p.resource,t.resource) || p.host?.identity!==t.host.identity
			|| !same(p.host.targets,[target]) || p.source.declaration!==module+"."+t.name) fail();
	}
	const shape=(t,level=0)=>{
		if(t?.kind==="primitive" && componentScalarTypes.includes(t.name)) return t.name;
		if(t?.kind==="named")
		{ const i=hosts.types.findIndex(k=>k.id===t.id);if(i>=0) return i; }
		if(level<32 && t?.kind==="apply" && t.constructor==="result" && t.arguments.length===2) return t.arguments.map(v=>shape(v,level+1));
		return fail();
	};
	const names=new Set(["withHosts","dispose","then","constructor","__proto__","prototype"]);
	const records=new Map(),used=new Set();
	if(compound)
	{
		for(const t of api.types.filter(v=>!v.host && v.kind==="record"))
		{
			const decl=t.source.declaration;
			if(t.id!=="lean:"+decl || t.name!==decl.split(".").at(-1) || names.has(t.name)
				|| t.representation!=="owned" || t.mutability!=="immutable" || t.typeParameters.length
				|| t.source.producer!=="lean" || !t.source.extensions["lean-bridge.dev/record-constructor"]?.startsWith(decl+".")
				|| !same(t.aggregate,{ownership: "lease",disposal: "required",fallback: "none",cycles: "reject"})
				|| !t.fields.length || t.fields.length>64) fail();
			const fieldNames=new Set(["dispose","then","constructor","__proto__","prototype"]);
			const fields=t.fields.map(f=>{
				if(fieldNames.has(f.name) || !/^[a-z][a-z0-9_]*$/u.test(f.name) || f.mutability!=="immutable") fail();
				fieldNames.add(f.name);
				const type=shape(f.type);
				if(Array.isArray(type)) fail();
				return {name: f.name,type};
			});
			if(!fields.some(f=>typeof f.type==="number")) fail();
			names.add(t.name);records.set(t.id,{type: "record:"+t.id,name: t.name,fields});
		}
		if(!records.size) fail();
	}
	const at=(site,input,effect)=>{
		const record=site.type.kind==="named" && records.get(site.type.id);
		if(record)
		{
			if(effect!=="IO" || site.ownership!==(input?"borrow":"lease") || !same(site.lifetime,{scope: input?"call":"explicit",anchor: null})) fail();
			used.add(site.type.id);return record.type;
		}
		const t=shape(site.type);checkSite(site,t);return t;
	};
	const methods=api.declarations.map(d=>{
		const x=d.source.extensions,effect=x["lean-lang.org/effect"],decl=d.source.declaration;
		if(!["IO","EIO","BaseIO","pure"].includes(effect) || x["lean-bridge.dev/host-imports-sha256"]!==hostIrSha256
			|| !Array.isArray(x["lean-bridge.dev/host-members"]) || d.kind!=="function" || d.owner!==null || d.resultMode!=="value"
			|| d.id!=="lean:"+decl || d.capabilities.length || d.typeParameters.length || d.parameters.length>64 || d.failure.unexpected!=="poison-runtime"
			|| d.effects.includes("async") || Object.hasOwn(x,"lean-lang.org/delivery") || Object.hasOwn(x,"lean-bridge.dev/native-effects-v1")
			|| !/^[a-z][a-z0-9_]*$/u.test(d.name) || names.has(d.name)) fail();
		names.add(d.name);
		const args=d.parameters.map(p=>{const t=at(p,true,effect); if(Array.isArray(t) || p.optional || p.default!==null) fail();return t;});
		if(d.parameters.reduce((n,p)=>n+(records.get(p.type.id)?.fields.length??1),0)>64) fail();
		const fn=d.result.type.kind==="named" && functions.get(d.result.type.id);
		const result=fn?checkedWasmHostFunction(api,hosts,hostIrSha256,d,fn,shape,zend):at(d.result,false,effect);
		if(fn) functions.delete(fn.id);
		const errorId=effect==="EIO"?"error:EIO."+decl:effect==="IO"?"error:IO.Error":null;
		const expected=errorId?[errorId]:[];
		if(effect==="IO" && x["lean-bridge.dev/host-members"].length) expected.push(zend?"error:PhpHostException":"error:JavaScriptHostException");
		if(d.failure.mode!==(errorId?"declared":"none") || !same(d.failure.errors,expected)) fail();
		const payload=effect==="EIO"?api.errors.find(e=>e.id===errorId)?.payload:null;
		const error=effect==="EIO"?shape(payload):null,site=x["lean-bridge.dev/error-payload-site"];
		if(nominal(error))
		{if(!site || !same(site.type,payload)) fail();checkSite(site,error);}
		else if(site!==undefined) fail();
		return {id: d.id,name: d.name,declaration: decl,args,result,effect,errorId,error};
	});
	if(functions.size || used.size!==records.size) fail();
	const key=sha256Text((zend?"php-wasm-zend-host-io-v1":compound?"javascript-wasm-host-record-io-v1":"javascript-wasm-host-io-v1")+":"+identity+":"+bindingIrSha256+":"+hostIrSha256);
	return {version: compound?componentHostRecordIOAbi:componentHostIOAbi,...compound?{records: [...records.values()]}:{},...zend?{owner: "php-wasm-zend"}:{},componentIdentity: identity,bindingIrSha256,hostIrSha256,controlSymbol: "lbjs_component_"+key.slice(0,20)+"_control",methods};
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
	if(![componentHostIOAbi,componentHostRecordIOAbi].includes(abi.version) || !/^lbjs_component_[a-f0-9]{20}_control$(?![\s\S])/u.test(abi.controlSymbol)
		|| !/^[a-f0-9]{64}$(?![\s\S])/u.test(abi.componentIdentity)) fail();
	const check=async(bytes,required,allowed,imports)=>{
		const module=await WebAssembly.compile(bytes), rows=WebAssembly.Module.imports(module);
		const heap=rows.filter(r=>r.kind==="memory" || r.kind==="table").map(r=>r.kind+":"+r.module+":"+r.name).sort();
		const exports=WebAssembly.Module.exports(module).map(r=>r.kind+":"+r.name);
		const missing=required.filter(name=>!exports.includes(name)),extra=exports.filter(name=>!allowed.has(name));
		const missingImports=imports.filter(name=>!rows.some(r=>r.kind==="function" && r.module==="env" && r.name===name));
		if(!same(heap,["memory:env:memory","table:env:__indirect_function_table"]) || missing.length || extra.length || missingImports.length)
			throw Object.assign(new Error("Unexpected JavaScript host Wasm interface: "+JSON.stringify({heap,missing,extra,missingImports})),{details: {heap,exports,imports: rows.filter(r=>r.name.startsWith("lb_jsh_domain_")).map(r=>r.name)}});
	};
	const std=["function:__wasm_call_ctors","function:__wasm_apply_data_relocs"];
	const prefix="global:__em_js__lb_jsh_"+abi.componentIdentity+"_";
	const main=["function:"+abi.controlSymbol,prefix+"deliver"];
	await check(binary,main,new Set([...std,...main,...["kind","send","finish","record"].map(s=>prefix+s)]),["lb_jsh_domain_enter_v1","lb_jsh_domain_leave_v1"]);
	const services=javaScriptHostBrokerSymbols.map(s=>"function:"+s);
	await check(broker,services,new Set([...std,...services,...["attach","detach","strong","discard"].map(s=>"global:__em_js__lb_jsh_"+s+"_js")]),[]);
};
