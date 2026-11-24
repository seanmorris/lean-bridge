/** @file Reconstruct the threaded member boundary from the import IR, independently of the producer. */
import {canonicalizeJsonValue,hashBindingIr} from "../binding-ir/canonical.mjs";
import {javaScriptHostMembers} from "../backends/javascript/host-members.mjs";
import {hostDeclarationName} from "./host-member-names.mjs";

const same=(a,b)=>canonicalizeJsonValue(a)===canonicalizeJsonValue(b);
const fail=()=>{throw new TypeError("Inconsistent threaded JavaScript host import contract");};
const distinct=a=>[...new Set(a)].sort();
export const jsMemberFailure="error:JavaScriptHostException";

/**
 * Bind source nominal types and used member phases to a separate host contract.
 * No component-local ordinal, public name or type claim alone grants dispatch.
 *
 * @param api - Compiler-checked application functions.
 * @param hosts - Original, independently hashed import contract.
 */
export const javaScriptTaskHosts=(api,hosts)=>{
	const model=javaScriptHostMembers(hosts),hash=hashBindingIr(hosts),projected=api.types.filter(t=>t.host);
	if(projected.length!==hosts.types.length) fail();
	const named=new Map(),members=new Map();
	for(const [i,t] of hosts.types.entries())
	{
		const p=projected[i],lean="LeanBridge.Host.Javascript."+t.name;
		const expected={...t,assurance: [],host: {...t.host,targets: ["javascript"]},source: {producer: "lean",declaration: lean,extensions: {}}};
		if(!same({...p,documentation: t.documentation},expected)) fail();
		named.set(t.id,{index: i,type: "host:"+model.kinds[i].key,mutability: t.mutability});
		for(const d of hosts.declarations.filter(d=>d.owner===t.id))
			members.set(lean+"."+hostDeclarationName(d),d);
	}
	const nominal=t=>t?.kind==="named"?named.get(t.id):undefined;
	const contains=t=>Boolean(nominal(t) || t?.kind==="apply" && t.constructor==="result" && t.arguments.some(contains));
	const checkErrorSite=(site,type)=>{
		if(contains(type))
		{
			if(!site || site.ownership!=="lease" || !same(site.type,type) || !same(site.lifetime,{scope: "explicit",anchor: null})) fail();
		} else if(site!==undefined) fail();
	};
	const usedCaps=new Set(),publicNames=new Set(["withHosts","dispose","then","constructor","__proto__","prototype"]);
	const method=(d,cursor)=>{
		const x=d.source.extensions,phases=x["lean-bridge.dev/host-member-phases"];
		if(!/^[a-z][a-z0-9_]*$/u.test(d.name) || publicNames.has(d.name) || d.id!=="lean:"+d.source.declaration) fail();
		publicNames.add(d.name);
		if(x["lean-bridge.dev/host-imports-sha256"]!==hash || !phases || !same(Object.keys(phases).sort(),cursor?["call","close","pull"]:["call"])) fail();
		for(const names of Object.values(phases))
			if(!Array.isArray(names) || !same(distinct(names),names) || names.some(n=>!members.has(n))) fail();
		const used=distinct(Object.values(phases).flat());
		if(!same(x["lean-bridge.dev/host-members"],used)) fail();
		const caps=distinct(used.flatMap(n=>members.get(n).capabilities));
		if(!same(d.capabilities,caps)) fail();
		for(const cap of caps) usedCaps.add(cap);
		return phases;
	};
	const finish=()=>{
		if(!same(api.capabilities.map(c=>c.id).sort(),[...usedCaps].sort())) fail();
		for(const c of api.capabilities)
		{
			const h=hosts.capabilities.find(k=>k.id===c.id);
			if(!h || c.id.startsWith("capability:native.") || !same({...c,documentation: h.documentation},h)) fail();
		}
		const f=api.errors.find(e=>e.id===jsMemberFailure);
		if(Boolean(f)!==api.declarations.some(d=>d.failure.errors.includes(jsMemberFailure))
			|| f && (f.category!=="domain" || f.name!=="JavaScriptHostException" || f.payload!==null)) fail();
	};
	return {hash,nominal,contains,checkErrorSite,method,finish};
};
