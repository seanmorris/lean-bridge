/** @file Check binding-owned Lean function identities in single-threaded and worker Wasm. */
import {canonicalizeJsonValue} from "../binding-ir/canonical.mjs";
import {sha256Text} from "../binding-ir/sha256.mjs";
import {hostDeclarationName} from "./host-member-names.mjs";
const fail=()=>{throw new TypeError("Inconsistent Wasm returned Lean function contract");};
const same=(a,b)=>canonicalizeJsonValue(a)===canonicalizeJsonValue(b);
/**
 * Authenticate a returned Lean function against the factory, its member imports
 * and its owner. Never use a host-supplied retained callback as this type.
 *
 * @param api - Checked public binding IR.
 * @param hosts - Independent host import contract.
 * @param imports - Verified hash of the host contract.
 * @param d - The public factory declaration.
 * @param t - Its candidate returned callable definition.
 * @param shape - Lower a validated scalar or host resource for the active ABI.
 * @param zend - The independent PHP interpreter owns these members and exceptions.
 */
export const checkedWasmHostFunction=(api,hosts,imports,d,t,shape,zend=false)=>{
	const decl=d.source.declaration,x=d.source.extensions,c=t.callable,p=c?.parameters[0];
	const memberNames=x["lean-bridge.dev/host-members"],members=new Map(hosts.declarations.map(m=>{
		const owner=hosts.types.find(k=>k.id===m.owner);
		return [(zend?"LeanBridge.Host.Php.":"LeanBridge.Host.Javascript.")+owner.name+"."+hostDeclarationName(m),m];
	}));
	if(x["lean-lang.org/effect"]!=="IO" || !p || c.parameters.length!==1 || !c.result
		|| d.source.producer!=="lean" || d.result.ownership!=="lease" || !same(d.result.lifetime,{scope: "explicit",anchor: null})
		|| new Set(memberNames).size!==memberNames.length || memberNames.some(n=>!members.has(n))) fail();
	const argument=p.type,reply=c.result.type,a=shape(argument),r=shape(reply);
	const checkSite=site=>{
		const nominal=site.type.kind==="named" && hosts.types.find(k=>k.id===site.type.id);
		if(!nominal && site.type.kind!=="primitive" || site.ownership!==(nominal?"lease":"copy")
			|| !same(site.lifetime,nominal?{scope: "explicit",anchor: null}:null)) fail();
	};
	checkSite(p);checkSite(c.result);
	const capabilities=[...new Set(memberNames.flatMap(n=>members.get(n).capabilities))].sort();
	const effects=[...new Set(["fails","nondeterministic",...memberNames.flatMap(n=>members.get(n).effects)])].sort();
	const owner=zend?"php-wasm-zend-binding":"javascript-host-binding",errors=["error:IO.Error",...memberNames.length?[zend?"error:PhpHostException":"error:JavaScriptHostException"]:[]];
	const key={component: api.component,declaration: decl,argument,reply,imports,capabilities,errors,owner};
	// The compiler's capsule identity is sorted, pretty-printed JSON with a final newline.
	const hash=sha256Text(JSON.stringify(JSON.parse(canonicalizeJsonValue(key)),null,2)+"\n"),name="LeanClosure"+hash.slice(0,20);
	if(t.name!==name || t.id!=="bridge:"+name || t.kind!=="callback" || t.representation!=="identity" || t.mutability!=="immutable"
		|| t.host!==null || t.resource!==null || t.target!==null || t.typeParameters.length || t.fields.length || t.cases.length || t.assurance.length
		|| !same(t.source,{producer: "lean",declaration: decl,extensions: {"lean-bridge.dev/closure-owner": owner,"lean-bridge.dev/required-capabilities": capabilities}})
		|| !same(d.capabilities,capabilities) || !same(d.effects,[...new Set(["allocates",...effects])].sort())
		|| c.resultMode!=="value" || c.invocation!=="many" || c.selfDisposal!=="defer" || c.reentry!=="same-agent"
		|| p.name!=="value" || p.optional || p.default!==null || p.mutability!==(hosts.types.find(k=>k.id===argument.id)?.mutability??"immutable")
		|| !same(c.effects,effects) || !same(c.failure,{mode: "declared",errors,unexpected: "poison-runtime"})) fail();
	return {argument: a,reply: r,hash};
};

/**
 * Derive private invocation and lease names for the worker's existing ledger.
 * These names are not constructors or resources in the host API.
 *
 * @param hash - Source-checked function identity.
 */
export const workerFunctionNames=hash=>{
	if(!/^[a-f0-9]{64}$(?![\s\S])/u.test(hash)) fail();
	const ns="BridgeHostFactory"+hash,name="Fn"+hash;
	return {name,lean: ns+"."+name,apply: ns+".apply",wireName: "bridge_apply_"+hash,type: "lease:"+hash};
};
/**
 * Append private application sites in factory order.
 *
 * @param abi - Checked public method inventory.
 */
export const wasmWorkerMethods=abi=>{
	const calls=abi.methods.filter(m=>m.returnedFunction).map(m=>{
		const {returnedFunction: f,...base}=m,n=workerFunctionNames(f.hash);
		return {...base,name: n.wireName,declaration: n.apply,id: "private:"+n.apply,args: [n.type,f.argument],result: f.reply};
	});
	return [...abi.methods,...calls];
};
/**
 * Append private function leases after all declared resource kinds.
 *
 * @param abi - Checked public lease kinds and factory inventory.
 */
export const wasmWorkerLeases=abi=>{
	const leases=abi.leases??[];
	const functions=abi.methods.filter(m=>m.returnedFunction).map((m,i)=>{
		const {hash}=m.returnedFunction,n=workerFunctionNames(hash);
		return {name: n.name,id: "lean:"+n.lean,type: n.type,hash,tag: 3+leases.length+i};
	});
	return [...leases,...functions];
};
