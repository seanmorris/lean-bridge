/** @file Emit store-local Wasmtime resource imports for checked Lean task wires. */
import { readFile } from "node:fs/promises";
import { witConversionPrelude } from "./copied-conversions.mjs";

/**
 * Generate private imports; the embedding owns the store, its event loop and teardown.
 *
 * @param model - Compiler-reconciled task world and native wire.
 */
export const renderWitTaskImports = async model => {
	const {wire,methods,prefix: p} = model, defs = [], rows = [];
	let words=1;
	for(const [i,m] of wire.methods.entries())
	{
		const api=methods[i];
		if(m.delivery!=="task" || m.declaration!==api.declaration || m.error || m.terminal)
			throw new TypeError("WIT method and native task wire disagree");
		const n=m.names;
		defs.push("extern int "+n.start+"(const uint64_t *,uint64_t *,uint64_t *,uint8_t *);",
			"extern int "+n.poll+"(uint64_t *,int *);",
			"extern int "+n.take+"(uint64_t *,uint64_t *,uint8_t *);",
			"extern int "+n.close+"(uint64_t *);");
		const arg=m.args.length ? "(const enum lb_kind[]){"+m.args.map(t=>"LB_"+t.toUpperCase()).join(",")+"}" : "NULL";
		words=Math.max(words,3*m.args.length);
		rows.push("  {"+JSON.stringify(api.resource)+",{"+[api.start,api.poll,api.cancel].map(s=>JSON.stringify(s)).join(",")+"},"
			+m.args.length+","+arg+",LB_"+m.result.toUpperCase()+","+[n.start,n.poll,n.take,n.close].join(",")+"}");
	}
	const asset = name=>readFile(new URL(name,import.meta.url),"utf8");
	const imports = (await asset("task-imports.h")).replace("/* LB_GENERATED_METHOD_TABLE */",
		()=>defs.join("\n")+"\nstatic const lb_task_method lb_methods[] = {\n"+rows.join(",\n")+"\n};");
	return ["#include <wasmtime.h>","#include <wasmtime/component.h>"
		, "#include <stdlib.h>","#include <string.h>"
		, "#include \""+p+".h\""
		, "#define LB_TASK_METHODS "+methods.length
		, "#define LB_TASK_WORDS "+words
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
