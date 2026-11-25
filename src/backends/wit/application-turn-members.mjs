/** @file Call the defining guest's synchronous members without entering an active store from C. */
import {canonicalValue} from "./canonical-values.mjs";

const align=(n,a)=>Math.ceil(n/a)*a;
const fields=ts=>{let size=0;return ts.map(t=>{const off=align(size,t.align);size=off+t.size;return off;});};
const sizeOf=ts=>ts.length?align(fields(ts).at(-1)+ts.at(-1).size,Math.max(...ts.map(t=>t.align))):0;
const u64={wat: "u64",flat: ["i64"],size: 8,align: 8};
const type=(kind,wire=false,borrow=false)=>{
	if(typeof kind==="number")return wire?u64:{wat: `(${borrow?"borrow":"own"} $r${kind})`,flat: ["i32"],size: 4,align: 4};
	if(kind==="int")return {wat: "$signed",flat: ["i32","i32","i32"],size: 12,align: 4};
	if(kind==="nat")return {wat: "(list u32)",flat: ["i32","i32"],size: 8,align: 4};
	if(kind==="unit")return {wat: wire?"u8":"$unit",flat: ["i32"],size: 1,align: 1};
	return canonicalValue({kind: "primitive",name: kind==="isize"?"int64":kind==="usize"?"uint64":kind});
};
const none={wat: "",size: 0,align: 1,flat: []};
const result=(ok,err)=>{
	const a=Math.max(ok.align,err.align);
	return {wat: `(result ${ok.wat} (error ${err.wat}))`,size: align(a+Math.max(ok.size,err.size),a),align: a,flat: ["i32","i32"]};
};
const params=flat=>flat.length?"(param "+flat.join(" ")+")":"";
const alloc=(a,n)=>`(call $alloc (i32.const 0) (i32.const 0) (i32.const ${a}) (i32.const ${n}))`;
const ptr=(v,off)=>off?`(i32.add ${v} (i32.const ${off}))`:v;
const load=(t,o,p)=>`(${t.flat[0]}.load${t.size===1?"8_u":t.size===2?"16_u":""} offset=${o} ${p})`;
const save=(t,o,p,v)=>`(${t.flat[0]}.store${t.size===1?"8":t.size===2?"16":""} offset=${o} ${p} ${v})`;
const label=m=>(m.implicitReceiver?"[method]"+m.resource+".":["constructor","static-method"].includes(m.op)?"[static]"+m.resource+".":"")+m.name;
const coreSig=(ts,out,imp)=>{
	const flat=ts.flatMap(t=>t.flat),args=flat.length>16?["i32"]:flat;
	const many=out.flat.length>1;
	return params(imp&&many?[...args,"i32"]:args)+(imp&&many || !out.flat.length?"":` (result ${many?"i32":out.flat[0]})`);
};
const signature=(m,ts,out)=>m.inputs.map((a,i)=>`(param "${a.name}" ${ts[i].wat})`).join(" ")+(out.wat?` (result ${out.wat})`:"");

/**
 * Opaque u64 tickets never stand for a resource representation. Resolve each
 * input through the live typed vault, lend or give the new owner exactly once,
 * and park any original result or exception in that vault. Copied values use
 * the canonical ABI directly, including strings, integer limbs and indirect args.
 *
 * @param descriptor - Checked defining object interface and native member order.
 * @param scratch - Bounded, nesting-aware canonical allocator.
 */
