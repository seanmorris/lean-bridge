/** @file Emit the checked Lean C extern for each application-owned Perl member. */
import { sha256 } from "../../capsule/node.mjs";
import { perlHostMembers } from "./host-members.mjs";

const fail = m => { throw new TypeError("Perl native members: "+m); };
const machine = {unit: ["lean_object *",""],bool: ["uint8_t","small"]
	, char: ["uint32_t","uint32"]
	, float32: ["float","float32"]
	, float64: ["double","float"]
	, usize: ["size_t","usize"]
	, isize: ["size_t","usize"]};
for(const k of ["nat","int","string","bytes"]) machine[k]=["lean_object *",""];
for(const width of [8,16,32,64]) for(const t of ["int","uint"])
	machine[t+width]=["uint"+width+"_t",width<32?"small":"uint"+width];

/**
 * Resolve a verified public site to its Lean C type, boxing and private Perl conversion.
 *
 * @param types - Imported nominal declarations in canonical order.
 * @param ref - Checked carrier.
 */
export const perlHostCarrier = (types,ref) => {
	const i = ref.kind==="named" ? types.findIndex(t=>t.id===ref.id) : -1;
	if(i>=0) return {c: "lean_object *",tag: "(PH_NOMINAL+"+i+")",i,box: v=>v,unbox: v=>v};
	if(ref.kind!=="primitive" || !Object.hasOwn(machine,ref.name)) fail("unsupported member site");
	const [c,f]=machine[ref.name];
	const call=(s,v)=>f ? "lean_"+s+(f==="small"?"":"_"+f)+"("+v+")" : v;
	return {c,tag: "PH_"+ref.name.toUpperCase(),i: -1,box: v=>call("box",v),unbox: v=>call("unbox",v)};
};
const checkSite = (s,t,output) => {
	if(t.i<0)
	{ if(s.ownership!=="copy" || s.lifetime!==null) fail("invalid scalar lifetime"); return; }
	if(output && s.ownership==="borrow") return;
	const l=s.lifetime;
	const allowed=s.ownership==="borrow" ? l?.scope==="call" : ["lease","transfer"].includes(s.ownership) && (l?.scope==="explicit" || (!output && l?.scope==="call"));
	if(!allowed || l.anchor!==null) fail("invalid nominal lifetime");
};

/**
 * Build the member entry points and component-local Lean integer formatting helpers.
 *
 * @param ir - Validated application host contract.
 * @param name - CPAN module identity.
 * @param key - Component identity for exported helper names (defaults to the namespace).
 * @param local - Keep XS callback implementations local to this adapter.
 */
export const perlNativeHostMembers = (ir,name,key=name,local=false) => {
	const model=perlHostMembers(ir,name), protos=[], bodies=[], prefix="lb_ph_"+sha256(key).slice(0,32)+"_";
	const helpers=["nat","int"].map(t=>"@[export "+prefix+t+"_text] def "+(t==="nat"?"natText (v : Nat)":"intText (v : Int)")+" : String := toString v").join("\n");
	for(const [slot,m] of model.slots.entries())
	{
		const values=m.sites.map(s=>perlHostCarrier(ir.types,s.type)), out=perlHostCarrier(ir.types,m.output.type);
		m.sites.forEach((s,i)=>checkSite(s,values[i],false)); checkSite(m.output,out,true);
		let anchor=-1;
		if(m.output.ownership==="borrow")
		{
			const l=m.output.lifetime;
			anchor=l?.scope==="receiver" && m.self && l.anchor==="receiver" ? 0
				: l?.scope==="parameter" ? m.sites.findIndex((s,i)=>(!m.self || i!==0) && s.name===l.anchor) : -1;
			if(anchor<0 || values[anchor].i<0 || out.i<0) fail("unanchored borrowed member result");
		}
		const n=values.length, proto="lean_object *"+m.symbol+"("+(values.map((v,i)=>v.c+" v"+i).join(", ") || "void")+")";
		protos.push(proto+";");
		bodies.push((local?"static ":"")+proto+" {\n  static const int tags[]={"+(values.map(v=>v.tag).join(",") || "0")+"};"
			+"\n  lean_object *values[]={"+(values.map((v,i)=>v.box("v"+i)).join(",") || "NULL")+"};"
			+"\n  ph_member m={"+[slot,n,"tags",out.tag,anchor,"values"].join(",")+"};"
			+"\n  lean_object *io=ph_call(ph_dispatch,&m);\n  "
			+values.map((v,i)=>v.c==="lean_object *" && m.sites[i].ownership==="borrow" ? "" : "lean_dec(values["+i+"]);").join(" ")
			+"\n  return io;\n}");
	}
	const declarations=["nat","int"].map(t=>"extern lean_object *"+prefix+t+"_text(lean_object *);");
	const prelude=["#include <lean/lean.h>", ...declarations
		, "#define PH_NAT_TEXT "+prefix+"nat_text"
		, "#define PH_INT_TEXT "+prefix+'int_text'
		, '#include "host-wire.h"'];
	return {...model,prefix,header: protos.join("\n"),native: [...prelude,...bodies].join("\n"),helpers};
};
