/** @file Drive compiled synchronous Lean operations from a Wasm application already inside an async turn. */
import {witTurnAbi} from "./application-turn-members.mjs";
const {fields,sizeOf,u64,type,none,result,alloc,ptr,load,save,coreSig}=witTurnAbi;
const tup=ts=>ts.length?`(tuple ${ts.map(t=>t.wat).join(" ")})`:"u8";
const wire=t=>t.slot!=null?u64:t.left?result(wire(t.left),wire(t.right)):t;
const components=t=>t.flat.length===1?[t]:t.wat==="$signed"?[type("bool"),type("uint32"),type("uint32")]:[type("uint32"),type("uint32")];
const arglist=(ts,base)=>{
	if(ts.flatMap(t=>t.flat).length>16)return [base];
	const off=fields(ts);
	return ts.flatMap((t,j)=>{const fs=components(t),os=fields(fs);return fs.map((w,i)=>load(w,off[j]+os[i],base));});
};
const maxAlign=ts=>Math.max(1,...ts.map(t=>t.align));
const event="(tuple u64 u32 u32 u64 u64)",key='(param "key" u64)';

/**
 * Keep the existing public WIT facade and exchange. On its native side
 * move inputs into typed leases before entering Lean. The loop can service
 * arbitrarily nested defining-guest member calls without calling Wasmtime
 * from C inside an active store. Returned owner tickets are independent moves.
 *
 * @param ops - Complete checked public operation and defining-member contracts.
 * @param scratch - Canonical scratch memory with nested post-return reclamation.
 */
