/** @file Emit store-local Wasmtime resource imports for checked Lean task wires. */
import { readFile } from "node:fs/promises";
import { witConversionPrelude } from "./copied-conversions.mjs";
import { decodeWitWireValue } from "./sync-io-host.mjs";

/**
 * Generate private imports; the embedding owns the store, its event loop and teardown.
 *
 * @param model - Compiler-reconciled task world and native wire.
 */
export const renderWitTaskImports = async model => {
	const {wire,methods,prefix: p} = model, defs = [], rows = [];
	let words=1, tags=1;
	for(const [i,m] of wire.methods.entries())
	{
		const api=methods[i];
		const stream=m.delivery==="async-iterator";
		if((!stream && m.delivery!=="task") || Boolean(api.request)!==stream || m.declaration!==api.declaration)
			throw new TypeError("WIT method and native task wire disagree");
		const n=m.names;
		if(stream) defs.push("extern int "+n.pull+"(uint64_t *);");
		defs.push("extern int "+n.start+"(const uint64_t *,uint64_t *,uint64_t *,uint8_t *);",
			"extern int "+n.poll+"(uint64_t *,int *);",
			"extern int "+n.take+"(uint64_t *,uint64_t *,uint8_t *);",
			"extern int "+n.close+"(uint64_t *);");
		const arg=m.args.length ? "(const enum lb_kind[]){"+m.args.map(t=>"LB_"+t.toUpperCase()).join(",")+"}" : "NULL";
		words=Math.max(words,3*m.args.length);
		tags=Math.max(tags,m.tagBytes);
		const decoder=(shape,phase)=>{
			if(!shape) return "NULL";
			const name="lb_decode_"+i+"_"+phase;
			defs.push(`static int ${name}(const uint64_t *w,const uint8_t *tags,lb_scope *scope,lb_val *out) {
    const size_t ntags=${m.tagBytes}; ${decodeWitWireValue(shape,0)}
}`);
			return name;
		};
		rows.push("  {"+JSON.stringify(api.resource)+",{"+[api.start,api.poll,api.cancel,...stream?[api.request]:[]].map(s=>JSON.stringify(s)).join(",")+"},"
			+[m.args.length,arg
				, decoder(m.result,"ready")
				, decoder(m.error,"start")
				, decoder(m.terminal,"failed")
				, m.error?p+(m.effect==="EIO"?"_TYPED_ERROR":"_IO_ERROR"):"0"
				, m.terminal?p+(stream?"_TYPED_ERROR":"_IO_ERROR"):"0"
				, n.start
				, n.poll
				, n.take
				, n.close,stream?n.pull:"NULL"].join(",")+"}");
	}
	const asset = name=>readFile(new URL(name,import.meta.url),"utf8");
	const imports = (await asset("task-imports.h")).replace("/* LB_GENERATED_METHOD_TABLE */",
		()=>defs.join("\n")+"\nstatic const lb_task_method lb_methods[] = {\n"+rows.join(",\n")+"\n};");
	return ["#include <wasmtime.h>","#include <wasmtime/component.h>"
		, "#include <stdlib.h>","#include <string.h>"
		, "#include \""+p+".h\""
		, "#define LB_TASK_METHODS "+methods.length
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
		, (await asset("sync-io-values.h")).replace("static int lb_result(", "static inline int lb_result(")
		, imports
		, ""].join("\n");
};
