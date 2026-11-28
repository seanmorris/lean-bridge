/** @file Derive the owner-agent dispatch table from an authored JavaScript host contract. */
import {componentScalarTypes} from "../../abi/component-scalars.mjs";
import {validateBindingIr} from "../../binding-ir/contract.mjs";
import {sha256Text} from "../../binding-ir/sha256.mjs";
import {hostMemberSymbol} from "../../abi/host-member-names.mjs";

const identifier=/^[A-Za-z][A-Za-z0-9_]*$/u;
const fail=message=>{ throw new TypeError("JavaScript host members: "+message); };

/**
 * Produce data for the generated Wasm externs and their matching JS dispatch.
 * Nominal keys span independently built components using the same contract;
 * slot numbers are local to this component.
 *
 * @param ir - Validated application-owned host interface.
 */
export const javaScriptHostMembers = ir => {
	validateBindingIr(ir);
	const types=ir.types;
	if(!types.length || types.length>64 || types.some(t=>t.kind!=="resource"
		|| !identifier.test(t.name) || !t.host?.targets.includes("javascript") || t.host.dynamic))
		fail("expected statically declared host classes");
	if(new Set(types.map(t=>t.name)).size!==types.length || new Set(types.map(t=>t.resource.kindId)).size!==types.length)
		fail("duplicate class name or nominal kind");
	// This array contains only strings. Keep the original pretty JSON + LF
	// hash so browser consumers and already compiled nominal keys agree.
	const kinds=types.map(t=>({name: t.name,policy: t.host.identity,key: sha256Text(JSON.stringify([ir.component.id,t.id,t.resource.kindId],null,2)+"\n")}));
	const carrier=site=>{
		const type=site.type;
		if(type.kind==="primitive" && componentScalarTypes.includes(type.name) && site.ownership==="copy" && site.lifetime===null) return type.name;
		const i=types.findIndex(t=>t.id===type.id);
		if(type.kind!=="named" || i<0) fail("unsupported member carrier");
		return i;
	};
	const selectors=new Set(), symbols=new Set();
	const members=ir.declarations.map(d=>{
		const owner=types.findIndex(t=>t.id===d.owner), self=["method","property"].includes(d.kind);
		if(owner<0 || !identifier.test(d.name) || ["__proto__","prototype","constructor"].includes(d.name)
			|| !["constructor","method","static-method","property"].includes(d.kind) || d.resultMode!=="value"
			|| d.typeParameters.length || d.parameters.length>63 || d.parameters.some(p=>p.optional || p.default!==null)
			|| self!==Boolean(d.receiver) || (self && carrier(d.receiver)!==owner)) fail("invalid synchronous member "+d.id);
		const op=d.kind==="property"?(d.parameters.length?"set":"get"):d.kind;
		const sites=self?[d.receiver,...d.parameters]:d.parameters;
		const args=sites.map(carrier), result=carrier(d.result), symbol=hostMemberSymbol("javascript",types[owner],d);
		for(const [i,s] of sites.entries())
		{
			if(typeof args[i]!=="number") continue;
			const scope=s.lifetime?.scope;
			if(s.lifetime?.anchor!==null || !(s.ownership==="borrow"?scope==="call"
				:["lease","transfer"].includes(s.ownership) && ["call","explicit"].includes(scope))) fail("invalid nominal argument lifetime");
		}
		if(typeof result==="number" && d.result.ownership!=="borrow"
			&& (!["transfer","lease"].includes(d.result.ownership) || d.result.lifetime?.scope!=="explicit"))
			fail("invalid nominal result lifetime");
		if((op==="constructor" && result!==owner) || (op==="set" && (d.parameters.length!==1 || result!=="unit"))) fail("invalid constructor or property setter");
		const key=owner+":"+(op==="constructor"?"constructor":op==="static-method"?"static:":"instance:")+(op==="constructor"?"":d.name);
		const form=op==="set"?"set":"read";
		if(symbols.has(symbol) || selectors.has(key+":"+form) || (op==="set" && selectors.has(key+":method")) || (op==="method" && selectors.has(key+":set"))) fail("ambiguous member "+d.id);
		selectors.add(key+":"+form); if(op==="method") selectors.add(key+":method"); symbols.add(symbol);
		let anchor=null;
		if(typeof result==="number" && d.result.ownership==="borrow")
		{
			const lifetime=d.result.lifetime;
			anchor=lifetime?.scope==="receiver" && self && lifetime.anchor==="receiver"?0
				:lifetime?.scope==="parameter"?sites.findIndex((s,i)=>(!self || i>0) && s.name===lifetime.anchor):-1;
			if(anchor<0 || typeof args[anchor]!=="number") fail("borrowed result lacks a nominal anchor");
		}
		return {id: d.id,symbol,op,name: d.name,owner,args,result,anchor
			, inputOwnership: sites.map(s=>s.ownership)
			, resultOwnership: d.result.ownership};
	});
	return {kinds,members};
};
