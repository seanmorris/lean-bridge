/** @file Assemble the source-selected task and cursor interface on one native owner. */
import {copiedChannelImport,copiedDrain} from "./application-turn-copied.mjs";

/**
 * List the private hooks used by the embedding, never by a downstream application.
 *
 * @param shape - Validated declaration shape.
 */
export const witTurnChannelPorts=shape=>shape==="stream"?["pump","retire","drain"]:["poll","deliver","reap","retire","close","drain"];

/**
 * Reuse public WIT's nominal aliases and the compiled sources' complete
 * inventory. Allocate one callback responder per signature across all sites.
 *
 * @param o - Reconciled methods, interface aliases and compiled adapters.
 */
export const witTurnTaskAssembly=o=>{
	const {methods,files,rs,iface,callbacks,objects,registrations,slots,api,aliases,failure,methodSlots}=o;
	const fields=ids=>ids.map(i=>`(export "${rs[i].name}" (type $r${i} (sub resource)))`);
	const alias=(ids,inst)=>ids.map(i=>`(alias export $${inst} "${rs[i].name}" (type $r${i}))`);
	const types=ids=>ids.map(i=>`(with "r${i}" (type $r${i}))`).join(" ");
	const take=i=>`(param "ticket" u64) (result (option (own $r${i})))`;
	const required=new Map(),field=(name,i,t)=>required.set(name+"-k"+i,t);
	const responses=new Map(),parts=["(component",`(import "${iface}" (instance $o ${fields(objects).join(" ")}))`,...alias(objects,"o")];
	const relays=methods.filter(m=>m.shape==="callback");
	for(const m of relays)responses.set(m.idx,m);
	if(relays.length)
	{
		const cb=fields(registrations);
		for(const m of responses.values())cb.push(`(export "[method]${rs[m.cb].name}.invoke" (func (param "self" (borrow $r${m.cb})) (param "value" (borrow $r${m.input})) (result (result (own $r${m.owner}) (error (own $r${m.err}))))))`);
		parts.push(`(import "${callbacks.interfaceName}" (instance $cb ${cb.join(" ")}))`,...alias(registrations,"cb"));
		parts.push(`(type $failure (variant (case "callback" (own $r${relays[0].err})) (case "io" string)))`);
	}
	for(const m of methods)
	{
		if(m.copied)continue;
		for(const i of [m.input,...m.cb!=null?[m.cb]:[]])field("lease",i,`(param "value" (borrow $r${i})) (result u64)`);
		field("copy",m.owner,take(m.owner));
		if(m.shape==="stream" && m.err!=null)field("copy",m.err,take(m.err));
		if(m.shape==="callback")
		{
			for(const i of [m.input,m.cb])field("copy",i,take(i));
			for(const i of [m.owner,m.err])field("hold",i,`(param "value" (own $r${i})) (result u64)`);
			field("take",m.err,take(m.err));
		}
	}
	parts.push('(import "leases" (instance $v (export "release-lease" (func (param "kind" u32) (param "ticket" u64) (result bool)))');
	parts.push('(export "same-lease" (func (param "kind" u32) (param "left" u64) (param "right" u64) (result bool)))');
	parts.push(...[...required].map(([n,t])=>`(export "${n}" (func ${t}))`),"))");
	for(const [j,m] of methods.entries())
	{
		const args=m.shape==="stream"?'(param "value" u64)':'(param "left" u64) (param "right" u64)';
		parts.push(`(import "turn-${m.name}" (func $turn${j} (param "op" u32) (param "key" u32) ${args} (result (tuple u32 u32 u64 u64))))`);
		if(m.copied)parts.push(copiedChannelImport(m,"$copied"+j));
	}
	for(const [i,m] of responses)
	{
		const label=rs[m.cb].name;
		parts.push(files[label+"-turn-invoke.wat"].replace("(component","(component $invoke"+i));
		parts.push(`(instance $res${i} (instantiate $invoke${i} ${types(methodSlots(m))} (with "registration" (func $v "copy-k${m.cb}"))`);
		parts.push(`(with "argument" (func $v "copy-k${m.input}")) (with "value" (func $v "hold-k${m.owner}")) (with "error" (func $v "hold-k${m.err}")) (with "invoke" (func $cb "[method]${label}.invoke"))))`);
	}
	for(const [i,m] of methods.entries())
	{
		const stream=m.shape==="stream",extra=m.shape==="callback"?`(with "invoke" (func $res${m.idx} "invoke")) (with "failure" (type $failure))`:"";
		if(m.copied)
		{
			parts.push(files[m.name+"-copied.wat"].replace("(component","(component $writer"+i));
			parts.push(`(instance $m${i} (instantiate $writer${i} ${(stream?["begin","peek","act"]:["begin","peek"]).map(f=>`(with "${f}" (func $copied${i} "${f}"))`).join(" ")}))`);
			const controls=stream?"":["poll","close"].map(n=>`(with "${n}" (func $copied${i} "${n}"))`).join(" ");
			parts.push(copiedDrain(stream).replace("(component","(component $drain"+i),`(instance $d${i} (instantiate $drain${i} (with "turn" (func $turn${i})) (with "release" (func $v "release-lease")) ${controls}))`);
			for(const n of witTurnChannelPorts(m.shape))parts.push(`(export "${m.name}-${n}" (func $${["drain","poll","close"].includes(n)?"d":"m"}${i} "${n}"))`);
			continue;
		}
		parts.push(files[m.name+(stream?"-turn-cursor.wat":"-turn-future.wat")].replace("(component","(component $code"+i));
		parts.push(`(instance $m${i} (instantiate $code${i} ${types(methodSlots(m))} ${extra} (with "leases" (instance $v)) (with "turn" (func $turn${i}))))`);
		parts.push(...witTurnChannelPorts(m.shape).map(n=>`(export "${m.name}-${n}" (func $m${i} "${n}"))`));
	}
	parts.push("(instance $api",...slots.map(i=>`(export "${aliases.get(i)}" (type $r${i}))`));
	if(relays.length)parts.push(`(export "${failure}" (type $failure))`);
	parts.push(...methods.map((m,i)=>`(export "${m.name}" (func $m${i} "start"))`),")",`(export "${api}" (instance $api)))`);
	return parts.join("\n");
};
