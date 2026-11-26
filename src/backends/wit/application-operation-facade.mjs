/** @file Canonical ABI facade for calling native Lean with guest-defined WIT resources. */
import { witCoreInterface } from "./application-operations.mjs";

const align=(n,a)=>Math.ceil(n/a)*a;
const restore=(t,offset)=>{
	if(t.make)return `(i32.store offset=${offset} (local.get $ret) (call $new-${t.make} (i32.load offset=${offset} (local.get $ret))))`;
	if(t.slot!==undefined)return `(if (i32.load offset=${offset} (local.get $ret)) (then unreachable))
    (i32.store offset=${offset} (local.get $ret) (call $take${t.slot}))`;
	if(!t.left)return "";
	const l=restore(t.left,offset+t.align),r=restore(t.right,offset+t.align);
	return l||r?`(if (i32.load8_u offset=${offset} (local.get $ret)) (then ${r}) (else ${l}))`:"";
};
/**
 * Transfer borrows via independent guest owners and restore only the selected
 * branch of an owned result. A native placeholder is always zero, never a rep.
 *
 * @param model - Source-checked WIT operations.
 * @param scratch - Private bounded allocator and post-return support.
 */
export const witOperationFacade=(model,scratch)=>{
	const objects=witCoreInterface(model.objects),exchange=witCoreInterface(model.exchange);
	const native=witCoreInterface(model.nativeName),api=witCoreInterface(model.publicName);
	const imports=[],funcs=[],used=new Set();
	const imp=(iface,label,id,params,out)=>{
		if(used.has(id))return;used.add(id);
		imports.push(`(import "cm32p2|${iface}" "${label}" (func $${id} ${params.length?"(param "+params.join(" ")+")":""} ${out?"(result "+out+")":""}))`);
	};
	const output=t=>{
		if(t.make)imp("_ex_"+api,t.make+"_new","new-"+t.make,["i32"],"i32");
		else if(t.slot!==undefined)imp(exchange,"take-item"+t.slot,"take"+t.slot,[],"i32");
		else if(t.left)
		{output(t.left);output(t.right);}
	};
	for(const m of model.methods)
	{
		const flat=m.params.flatMap(p=>p.type.flat),many=flat.length>16,args=many?["i32"]:flat;
		const indirect=m.output.flat.length>1,ret=indirect?"i32":m.output.flat[0];
		imp(native,m.name,"fn"+m.index,indirect?[...args,"i32"]:args,indirect?null:ret);
		if(m.recordOp==="drop")
		{
			funcs.push(`(func (export "cm32p2|${api}|${m.symbol}") (param i32)
  (call $enter) (if (call $fn${m.index} (local.get 0)) (then unreachable)) (call $leave))`);
			continue;
		}
		if(m.role==="drop")
		{
			const base="cm32p2|"+api+"|";
			funcs.push(`(func $drop-${m.index} (export "${base}[method]${m.resourceName}.close") (param i32)
  (call $enter) (if (call $fn${m.index} (local.get 0)) (then unreachable)) (call $leave))
(export "${base}${m.resourceName}_dtor" (func $drop-${m.index}))`);
			continue;
		}
		output(m.output);
		let ix=0,offset=0;const stage=[],pass=[];
		for(const {type: t} of m.params)
		{
			offset=align(offset,t.align);
			if(t.slot!==undefined)
			{
				const r=model.contract.resources[t.slot];
				imp(objects,r.retain,"retain"+t.slot,["i32"],"i32");imp(objects,r.name+"_drop","end"+t.slot,["i32"]);
				imp(exchange,"put-item"+t.slot,"put"+t.slot,["i32"]);
				const arg=many?`(i32.load offset=${offset} (local.get 0))`:`(local.get ${ix})`;
				stage.push(`(call $put${t.slot} (call $retain${t.slot} ${arg})) (call $end${t.slot} ${arg})`);
				if(many)stage.push(`(i32.store offset=${offset} (local.get 0) (i32.const 0))`);
				else pass.push("(i32.const 0)");
			}else if(!many)pass.push(...t.flat.map((_,j)=>"(local.get "+(ix+j)+")"));
			offset+=t.size;ix+=t.flat.length;
		}
		// The private callback consumes same-type arguments in reverse order.
		if(many)pass.push("(local.get 0)");
		if(indirect)pass.push("(local.get $ret)");
		const symbol="cm32p2|"+api+"|"+(m.symbol??(m.role==="invoke"?"[method]"+m.resourceName+".invoke":m.name));
		funcs.push(`(func (export "${symbol}") ${args.length?"(param "+args.join(" ")+")":""} (result ${ret}) ${indirect?"(local $ret i32)":""}
  (call $enter) ${stage.join("\n  ")}
  ${indirect?`(local.set $ret (call $alloc (i32.const 0) (i32.const 0) (i32.const ${m.output.align}) (i32.const ${m.output.size})))`:""}
  (call $fn${m.index} ${pass.join(" ")})
  ${indirect?restore(m.output,0)+" (local.get $ret)":m.output.make?"call $new-"+m.output.make:m.output.slot!==undefined?`(if (then unreachable)) (call $take${m.output.slot})`:""})
(func (export "${symbol}_post") (param ${ret}) (call $leave))`);
	}
	return "(module\n"+[...imports,scratch,...funcs].join("\n")+"\n)";
};
