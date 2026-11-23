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

// Decode into a fresh temporary. No caller-owned string or partially decoded
// result is overwritten on failure. Only the selected Except arm owns data.
const outputCodecs=(p,defs,code)=>{
	const leaves=new Map();
	const make=(shape,name)=>{
		if(!Array.isArray(shape) && leaves.has(shape)) return leaves.get(shape);
		const pair=Array.isArray(shape), text=shape==="string", spec=kinds[shape];
		const a=pair && make(shape[0],name+"_ok"), b=pair && make(shape[1],name+"_err");
		const type=pair?p+name:text?p+"string":spec[0];
		const reader="lb_read_"+(pair?name:shape);
		if(pair) defs.push(`typedef struct { bool ok; ${a.type} value; ${b.type} error; } ${type};`);
		const native=pair?`if (v->kind!=WASMTIME_COMPONENT_RESULT || !v->of.result.val) return LB_MALFORMED;
    out->ok=v->of.result.is_ok;
    return out->ok ? ${a.reader}(v->of.result.val,&out->value) : ${b.reader}(v->of.result.val,&out->error);`
			: `if (v->kind!=WASMTIME_COMPONENT_${spec[1]}) return LB_MALFORMED;
    ${text?`size_t n=v->of.string.size;
    if (n>16u*1024u*1024u || (n && !v->of.string.data)) return LB_MALFORMED;
    char *buf=malloc(n+1); if (!buf) return LB_OVER_BUDGET;
    if (n) memcpy(buf,v->of.string.data,n);
    buf[n]=0; *out=(${p}string){buf,n};`:"*out=v->of."+spec[2]+";"} return LB_GOOD;`;
		code.push(`static int ${reader}(const lb_val *v,${type} *out) { ${native} }`);
		const paths=pair?[...a.paths.map(k=>".value"+k),...b.paths.map(k=>".error"+k)]:text?[""]:[];
		if(pair && paths.length) defs.push(`static inline void ${type}_dispose(${type} *v) {
    if (v) { ${paths.map(k=>"free((*v)"+k+".data);").join(" ")} memset(v,0,sizeof *v); }
}`);
		const result={type,reader,paths};
		if(!pair) leaves.set(shape,result);
		return result;
	};
	return make;
};

