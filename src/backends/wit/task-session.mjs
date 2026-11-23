/** @file Render the typed, relocatable Wasmtime task consumer API. */
import { readFile } from "node:fs/promises";
import { renderWitTaskImports } from "./task-host.mjs";

const kinds = {
	bool: ["bool","BOOL","boolean"],char: ["uint32_t","CHAR","character"]
	, float32: ["float","F32","f32"],float64: ["double","F64","f64"]
	, string: [null,"STRING","string"]
};
for(const w of [8,16,32,64]) for(const [lean,tag] of [["int","s"],["uint","u"]])
	kinds[lean+w]=[lean+w+"_t",tag.toUpperCase()+w,tag+w];

const bindings = model=>{
	const p=model.name.replaceAll("-","_")+"_wit_", defs=[], code=[],symbols=[];
	const add=(suffix,args,body)=>{
		const name=p+suffix, proto=p+"status "+name+"("+args.join(", ")+")";
		defs.push(proto+";"); symbols.push(name); if(body) code.push(proto+" {\n"+body+"\n}");
	};
	defs.push("typedef struct "+p+"session "+p+"session;",
		"typedef enum { "+["OK","INVALID","STALE","LIMIT","UNAVAILABLE","TRAPPED"].map(n=>p+n).join(", ")+" } "+p+"status;",
		"typedef enum { "+["PENDING","READY","CANCELLED","CLOSED"].map(n=>p+n).join(", ")+" } "+p+"state;",
		"typedef struct { const char *data; size_t size; } "+p+"text;",
		"typedef struct { char *data; size_t size; } "+p+"string;");
	add("open",[p+"session **out"]); add("close",[p+"session **owner"]);
	for(const [i,m] of model.wire.methods.entries())
	{
		const h=p+"task_"+m.name,s=p+"session *s",own=h+" task",spec=kinds[m.result];
		const result=(spec[0]??p+"string")+" *value", state=p+"state *state";
		defs.push("typedef struct { uint64_t _private[2]; } "+h+";");
		const args=m.args.map((a,k)=>(kinds[a][0]??p+"text")+" v"+k);
		const init=m.args.map((a,k)=>a==="string" ? "{.kind=WASMTIME_COMPONENT_STRING,.of.string={.size=v"+k+".size,.data=(char *)v"+k+".data}}"
			: "{.kind=WASMTIME_COMPONENT_"+kinds[a][1]+",.of."+kinds[a][2]+"=v"+k+"}");
		add("start_"+m.name,[s,...args,h+" *out"],(args.length?"    const lb_val args[]={"+init.join(",")+"};\n":"")
			+"    return lb_start(s,"+i+","+(args.length?"args":"NULL")+",out?out->_private:NULL);");
		for(const wait of [false,true])
		{
			const extract=m.result==="string" ? `size_t n=v.of.string.size;
            char *data=malloc(n+1); if (!data) { wasmtime_component_val_delete(&v); return lb_fault(s,false); }
            if (n) memcpy(data,v.of.string.data,n);
            data[n]=0; *value=(${p}string){.data=data,.size=n};` : "*value=v.of."+spec[2]+";";
			add((wait?"await_":"poll_")+m.name,[s,own,state,result,...wait?[]:["int *fd"]],`    if (!state || !value${wait?"":" || !fd"}${m.result==="string"?" || value->data || value->size":""}) return ${p}INVALID;
    lb_val v={0}; ${p}state next; int gate=-1;
    ${p}status rc=lb_observe(s,${i},task._private,${wait},&next,&gate,&v);
    if (rc!=${p}OK) return rc;
    if (next==${p}READY) {
        if (v.kind!=WASMTIME_COMPONENT_${spec[1]}) { wasmtime_component_val_delete(&v); return lb_fault(s,true); }
        ${extract}
    }
    wasmtime_component_val_delete(&v); *state=next; ${wait?"":"*fd=gate; "}return ${p}OK;`);
		}
		add("cancel_"+m.name,[s,own,"bool *accepted"],"    return lb_cancel(s,"+i+",task._private,accepted);");
		add("drop_"+m.name,[s,h+" *task"],"    return lb_drop_owner(s,"+i+",task?task->_private:NULL);");
	}
	const header=`#ifndef ${p.toUpperCase()}TASKS_H
#define ${p.toUpperCase()}TASKS_H
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
#include <stdlib.h>
#ifdef __cplusplus
extern "C" {
#endif
/* Open, use and close sessions on the process main thread. Start needs a fresh
 * zero-initialized output. Copies refer to the same resource and become stale on
 * drop. Poll writes the value only when READY. A PENDING fd is borrowed: do not
 * read or close it; it expires on delivery, cancellation, drop, or session close.
 * Await blocks this thread; use poll to interleave work. Returned strings are
 * independent, nul-terminated byte spans (embedded NULs remain significant).
 * Zero-initialize string outputs, then dispose them before reusing that slot. */
${defs.join("\n")}
static inline void ${p}string_dispose(${p}string *s) { if (s) { free(s->data); s->data=NULL; s->size=0; } }
#ifdef __cplusplus
}
#endif
#endif
`;
	return {header,code,symbols,p};
};

/**
 * Render only the public header for independent archive verification.
 *
 * @param model - Checked WIT task surface.
 */
export const renderWitTaskHeader = model=>bindings(model).header;

/**
 * Generate the library which contains both the component and its native imports.
 *
 * @param model - Authenticated task surface and wire.
 * @param component - Validated binary component.
 */
export const generateWitTaskSession = async (model,component)=>{
	const {header,code,symbols,p}=bindings(model), prefix=model.name.replaceAll("-","_");
	const session=await readFile(new URL("task-session.h",import.meta.url),"utf8");
	return {prefix,header,symbols
		, source: [
			'#include "'+prefix+'_wasmtime.h"',await renderWitTaskImports(model)
			, "#define LBP(x) "+p+"##x"
			, "#define LB_SESSION_KIND "+JSON.stringify(model.prefix+".wit-session")
			, "static const uint8_t lb_task_component[]={"+Array.from(component).join(",")+"};"
			, session
			, ...code
			, ""
		].join("\n")};
};