export const witTurnMembers=(descriptor,scratch)=>{
	const {contract,interfaceName}=descriptor,{resources,methods}=contract,err=resources.length;
	const rs=[...resources,{name: contract.error}],obj=rs.map((r,i)=>`(export "${r.name}" (type $r${i} (sub resource)))`);
	obj.push(`(type $sr (record (field "negative" bool) (field "limbs" (list u32)))) (export "${contract.integer}" (type $signed (eq $sr)))`);
	obj.push(`(type $ue (enum "unit")) (export "${contract.unit}" (type $unit (eq $ue)))`);
	const vault=[],imports=[],linked=[],lower=[],bodies=[],lift=[];
	const mem='(memory $mem "cm32p2_memory") (realloc (func $mem "cm32p2_realloc"))';
	const bridge=(id,source,sig)=>{
		lower.push(`(core func $${id} ${source})`);
		imports.push(`(import "" "${id}" (func $${id} ${sig}))`);
		linked.push(`(export "${id}" (func $${id}))`);
	};
	for(const [i,r] of rs.entries())
	{
		vault.push(`(export "hold-k${i}" (func (param "value" (own $r${i})) (result u64)))`);
		bridge("hold"+i,`(canon lower (func $v "hold-k${i}"))`,"(param i32) (result i64)");
		if(!r.retain)continue;
		vault.push(`(export "copy-k${i}" (func (param "ticket" u64) (result (option (own $r${i})))))`);
		bridge("copy"+i,`(canon lower (func $v "copy-k${i}") ${mem})`,"(param i64 i32)");
		bridge("drop"+i,`(canon resource.drop $r${i})`,"(param i32)");
	}
	for(const [i,m] of methods.entries())
	{
		const arg=m.inputs.map(a=>type(a.kind,false,a.ownership==="borrow")),tokens=m.inputs.map(a=>type(a.kind,true));
		const ok=m.result==="unit"?none:type(m.result),wok=m.result==="unit"?none:type(m.result,true);
		const res=m.error?result(ok,type(err)):ok,wire=m.error?result(wok,u64):wok;
		obj.push(`(export "${label(m)}" (func ${signature(m,arg,res)}))`);
		bridge("member"+i,`(canon lower (func $o "${label(m)}") ${mem})`,coreSig(arg,res,true));
		const many=arg.flatMap(t=>t.flat).length>16,fo=fields(tokens),go=fields(arg);
		const code=["(call $enter)"],locals=[],args=[],drops=[];
		if(many)code.push(`(local.set $args ${alloc(Math.max(...arg.map(t=>t.align)),sizeOf(arg))})`);
		let j=0;
		for(const [n,a] of m.inputs.entries())
		{
			const t=arg[n],w=tokens[n],word=k=>`(local.get ${j+k})`;
			if(typeof a.kind==="number")
			{
				const ticket=many?load(u64,fo[n],"(local.get 0)"):word(0);
				locals.push(`(local $h${n} i32)`);
				code.push(`(call $copy${a.kind} ${ticket} (local.get $tmp)) (if (i32.ne (i32.load8_u (local.get $tmp)) (i32.const 1)) (then unreachable))`);
				code.push(`(local.set $h${n} (i32.load offset=4 (local.get $tmp)))`);
				if(many)code.push(save(t,go[n],"(local.get $args)",`(local.get $h${n})`));else args.push(`(local.get $h${n})`);
				if(a.ownership==="borrow")drops.push(`(call $drop${a.kind} (local.get $h${n}))`);
			}else if(many)code.push(`(memory.copy ${ptr("(local.get $args)",go[n])} ${ptr("(local.get 0)",fo[n])} (i32.const ${t.size}))`);
			else args.push(...w.flat.map((_,k)=>word(k)));
			j+=w.flat.length;
		}
		if(many)args.push("(local.get $args)");
		if(res.flat.length>1)args.push("(local.get $src)");
		const call=`(call $member${i} ${args.join(" ")})`;
		code.push(res.flat.length===1?`(local.set $v ${call})`:call,...drops);
		const held=(k,v)=>`(call $checked (call $hold${k} ${v}))`;
		const convert=(kind,t,from,to)=>typeof kind==="number"?save(u64,to,"(local.get $ret)",held(kind,load(t,from,"(local.get $src)")))
			:t.size?`(memory.copy ${ptr("(local.get $ret)",to)} ${ptr("(local.get $src)",from)} (i32.const ${t.size}))`:"";
		if(m.error)
		{
			code.push(`(i32.store8 (local.get $ret) (i32.load8_u (local.get $src))) (if (i32.load8_u (local.get $src))`);
			code.push(`(then ${convert(err,type(err),res.align,wire.align)}) (else ${convert(m.result,ok,res.align,wire.align)})) (local.get $ret)`);
		}else if(res.flat.length===1)code.push(typeof m.result==="number"?held(m.result,"(local.get $v)"):"(local.get $v)");
		else if(res.flat.length>1)code.push("(local.get $src)");
		const setup=`(local.set $tmp ${alloc(4,8)}) (local.set $src ${alloc(res.align,Math.max(1,res.size))}) (local.set $ret ${alloc(wire.align,Math.max(1,wire.size))})`;
		code.splice(1,0,setup);
		bodies.push(`(func (export "call${i}") ${coreSig(tokens,wire,false)} (local $tmp i32) (local $src i32) (local $ret i32) (local $args i32) ${res.flat.length===1?"(local $v "+res.flat[0]+")":""} ${locals.join(" ")} ${code.join("\n")})`);
		bodies.push(`(func (export "post${i}") ${wire.flat.length?params([wire.flat.length>1?"i32":wire.flat[0]]):""} (call $leave))`);
		lift.push(`(func (export "invoke-m${i}") ${signature(m,tokens,wire)} (canon lift (core func $run "call${i}") ${mem} (post-return (func $run "post${i}"))))`);
	}
	return [`(component (import "${interfaceName}" (instance $o ${obj.join("\n")}))`
		, ...rs.map((r,i)=>`(alias export $o "${r.name}" (type $r${i}))`)
		, `(alias export $o "${contract.integer}" (type $signed)) (alias export $o "${contract.unit}" (type $unit))`
		, `(import "leases" (instance $v ${vault.join("\n")}))`
		, `(core module $heap ${scratch} (export "enter" (func $enter)) (export "leave" (func $leave))) (core instance $mem (instantiate $heap))`
		, ...lower
		, '(core module $body (import "" "mem" (memory 1 1024)) (import "" "enter" (func $enter)) (import "" "leave" (func $leave)) (import "" "alloc" (func $alloc (param i32 i32 i32 i32) (result i32)))'
		, ...imports
		, '(func $checked (param i64) (result i64) (if (i64.eqz (local.get 0)) (then unreachable)) (local.get 0))'
		, ...bodies
		, ")"
		, '(core instance $run (instantiate $body (with "" (instance (export "mem" (memory $mem "cm32p2_memory")) (export "enter" (func $mem "enter")) (export "leave" (func $mem "leave")) (export "alloc" (func $mem "cm32p2_realloc"))'
		, ...linked,"))))",...lift,")"].join("\n");
};
