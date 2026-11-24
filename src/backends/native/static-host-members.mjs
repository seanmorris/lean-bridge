/** @file Resolve native application-owned host members, their externs, and their borrow anchors. */
import {componentScalarTypes} from "../../abi/component-scalars.mjs";
import {hostMemberSymbol} from "../../abi/host-member-names.mjs";
import {validateBindingIr} from "../../binding-ir/contract.mjs";
import {sha256Text} from "../../binding-ir/sha256.mjs";

const identifier=/^[A-Za-z][A-Za-z0-9_]*$(?![\s\S])/u;

/**
 * Resolve only synchronous, statically declared members. C names are normalized
 * by the Lean extern ABI; PHP also folds method names but not property names.
 *
 * @param ir - Original, captured import contract, not the public application API.
 * @param target - Native host owning these resources.
 */
export const staticHostMembers=(ir,target)=>{
	if(target!=="php" && target!=="c") throw new TypeError("Unsupported native member owner");
	const label=target==="c"?"C":"PHP";
	const fail=why=>{throw new TypeError(label+" host members: "+why);};
	validateBindingIr(ir);
	const types=ir.types;
	if(!types.length || types.length>64 || types.some(t=>t.kind!=="resource" || t.typeParameters.length
		|| !identifier.test(t.name) || !t.host?.targets.includes(target) || t.host.dynamic)
		|| new Set(types.map(t=>t.name.toLowerCase())).size!==types.length
		|| new Set(types.map(t=>t.resource.kindId)).size!==types.length) fail("expected distinct statically declared "+label+" classes");
	const kinds=types.map(t=>({name: t.name,key: sha256Text(JSON.stringify([...(target==="c"?["lean-bridge/c-host-object/v1"]:[]),ir.component.id,t.id,t.resource.kindId],null,2)+"\n"),identity: t.host.identity}));
	const carrier=s=>{
		const t=s.type;
		if(t.kind==="primitive" && componentScalarTypes.includes(t.name) && s.ownership==="copy" && s.lifetime===null) return t.name;
		const index=t.kind==="named"?types.findIndex(k=>k.id===t.id):-1;
		if(index<0) fail("unsupported member value or ownership");
		return index;
	};
	const symbols=new Set(),selectors=new Set();
	const members=ir.declarations.map(d=>{
		const owner=types.findIndex(t=>t.id===d.owner), self=d.kind==="method" || d.kind==="property";
		if(owner<0 || !identifier.test(d.name) || d.resultMode!=="value" || d.typeParameters.length || d.parameters.length>63
			|| !["method","property","static-method","constructor"].includes(d.kind) || self!==Boolean(d.receiver)
			|| self && carrier(d.receiver)!==owner || d.parameters.some(p=>p.optional || p.default!==null)) fail("invalid synchronous member "+d.id);
		const op=d.kind==="property"?(d.parameters.length?"set":"get"):d.kind;
		const sites=self?[d.receiver,...d.parameters]:d.parameters, args=sites.map(carrier),result=carrier(d.result);
		if(op==="constructor" && result!==owner || op==="set" && (d.parameters.length!==1 || result!=="unit")) fail("invalid constructor or setter");
		if(target==="c" && !d.effects.includes("host-call")) fail("missing host-call effect: "+d.id);
		const symbol=hostMemberSymbol(target,types[owner],d);
		const selector=target==="c"?symbol:owner+":"+(op==="constructor"?"new":d.kind==="property"?op+":"+d.name:"method:"+d.name.toLowerCase());
		if(symbols.has(symbol) || selectors.has(selector)) fail("ambiguous member "+d.id);
		symbols.add(symbol);selectors.add(selector);
		for(const [i,s] of sites.entries()) if(typeof args[i]==="number"
			&& (s.lifetime?.anchor!==null || !(s.ownership==="borrow"?s.lifetime.scope==="call"
				:["lease","transfer"].includes(s.ownership) && ["explicit","call"].includes(s.lifetime.scope)))) fail("invalid nominal argument lifetime");
		let anchor=null;
		if(typeof result==="number")
		{
			const {ownership,lifetime}=d.result;
			if(ownership==="borrow")
			{
				anchor=self && lifetime?.scope==="receiver" && lifetime.anchor==="receiver"?0
					:lifetime?.scope==="parameter"?sites.findIndex((s,i)=>(!self || i>0) && s.name===lifetime.anchor):-1;
				if(anchor<0 || typeof args[anchor]!=="number") fail("borrowed result lacks a nominal anchor");
			} else if(!["lease","transfer"].includes(ownership) || lifetime?.scope!=="explicit" || lifetime.anchor!==null) fail("invalid nominal result lifetime");
		}
		return {id: d.id,owner,op,name: d.name,symbol,args,result,anchor,inputOwnership: sites.map(s=>s.ownership),resultOwnership: d.result.ownership};
	});
	return {kinds,members};
};
