/** @file Emit store-local Wasmtime resource imports for checked Lean task wires. */
import { readFile } from "node:fs/promises";
import { witConversionPrelude } from "./copied-conversions.mjs";
import { decodeWitWireValue } from "./sync-io-host.mjs";
import { witCallbackTable } from "./task-callback-table.mjs";

/**
 * Generate private imports; the embedding owns the store, its event loop and teardown.
 *
 * @param model - Compiler-reconciled task world and native wire.
 */
export const renderWitTaskImports = async model => {
	const {wire,methods,prefix: p} = model, defs = [], rows = [];
	const heap=model.heap??[], leases=wire.leases??[];
	if(heap.length!==leases.length || heap.some((r,i)=>r.hash!==leases[i].hash || leases[i].tag!==i+3))
		throw new TypeError("WIT heap identities and native leases disagree");
	if(!Array.isArray(methods) || !Array.isArray(wire.methods) || methods.length!==wire.methods.length)
		throw new TypeError("WIT method and native task wire disagree");
	const callbacks=witCallbackTable(methods,wire,p);
	const leaseIndex=shape=>leases.findIndex(r=>r.type===shape);
	const heapRows=leases.map((r,i)=>{
		const n=r.symbol, type=heap[i].witName;
		defs.push("extern int "+n+"_close(uint64_t *);","extern int "+n+"_retain(const uint64_t *,uint64_t *);",
			"extern int "+n+"_same(const uint64_t *,const uint64_t *,uint8_t *);");
		return "    {"+[heap[i].nativeName,"retain-"+type,"same-"+type].map(v=>JSON.stringify(v)).join(",")+","+n+"_close,"+n+"_retain,"+n+"_same}";
	});
	let words=1, tags=1;
	for(const [i,m] of wire.methods.entries())
	{
		const api=methods[i];
		const stream=m.delivery==="async-iterator";
		if((!stream && m.delivery!=="task") || Boolean(api.request)!==stream || m.declaration!==api.declaration
			|| (api.stepIO!==undefined && typeof api.stepIO!=="boolean") || (m.stepIO!==undefined && typeof m.stepIO!=="boolean")
			|| Boolean(api.stepIO)!==Boolean(m.stepIO) || (api.stepIO && (!stream || m.terminal!=="string")))
			throw new TypeError("WIT method and native task wire disagree");
		const n=m.names;
		if(stream) defs.push("extern int "+n.pull+"(uint64_t *);");
		defs.push("extern int "+n.start+"(const uint64_t *,uint64_t *,uint64_t *,uint8_t *);",
			"extern int "+n.poll+"(uint64_t *,int *);",
			"extern int "+n.take+"(uint64_t *,uint64_t *,uint8_t *);",
			"extern int "+n.close+"(uint64_t *);");
		const args=m.args.filter(a=>a!=="callback");
		const arg=args.length ? "(const int[]){"+args.map(t=>leaseIndex(t)>=0?"LB_HEAP_BASE+"+leaseIndex(t):"LB_"+t.toUpperCase()).join(",")+"}" : "NULL";
		words=Math.max(words,3*m.args.length);
		tags=Math.max(tags,m.tagBytes);
		const decoder=(shape,phase)=>{
			if(!shape) return "NULL";
			const name="lb_decode_"+i+"_"+phase;
			const kind=leaseIndex(shape);
			defs.push(`static int ${name}(lb_tasks *s,uint64_t *w,const uint8_t *tags,lb_scope *scope,lb_val *out) {
    ${kind>=0?"(void)tags; (void)scope; return lb_heap_lift(s,"+kind+",w,out);":"(void)s; const size_t ntags="+m.tagBytes+"; "+decodeWitWireValue(shape,0)}
}`);
			return name;
		};
		const start=decoder(m.error,"start");
		rows.push("  {"+JSON.stringify(api.resource)+",{"+[api.start,api.poll,api.cancel,...stream?[api.request]:[]].map(s=>JSON.stringify(s)).join(",")+"},"
			+[args.length,arg
				, decoder(m.result,"ready")
				, m.callbacks?.length?"NULL":start
				, decoder(m.terminal,"failed")
				, m.error?p+(m.effect==="EIO"?"_TYPED_ERROR":"_IO_ERROR"):"0"
				, m.terminal?p+(stream && !api.stepIO?"_TYPED_ERROR":"_IO_ERROR"):"0"
				, m.terminal?JSON.stringify(api.stepIO?"io-failed":"failed"):"NULL"
				, n.start
				, n.poll
				, n.take
				, n.close,stream?n.pull:"NULL"].join(",")+"}");
	}
	const asset = name=>readFile(new URL(name,import.meta.url),"utf8");
	const heapCode=heap.length?await asset("task-heap-imports.h"):"";
	const callbackCode=callbacks.count?await asset("task-callback-imports.h"):"";
	const imports = (await asset("task-imports.h")).replace("/* LB_GENERATED_METHOD_TABLE */",
		()=>defs.join("\n")+"\nstatic const lb_task_method lb_methods[] = {\n"+rows.join(",\n")+"\n};"
			+(heap.length?"\nstatic const lb_heap_method lb_heap_methods[] = {\n"+heapRows.join(",\n")+"\n};":"")
			+"\n"+callbacks.declarations+"\n"+callbacks.tables)
		.replace("/* LB_HEAP_IMPORTS */",()=>heapCode)
		.replace("/* LB_CALLBACK_IMPORTS */",()=>callbackCode);
	return ["#include <wasmtime.h>","#include <wasmtime/component.h>"
		, "#include <stdlib.h>","#include <string.h>"
		, "#include \""+p+".h\""
		, "#define LB_TASK_METHODS "+methods.length
		, "#define LB_HEAPS "+heap.length
		, "#define LB_CALLBACKS "+callbacks.count
		, "#define LB_TASK_WORDS "+words
		, "#define LB_TASK_TAGS "+tags
		, "#define LB_CURSOR_END "+p+"_END"
		, "#define LB_NATIVE_CLOSED "+p+"_CLOSED"
		, "#define LB_TASK_IMPORT "+JSON.stringify(model.importName)
		, "#define LB_TASK_API "+JSON.stringify(model.exportName)
		, "#define LB_TASK_PENDING "+p+"_PENDING"
		, "extern void "+wire.clear+"(uint64_t *);"
		, "#define LB_TASK_CLEAR "+wire.clear
		, "extern int "+wire.wait.open+"(int,int,int *);"
		, "#define LB_TASK_WAIT "+wire.wait.open
		, "extern void "+wire.wait.close+"(int *);"
		, "#define LB_TASK_UNWAIT "+wire.wait.close
		, witConversionPrelude
		, await asset("sync-io-values.h")
		, imports
		, ""].join("\n");
};