export const witTurnSyncGraph=(ops,scratch)=>{
	const {contract,methods}=ops,rs=[...contract.resources,{name: contract.error}],last=rs.length-1;
	const obj=rs.map((r,i)=>`(export "${r.name}" (type $r${i} (sub resource)))`);
	obj.push(`(type $sr (record (field "negative" bool) (field "limbs" (list u32)))) (export "${contract.integer}" (type $signed (eq $sr)))`);
	const host=[],member=[],leases=[],exchange=[],lower=[],imports=[],links=[],bodies=[],lifting=[],native=[];
	const mem='(memory $heap "cm32p2_memory") (realloc (func $heap "cm32p2_realloc"))';
	const hook=(iface,decls,name,id,wit,sig)=>{
		decls.push(`(export "${name}" (func ${wit}))`);
		lower.push(`(core func $${id} (canon lower (func $${iface} "${name}") ${mem}))`);
		imports.push(`(import "" "${id}" (func $${id} ${sig}))`);links.push(`(export "${id}" (func $${id}))`);
	};
	const pin=(i,v)=>`(call $hold${i} ${v})`;
	const extracted=(i,fn,ticket,tmp)=>`(call $${fn}${i} ${ticket} ${tmp}) (if (i32.ne (i32.load8_u ${tmp}) (i32.const 1)) (then unreachable))`;
	for(const [i] of rs.entries())
	{
		hook("v",leases,"take-k"+i,"take"+i,`(param "ticket" u64) (result (option (own $r${i})))`,"(param i64 i32)");
		hook("x",exchange,"put-item"+i,"put"+i,`(param "value" (own $r${i}))`,"(param i32)");
		if(i===last)continue;
		hook("v",leases,"hold-k"+i,"hold"+i,`(param "value" (own $r${i})) (result u64)`,"(param i32) (result i64)");
		hook("v",leases,"copy-k"+i,"copy"+i,`(param "ticket" u64) (result (option (own $r${i})))`,"(param i64 i32)");
		hook("x",exchange,"take-item"+i,"pop"+i,`(result (own $r${i}))`,"(result i32)");
	}
	hook("v",leases,"release-lease","release",'(param "kind" u32) (param "ticket" u64) (result bool)',"(param i32 i64) (result i32)");
	hook("v",leases,"same-lease","same",'(param "kind" u32) (param "left" u64) (param "right" u64) (result bool)',"(param i32 i64 i64) (result i32)");
	hook("h",host,"answer","answer",`${key} (param "value" u64) (result ${event})`,"(param i64 i64 i32)");
	const branches=[];
	for(const [i,m] of contract.methods.entries())
	{
		const ts=m.inputs.map(a=>type(a.kind,true)),v=m.result==="unit"?none:type(m.result,true),r=m.error?result(v,u64):v;
		hook("mi",member,"invoke-m"+i,"m"+i,m.inputs.map((a,j)=>`(param "${a.name}" ${ts[j].wat})`).join(" ")+(r.wat?` (result ${r.wat})`:""),coreSig(ts,r,true));
		hook("h",host,"args-m"+i,"args"+i,`${key} (result (list ${tup(ts)}))`,"(param i64 i32)");
		hook("h",host,"reply-m"+i,"reply"+i,`${key} (param "payload" (list ${r.wat||"u8"})) (result ${event})`,"(param i64 i32 i32 i32)");
		const a=arglist(ts,"(local.get $args)");if(r.flat.length>1)a.push("(local.get $reply)");
		const call=`(call $m${i} ${a.join(" ")})`;
		branches.push(`(if (i32.eq (local.get $which) (i32.const ${i})) (then
          (call $args${i} (local.get $id) (local.get $tmp))
          (if (i32.ne (i32.load offset=4 (local.get $tmp)) (i32.const ${ts.length?1:0})) (then unreachable))
          (local.set $args (i32.load (local.get $tmp)))
          (local.set $reply ${alloc(r.align,Math.max(1,r.size))})
          ${r.flat.length===1?save(r,0,"(local.get $reply)",call):call}
          (call $reply${i} (local.get $id) (local.get $reply) (i32.const ${r.flat.length?1:0}) (local.get $e)) (br $again)))`);
	}
	const clones=contract.resources.map((_,i)=>`(if (i32.eq (local.get $which) (i32.const ${i})) (then
        ${extracted(i,"copy","(i64.load offset=16 (local.get $e))","(local.get $tmp)")}
        (local.set $v (call $hold${i} (i32.load offset=4 (local.get $tmp)))) (if (i64.eqz (local.get $v)) (then unreachable)) (br $copied)))`);
	bodies.push(`(func $drive (param $e i32) (param $tmp i32) (local $op i32) (local $which i32) (local $id i64) (local $v i64) (local $args i32) (local $reply i32)
      (loop $again (local.set $id (i64.load (local.get $e))) (if (i64.eqz (local.get $id)) (then unreachable))
        (local.set $op (i32.load offset=8 (local.get $e))) (local.set $which (i32.load offset=12 (local.get $e)))
        (if (i32.eqz (local.get $op)) (then (return)))
        (if (i32.eq (local.get $op) (i32.const 4097)) (then ${branches.join("\n")} unreachable))
        (if (i32.eq (local.get $op) (i32.const 4099)) (then (block $copied ${clones.join("\n")} unreachable))
        (else (local.set $v (i64.extend_i32_u (if (result i32) (i32.eq (local.get $op) (i32.const 1))
          (then (call $release (local.get $which) (i64.load offset=16 (local.get $e))))
          (else (if (i32.ne (local.get $op) (i32.const 2)) (then unreachable))
            (call $same (local.get $which) (i64.load offset=16 (local.get $e)) (i64.load offset=24 (local.get $e)))))))))
        (call $answer (local.get $id) (local.get $v) (local.get $e)) (br $again)))`);
	const restore=(t,w,so,wo)=>{
		const s="(local.get $src)",d="(local.get $out)";
		if(t.slot!=null)return `${extracted(t.slot,"take",load(u64,wo,s),"(local.get $tmp)")} (call $put${t.slot} (i32.load offset=4 (local.get $tmp))) (i32.store offset=${so} ${d} (i32.const 0))`;
		if(t.left)return `(i32.store8 offset=${so} ${d} (i32.load8_u offset=${wo} ${s})) (if (i32.load8_u offset=${wo} ${s}) (then ${restore(t.right,wire(t.right),so+t.align,wo+w.align)}) (else ${restore(t.left,wire(t.left),so+t.align,wo+w.align)}))`;
		return `(memory.copy ${ptr(d,so)} ${ptr(s,wo)} (i32.const ${t.size}))`;
	};
	for(const [i,m] of methods.entries())
	{
		const ts=m.params.map(a=>a.type),ws=ts.map(wire),r=m.output,w=wire(r),many=ts.flatMap(t=>t.flat).length>16;
		const go=fields(ts),wo=fields(ws),parts=[],staged=[];
		hook("h",host,"begin-f"+i,"begin"+i,`(param "arguments" (list ${tup(ws)})) (result ${event})`,"(param i32 i32 i32)");
		hook("h",host,"take-f"+i,"finish"+i,`${key} (result ${w.wat})`,coreSig([u64],w,true));
		let j=0;
		for(const [k,t] of ts.entries())
		{
			const g="(local.get 0)",d="(local.get $p)";
			if(t.slot!=null)
			{
				const arg=many?load(t,go[k],g):`(local.get ${j})`;
				parts.push(`(if ${arg} (then unreachable))`);
				staged.unshift(`(local.set $token ${pin(t.slot,`(call $pop${t.slot})`)}) (if (i64.eqz (local.get $token)) (then unreachable)) ${save(u64,wo[k],d,"(local.get $token)")}`);
			}else if(many)parts.push(`(memory.copy ${ptr(d,wo[k])} ${ptr(g,go[k])} (i32.const ${t.size}))`);
			else
			{const flat=components(t),offsets=fields(flat);parts.push(...flat.map((f,k2)=>save(f,wo[k]+offsets[k2],d,`(local.get ${j+k2})`)));}
			j+=t.flat.length;
		}
		const read=`(call $finish${i} (i64.load (local.get $e))${w.flat.length>1?" (local.get $src)":" "})`;
		bodies.push(`(func (export "op${i}") ${coreSig(ts,r,false)} (local $tmp i32) (local $e i32) (local $p i32) (local $src i32) (local $out i32) (local $token i64)
          (call $enter) (local.set $p ${alloc(maxAlign(ws),Math.max(1,sizeOf(ws)))}) (local.set $e ${alloc(8,32)}) (local.set $tmp ${alloc(8,8)})
          (local.set $src ${alloc(w.align,w.size)}) (local.set $out ${alloc(r.align,r.size)})
          ${parts.join("\n")} ${staged.join("\n")} (call $begin${i} (local.get $p) (i32.const ${ws.length?1:0}) (local.get $e))
          (call $drive (local.get $e) (local.get $tmp)) ${w.flat.length===1?save(w,0,"(local.get $src)",read):read}
          ${restore(r,w,0,0)} ${r.flat.length>1?"(local.get $out)":load(r,0,"(local.get $out)")})
        (func (export "post${i}") (param ${r.flat.length>1?"i32":r.flat[0]}) (call $leave))`);
		lifting.push(`(func $f${i} ${m.params.map(a=>`(param "${a.name}" ${a.type.wat})`).join(" ")} (result ${r.wat}) (canon lift (core func $run "op${i}") ${mem} (post-return (func $run "post${i}"))))`);
		native.push(`(export "${m.name}" (func $f${i}))`);
	}
	const ports='(instance (type $record (record (field "negative" bool) (field "limbs" (list u32)))) (export "signed-value" (type $signed (eq $record))) '+host.join("\n")+")";
	const wat=[
		`(component (import "${ops.objects}" (instance $o ${obj.join("\n")}))`
		, ...rs.map((r,i)=>`(alias export $o "${r.name}" (type $r${i}))`)
		, `(alias export $o "${contract.integer}" (type $signed)) (import "leases" (instance $v ${leases.join("\n")}))`
		, `(import "${ops.exchange}" (instance $x ${exchange.join("\n")})) (import "members" (instance $mi ${member.join("\n")})) (import "sync-ports" (instance $h ${host.join("\n")}))`
		, `(core module $memory ${scratch} (export "enter" (func $enter)) (export "leave" (func $leave))) (core instance $heap (instantiate $memory))`
		, ...lower
		, '(core module $body (import "" "mem" (memory 1 1024)) (import "" "enter" (func $enter)) (import "" "leave" (func $leave)) (import "" "alloc" (func $alloc (param i32 i32 i32 i32) (result i32)))'
		, ...imports, ...bodies, ")"
		, '(core instance $run (instantiate $body (with "" (instance (export "mem" (memory $heap "cm32p2_memory")) (export "enter" (func $heap "enter")) (export "leave" (func $heap "leave")) (export "alloc" (func $heap "cm32p2_realloc"))'
		, ...links, "))))", ...lifting
		, "(instance $native"
		, ...(ops.signedName?[`(export "${ops.signedName}" (type $signed))`]:[])
		, ...native, ")"
		, `(export "${ops.nativeName}" (instance $native)))`
	].join("\n");
	return {ports,wat};
};