const bindings = model=>{
	const p=model.name.replaceAll("-","_")+"_wit_", defs=[], code=[],symbols=[];
	const make=outputCodecs(p,defs,code);
	const occupied=(codec,v)=>"(!"+v+codec.paths.map(k=>" || (*"+v+")"+k+".data || (*"+v+")"+k+".size").join("")+")";
	const receive=(c,out)=>`${c.type} fresh={0}; int read=${c.reader}(&v,&fresh);
        if (read!=LB_GOOD) { wasmtime_component_val_delete(&v); return lb_fault(s,read==LB_MALFORMED); }
        *${out}=fresh;`;
	const add=(suffix,args,body)=>{
		const name=p+suffix, proto=p+"status "+name+"("+args.join(", ")+")";
		defs.push(proto+";"); symbols.push(name); if(body) code.push(proto+" {\n"+body+"\n}");
	};
	defs.push("typedef struct "+p+"session "+p+"session;",
		"typedef enum { "+["OK","INVALID","STALE","LIMIT","UNAVAILABLE","TRAPPED","START_ERROR","BUSY","FINISHED"].map(n=>p+n).join(", ")+" } "+p+"status;",
		"typedef enum { "+["PENDING","READY","CANCELLED","CLOSED","FAILED","IDLE","ITEM","END"].map(n=>p+n).join(", ")+" } "+p+"state;",
		"typedef struct { const char *data; size_t size; } "+p+"text;",
		"typedef struct { char *data; size_t size; } "+p+"string;");
	add("open",[p+"session **out"]); add("close",[p+"session **owner"]);
	for(const [i,m] of model.wire.methods.entries())
	{
		const stream=m.delivery==="async-iterator", h=p+(stream?"cursor_":"task_")+m.name,s=p+"session *s",own=h+" task",value=make(m.result,m.name+"_value");
		const error=m.error && make(m.error,m.name+"_start_error"), terminal=m.terminal && make(m.terminal,m.name+"_failure");
		const result=value.type+" *value", state=p+"state *state";
		defs.push("typedef struct { uint64_t _private[2]; } "+h+";");
		const args=m.args.map((a,k)=>(kinds[a][0]??p+"text")+" v"+k);
		const init=m.args.map((a,k)=>a==="string" ? "{.kind=WASMTIME_COMPONENT_STRING,.of.string={.size=v"+k+".size,.data=(char *)v"+k+".data}}"
			: "{.kind=WASMTIME_COMPONENT_"+kinds[a][1]+",.of."+kinds[a][2]+"=v"+k+"}");
		const call="lb_start(s,"+i+","+(args.length?"args":"NULL")+",out?out->_private:NULL,"+(error?"&v":"NULL")+")";
		add((stream?"open_":"start_")+m.name,[s,...args,h+" *out",...error?[error.type+" *failure"]:[]],(args.length?"    const lb_val args[]={"+init.join(",")+"};\n":"")
			+(error?`    if (${occupied(error,"failure")}) return ${p}INVALID;
    lb_val v={0}; ${p}status rc=${call};
    if (rc==${p}START_ERROR) { ${receive(error,"failure")} }
    wasmtime_component_val_delete(&v); return rc;`:"    return "+call+";"));
		for(const wait of [false,true])
		{
			add((wait?"await_":"poll_")+m.name,[s,own,state,result,...terminal?[terminal.type+" *failure"]:[],...wait?[]:["int *fd"]],`    if (!state || ${occupied(value,"value")}${wait?"":" || !fd"}${terminal?" || "+occupied(terminal,"failure"):""}) return ${p}INVALID;
    lb_val v={0}; ${p}state next; int gate=-1;
    ${p}status rc=lb_observe(s,${i},task._private,${wait},&next,&gate,&v);
    if (rc!=${p}OK) return rc;
    if (next==${p}${stream?"ITEM":"READY"}) {
        ${receive(value,"value")}
    }${terminal?` else if (next==${p}FAILED) { ${receive(terminal,"failure")} }`:""}
    wasmtime_component_val_delete(&v); *state=next; ${wait?"":"*fd=gate; "}return ${p}OK;`);
		}
		if(stream)
		{
			add("request_"+m.name,[s,own],"    return lb_request_cursor(s,"+i+",task._private);");
			add("next_"+m.name,[s,own,state,result,...terminal?[terminal.type+" *failure"]:[]],`    if (!state || ${occupied(value,"value")}${terminal?" || "+occupied(terminal,"failure"):""}) return ${p}INVALID;
    ${p}status rc=${p}request_${m.name}(s,task);
    if (rc!=${p}OK) return rc;
    return ${p}await_${m.name}(s,task,state,value${terminal?",failure":""});`);
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
#include <string.h>
#ifdef __cplusplus
extern "C" {
#endif
/* Open, use and close sessions on the process main thread. Start needs a fresh
 * zero-initialized owner output. START_ERROR returns the typed factory error and
 * leaves that owner empty. FAILED delivers a terminal error once, leaving the
 * value untouched. A returned Except is a value (READY for tasks, ITEM for cursors).
 * Opening or observing an idle cursor does not pull. Request one item, then poll
 * or await; next combines request and await. BUSY leaves the pending delivery
 * untouched. END marks exhaustion; the next request returns FINISHED. Drop on
 * early exit. Copies become stale together. A PENDING fd is borrowed: do not
 * read or close it; it expires on delivery, cancellation, drop, or session close.
 * Await blocks this thread; use poll to interleave work. Returned strings are
 * independent, nul-terminated byte spans (embedded NULs remain significant).
 * Zero-initialize any output that can own strings, then dispose it with its
 * generated dispose function before reusing that slot. */
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
