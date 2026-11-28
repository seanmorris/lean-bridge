/** @file Map compiler-inspected structures to guest-owned WIT resources and typed native leases. */
import {canonicalJson} from "../../capsule/node.mjs";
import {cIdentifier} from "../c/generate.mjs";
import {witVariantMember} from "./copied-variants.mjs";

const reject=why=>{throw new TypeError("WIT application record: "+why);};
const equal=(a,b)=>canonicalJson(a)===canonicalJson(b);
const publicField=name=>name.replace(/([A-Z]+)([A-Z][a-z])/gu,"$1_$2").replace(/([a-z0-9])([A-Z])/gu,"$1_$2").toLowerCase();
/**
 * Compare a compiler record observation to its public named type reference.
 *
 * @param t - Compiler-observed type at one signature position.
 */
export const witRecordRef=t=>t.kind==="host-record"?{kind: "named",id: "lean:"+t.declaration}:t;

/**
 * Reconcile all fields, including those with interchangeable ABI carriers.
 * Never derive a guest accessor or C symbol from an unverified review alone.
 *
 * @param entries - Private Lean observations.
 * @param api - Reconciled public API.
 * @param names - Already reserved public WIT labels.
 */
export const witRecordContracts=(entries,api,names)=>{
	const found=new Map(),defs=new Map(api.types.filter(t=>t.kind==="record").map(t=>[t.id,t]));
	for(const e of entries) for(const [position,t] of [...e.parameters.map(p=>p.type),e.result].entries())
	{
		if(t.kind!=="host-record") continue;
		const id="lean:"+t.declaration,d=defs.get(id),decl=api.declarations.find(v=>v.source.declaration===e.declaration);
		if(api.schemaVersion!==4 || !decl || !d || e.effect!=="IO" || e.delivery || !t.fields.length || t.fields.length>64
			|| d.source.declaration!==t.declaration || d.source.extensions["lean-bridge.dev/record-constructor"]!==t.constructor
			|| !equal(d.aggregate,{ownership: "lease",disposal: "required",fallback: "none",cycles: "reject"})
			|| d.representation!=="owned" || d.mutability!=="immutable" || d.fields.length!==t.fields.length) reject("unverified "+id);
		for(const [i,f] of t.fields.entries())
		{
			const p=d.fields[i];
			if(f.projection!==t.declaration+"."+f.name || p.name!==publicField(f.name) || !equal(p.type,f.type)
				|| p.mutability!=="immutable" || !(f.type.kind==="primitive" || f.type.kind==="named" && api.types.some(a=>a.host && a.id===f.type.id)))
				reject("unverified field "+t.declaration+"."+f.name);
		}
		const input=position<e.parameters.length,site=input?decl.parameters[position]:decl.result;
		if(!site || site.type.id!==id || site.ownership!==(input?"borrow":"lease")
			|| !equal(site.lifetime,{scope: input?"call":"explicit",anchor: null})) reject("wrong site or lifetime for "+id);
		if(found.has(t.declaration)) continue;
		const resource=witVariantMember(d.name,names,reject,"record"),labels=new Set();
		const fields=t.fields.map((f,i)=>({name: witVariantMember(d.fields[i].name,labels,reject,"record field"),source: f.name,type: f.type}));
		found.set(t.declaration,{source: t,resource,fields});
	}
	if(found.size!==defs.size) reject("unused public definition");
	return found;
};

/**
 * The generated standalone C facade already owns all copied fields and guest
 * leases. Use its checked clone and drop functions; never interpret a ticket.
 *
 * @param p - Validated native package prefix.
 * @param t - Compiler result or argument site.
 */
export const witRecordCType=(p,t)=>{
	const type=p+cIdentifier(t.declaration.split(".").at(-1));
	const empty=v=>"(!("+v+")._private[0] && !("+v+")._private[1])",clear=v=>"(void)"+type+"_drop(&("+v+"));";
	return {arg: type,type,empty,clear,drop: "lwit_release_"+cIdentifier(t.declaration.split(".").at(-1))};
};

/**
 * Constructors and getters are public Component Model operations, not extra
 * Lean exports. Their private counterparts call the compiled C record API.
 * Projections of a guest class return a new canonical owner of that class.
 *
 * @param rows - Validated definitions keyed by Lean declaration.
 * @param value - Lower a compiler-observed site on either side of the facade.
 * @param unique - Reserve a name in the private operation inventory.
 * @param index - Allocate the private dispatch index.
 */
export const witRecordMethods=(rows,value,unique,index)=>{
	const methods=[],definitions=[];
	for(const row of rows.values())
	{
		const {resource,fields,source}=row;
		const add=(op,params,result,symbol,extra={})=>{
			const name=unique("lb-"+resource+"-"+op);
			const entry={name,effect: "BaseIO",parameters: params.map(p=>({name: p.name,type: p.source})),result: result.source};
			methods.push({name,index: index(),params,output: result,result,errors: [],declared: null,member: false,recordOp: op,row,symbol,entry,...extra});
		};
		const self={name: "self",source,type: value(source,true)};
		const args=fields.map(f=>({name: f.name,source: f.type,type: value(f.type,true)}));
		const returned=t=>({...value(t,false),source: t});
		add("make",args,returned(source),"[constructor]"+resource);
		const accessors=[];
		for(const f of fields)
		{
			const out=returned(f.type);
			add("get-"+f.name,[self],out,"[method]"+resource+"."+f.name,{field: f.source});
			accessors.push("%"+f.name+": func() -> "+out.wit+";");
		}
		const u8={kind: "primitive",name: "uint8"};
		add("drop",[self],returned(u8),resource+"_dtor");
		definitions.push("  resource %"+resource+" { constructor("+args.map(a=>"%"+a.name+": "+a.type.wit).join(", ")+"); "+accessors.join(" ")+" }");
	}
	return {methods,definitions};
};
