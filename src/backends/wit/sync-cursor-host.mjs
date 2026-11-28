/** @file Bind compiler-checked immediate cursor operations to a Wasmtime store. */
import {readFile} from "node:fs/promises";
import {nativeRuntimeState} from "../native/runtime-broker.mjs";

/**
 * Explain the cursor-owning embedding API in its release archive.
 *
 * @param p - Checked public C identifier prefix.
 */
export const witCursorUsage=p=>`Open a main-thread session with ${p}_wasmtime_open. For an application-owned store, use ${p}_wasmtime_link_cursors, then ${p}_wasmtime_instantiate. The linker, component and store must use the same engine. Custom embedders must leave the high half of the Wasmtime host-resource type IDs to the packaged cursor provider.

Call a factory using ${p}_wasmtime_call. Borrow its owned resource for one next call at a time. A successful pull returns an option; a declared factory or step failure uses the outer result. Neither opening nor dropping pulls an item. Use ${p}_wasmtime_drop before deleting the returned resource's C box. Close the session on the owner thread to finalize any live cursors. A trap invalidates the session and an unexpected trap retires the shared runtime. Do not retry an effectful call.`;

/**
 * Public embedding API for a world containing store-owned cursor resources.
 *
 * @param model - Compiler-checked synchronous WIT layout.
 */
export const witCursorHeader = model=>{
	const p=model.layout.prefix;
	return `#ifndef ${p.toUpperCase()}_WASMTIME_H
#define ${p.toUpperCase()}_WASMTIME_H
#include <wasmtime.h>
#include <wasmtime/component.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct ${p}_wasmtime ${p}_wasmtime;
/* A ready private instance, or attach a scope to your own store and linker,
 * then instantiate the component with that scope. Use the process main thread.
 * Close the scope before destroying a caller-owned store or linker. */
wasmtime_error_t *${p}_wasmtime_open(${p}_wasmtime **out);
wasmtime_error_t *${p}_wasmtime_link_cursors(wasmtime_store_t *store,wasmtime_component_linker_t *linker,${p}_wasmtime **out);
wasmtime_error_t *${p}_wasmtime_instantiate(${p}_wasmtime *session,const wasmtime_component_t *component);
/* A factory returns an owned resource, possibly in the ok arm of a result.
 * Pass that resource value to the declared next function by borrow. Keep its
 * original Wasmtime box until drop. Other copied result values are independent. */
wasmtime_error_t *${p}_wasmtime_call(${p}_wasmtime *session,const char *name,
    const wasmtime_component_val_t *args,size_t count,wasmtime_component_val_t *out);
/* Consumes and clears the resource value, not its enclosing result. Delete
 * the enclosing value with wasmtime_component_val_delete after dropping.
 * Closing the session finalizes any remaining native cursor; free its C box. */
wasmtime_error_t *${p}_wasmtime_drop(${p}_wasmtime *session,wasmtime_component_val_t *owner);
void ${p}_wasmtime_close(${p}_wasmtime *session);
#ifdef __cplusplus
}
#endif
#endif
`;
};

/**
 * Generate fixed imports and a session from the checked native entry table.
 *
 * @param model - Reconciled public WIT and private native wire.
 * @param bytes - Component binary validated against the generated world.
 * @param decode - Native wire to Wasmtime value decoder for this declaration.
 */
export const witCursorSession=async(model,bytes,decode)=>{
	const {wire,methods}=model,p=model.layout.prefix;
	const direct=wire.methods.flatMap((m,i)=>m.delivery?[{m,w: methods[i],i}]:[]);
	const order=new Map(direct.map(({i},k)=>[i,k]));
	const leaf=k=>"LB_"+k.toUpperCase();
	const table=direct.map(({m,w},k)=>{
		if(m.delivery!=="iterator" || !w.next || !w.resource) throw new TypeError("Expected a checked immediate WIT cursor");
		const fn=(name,type)=>type?"lb_direct_"+name+k:"NULL";
		const decoders=[["item",m.result],["open_failure",m.error],["step_failure",m.terminal]].filter(([,type])=>type)
			.map(([name,type])=>`static int ${fn(name,type)}(const uint64_t *w,const uint8_t *tags,lb_scope *scope,lb_val *out) {
    const size_t ntags=${m.tagBytes}; ${decode(type,0)}
}`);
		return {code: [`extern int ${m.names.open}(const uint64_t *,uint64_t *,uint64_t *,uint8_t *);`
			, `extern int ${m.names.next}(uint64_t *,uint64_t *,uint8_t *);`
			, `extern int ${m.names.close}(uint64_t *);`,...decoders].join("\n")
			, row: `{${JSON.stringify(w.resource)},${JSON.stringify(w.witName)},${JSON.stringify(w.next)},${m.args.length},${m.tagBytes},
    ${m.args.length?"(const int[]){"+m.args.map(leaf).join(",")+"}":"NULL"},${m.effect==="IO"?4:3},${m.stepIO?4:3},
    ${m.names.open},${m.names.next},${m.names.close},${fn("item",m.result)},${fn("open_failure",m.error)},${fn("step_failure",m.terminal)}}`};
	});
	const source=await readFile(new URL("./sync-cursor-imports.h",import.meta.url),"utf8");
	const imports=source.replace("/* LB_DIRECT_METHODS */",()=>table.map(t=>t.code).join("\n")
		+"\nstatic const lb_direct_method lb_direct_methods[]={"+table.map(t=>t.row).join(",\n")+"};");
	const checks=[],links=[];
	for(const [i,m] of wire.methods.entries())
	{
		const w=methods[i],k=order.get(i);
		checks.push(`if (!strcmp(name,${JSON.stringify(w.witName)})) {
        if (count!=${m.args.length}${m.args.map((a,j)=>" || !lb_input("+leaf(a)+",args+"+j+",&scope,NULL)").join("")}) return false;
        *opened=${k??-1}; return true; }`);
		if(k!==undefined)
			checks.push(`if (!strcmp(name,${JSON.stringify(w.next)})) return count==1 && lb_outward(s,args,${k})>=0;`);
		else links.push(`if (!err) err=wasmtime_component_linker_instance_add_func(host,${JSON.stringify(w.witName)},${w.witName.length},lb_call_${i},NULL,NULL);`);
	}
	const session=await readFile(new URL("./sync-cursor-session.h",import.meta.url),"utf8");
	return `#define LB_DIRECT_KINDS ${direct.length}
#define LB_DIRECT_TAGS ${Math.max(...direct.map(({m})=>m.tagBytes))}
#define LB_DIRECT_WORDS ${Math.max(1,...direct.map(({m})=>m.args.length*3))}
#define LB_DIRECT_CLEAR ${wire.clear}
#define LB_DIRECT_COLD ${nativeRuntimeState.cold}
#define LB_DIRECT_READY ${nativeRuntimeState.ready}
${imports}
static const uint8_t lb_component[]={${[...bytes].join(",")}};
#define LB_DIRECT_IMPORT ${JSON.stringify(model.importName)}
#define LB_DIRECT_EXPORT ${JSON.stringify(model.exportName)}
${session.replaceAll("LB_SESSION",p+"_wasmtime").replace("/* LB_CHECKS */",()=>checks.join("\n"))
	.replace("/* LB_LINK_SCALAR */",()=>links.join("\n"))}`;
};
