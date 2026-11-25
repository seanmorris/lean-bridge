/** @file Generate a Wasmtime host over the checked, synchronous native Lean wire. */
import { readFile } from "node:fs/promises";
import { witConversionPrelude } from "./copied-conversions.mjs";
import { renderWitHostHeader, renderWitValueSession } from "./copied-host.mjs";

const leaf = type => "LB_"+type.toUpperCase();
/**
 * Decode one nested wire result into an owned Wasmtime value.
 *
 * @param type - Authenticated native wire shape (result pairs are ok/error).
 * @param at - Next tag in the fixed-width native reply.
 */
export const decodeWitWireValue = (type,at) => Array.isArray(type) ? `
    if (tags[${at}]>1) return LB_MALFORMED;
    { bool ok=tags[${at}]!=0; int s=lb_result(out,ok,&out,scope); if (s) return s;
      if (ok) { ${decodeWitWireValue(type[0],at+1)} } else { ${decodeWitWireValue(type[1],at+1)} } }` : `
    for (size_t i=${at};i<ntags;i++) if (tags[i]) return LB_MALFORMED;
    return lb_output(${leaf(type)},w,scope,out);`;

/**
 * Emit one fixed import per authenticated declaration. Only the tag for
 * that declaration's own Lean effect is classified as a failure result.
 *
 * @param model - Compiler-reconciled WIT IO projection.
 * @param componentBytes - Binary validated against that exact WIT world.
 */
export const generateWitSyncHost = async (model,componentBytes) => {
	if(model.wire.methods.some(m=>m.delivery)) throw new TypeError("An immediate WIT cursor requires a resource-owning host session");
	const {wire,methods,layout: surface} = model, p = surface.prefix;
	const values = await readFile(new URL("./sync-io-values.h",import.meta.url),"utf8");
	const functions = wire.methods.map((m,i)=>({ witName: methods[i].witName, parameters: m.args.map(k=>({copy: {index: k}})) }));
	const validators = [...new Set(wire.methods.flatMap(m=>m.args))].map(k=>`static inline bool lb_in_${k}(const lb_val *v, lb_scope *s, uint64_t *w) { return lb_input(${leaf(k)},v,s,w); }`);
	const calls = wire.methods.map((m,i)=>{
		const errorStatus = m.effect==="EIO"?3:4, input = m.args.map((k,j)=>`
    if (!lb_in_${k}(&args[${j}],&scope,a+${3*j})) { error=wasmtime_error_new("Invalid native WIT argument or conversion limit"); goto done; }`).join("");
		return `extern int ${m.symbol}(const uint64_t *,uint64_t *,uint8_t *);
static int lb_reply_${i}(int status,const uint64_t w[4],const uint8_t *tags,lb_scope *scope,lb_val *out) {
    const size_t ntags=${m.tagBytes};
    if (status!=0${m.error?" && status!="+errorStatus:""}) {
        if (w[0]||w[1]||w[2]||w[3]) return LB_MALFORMED;
        switch (status) { case 5: case 9: case 10: case 11: case 12: return LB_NATIVE_FAILURE; default: return LB_MALFORMED; }
    }
    ${m.error?`{ int s=lb_result(out,status==0,&out,scope); if (s) return s; }
    if (status!=0) { ${decodeWitWireValue(m.error,0)} }`:""}
    ${decodeWitWireValue(m.result,0)}
}
static wasmtime_error_t *lb_call_${i}(void *data,wasmtime_context_t *context,const wasmtime_component_func_type_t *type,
    lb_val *args,size_t count,lb_val *results,size_t result_count) {
    (void)data;(void)type;(void)args;
    if (!lb_active || lb_active->context!=context) return wasmtime_error_new("WIT IO requires a guarded call in this store");
    if (count!=${m.args.length} || (${m.args.length} && !args) || result_count!=1 || !results) return wasmtime_error_new("Wrong WIT call shape");
    lb_scope scope={.remaining=16u*1024u*1024u}; wasmtime_error_t *error=NULL;
    uint64_t a[${Math.max(1,m.args.length*3)}]={0},w[4]={0}; uint8_t tags[${m.tagBytes}]={0}; lb_val out={0};${input}
    int status=${m.symbol}(a,w,tags);
    int decoded=lb_reply_${i}(status,w,tags,&scope,&out);
    if (decoded==LB_GOOD) { results[0]=out; out=(lb_val){0}; }
    else if (decoded==LB_MALFORMED) { lean_bridge_native_runtime_retire(); error=wasmtime_error_new("Malformed Lean reply in ${m.declaration}; shared runtime retired"); }
    else error=wasmtime_error_new(decoded==LB_OVER_BUDGET?"WIT result conversion limit in ${m.declaration}":"Native bridge failure in ${m.declaration}");
    ${wire.clear}(w);
    ${m.args.length?"done:":""} wasmtime_component_val_delete(&out); lb_scope_close(&scope);
    if (error && lb_active && lb_active->context==context) lb_active->handled=true;
    return error;
}`;
	});
	const header = renderWitHostHeader({surface,trackIOTraps: true});
	const source = `#include "${p}_wasmtime.h"
#include "lean_bridge_native_runtime.h"
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
${witConversionPrelude}
${values}
enum { LB_NATIVE_FAILURE=3 };
/* A known import rejection is different from a Wasm trap before or after
   the import. Frames are scoped to the exact store and calling thread. */
typedef struct lb_call_frame { wasmtime_context_t *context; bool handled; struct lb_call_frame *previous; } lb_call_frame;
static _Thread_local lb_call_frame *lb_active;
extern void ${wire.clear}(uint64_t *);
${validators.join("\n")}
${calls.join("\n")}
${renderWitValueSession({...model,surface,functions,trackIOTraps: true},componentBytes)}`;
	return {header,source,prefix: p};
};
