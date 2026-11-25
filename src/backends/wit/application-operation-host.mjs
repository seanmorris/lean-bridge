/** @file Generate Wasmtime imports calling the original, compiled synchronous Lean exports. */
import { cIdentifier } from "../c/generate.mjs";
import { cHostCodecs } from "../c/host-codecs.mjs";

/**
 * Render a validated copied Wasmtime input for a native call.
 *
 * @param t - Checked copied ABI type.
 * @param a - Native argument variable to initialize.
 * @param arg - Native C type of that argument.
 * @param v - Wasmtime value expression to read.
 */
export const witOpInbound=(t,a,arg,v)=>{
	if(t.k==="unit")return `if(${v}.kind!=WASMTIME_COMPONENT_U8 || ${v}.of.u8){invalid=true;goto done;}`;
	const kind=t.k.toUpperCase(),words="uint64_t w[3]={0};";
	const body=t.k==="bytes"||t.k==="string"||t.k==="int"||t.k==="nat"
		?`${a}=(${arg}){(const void *)(uintptr_t)w[0],w[1]${t.k==="int"||t.k==="nat"?",w[2]!=0":""}};`
		:t.k.startsWith("float")?`memcpy(&${a},w,sizeof(${a}));`:`${a}=(${arg})w[0];`;
	return `{${words}if(!lb_input(LB_${kind},&${v},&scope,w)){invalid=true;goto done;}${body}}`;
};
/**
 * Render a value result, delegating nominal ownership to the chosen transport.
 *
 * @param t - Checked result or variant arm.
 * @param v - Native source expression.
 * @param d - Wasmtime destination pointer expression.
 * @param resources - Ordered guest resource inventory.
 * @param depth - Nesting level for generated local names.
 * @param nominal - Optional emitter for a resource in the selected transport.
 */
export const witOpEmit=(t,v,d,resources,depth=0,nominal=null)=>{
	if(t.slot!==undefined)
	{
		if(nominal)return nominal(t.slot,v,d);
		const n=resources[t.slot].name.replaceAll("-","_");
		return `if(!lwit_no_error(lwit_export_${n}(b,${v},&moved))){goto done;}slot=${t.slot};transfer=&moved;
        *(${d})=(lb_val){.kind=WASMTIME_COMPONENT_U32,.of.u32=0};`;
	}
	if(t.left)
	{
		const child="child"+depth,src="("+v+")";
		return `{lb_val *${child}=NULL;if(lb_result(${d},${src}.ok,&${child},&scope)!=LB_GOOD)goto done;
        if(${src}.ok){${witOpEmit(t.left,src+".value",child,resources,depth+1,nominal)}}else{${witOpEmit(t.right,src+".error",child,resources,depth+1,nominal)}}}`;
	}
	if(t.k==="unit")return `if(${v}!=0){goto done;}*(${d})=(lb_val){.kind=WASMTIME_COMPONENT_U8,.of.u8=0};`;
	const pack=["bytes","string","nat","int"].includes(t.k)
		?`w[0]=(uintptr_t)(${v}).data;w[1]=(${v}).len;${t.k==="nat"||t.k==="int"?"w[2]=("+v+").negative;w[3]=2;":"w[3]=1;"}`
		:t.k.startsWith("float")?`memcpy(w,&(${v}),sizeof(${v}));`:`w[0]=(uint64_t)(${v});`;
	return `{uint64_t w[4]={0};${pack}if(lb_output(LB_${t.k.toUpperCase()},w,&scope,${d})!=LB_GOOD)goto done;}`;
};
/**
 * All typed inputs, results, original exceptions and declared values use
 * the generated native facade. Move at most one selected result owner into
 * the graph, after copied-value conversion and native cleanup succeed.
 *
 * @param o - Checked operations, source IR, native model and package name.
 */
export const witOperationHost=o=>{
	const {operations,ir,model,name}=o,{contract,methods}=operations;
	const p=cIdentifier(name)+"_", {byRef}=cHostCodecs(ir,model.kinds,p,[]),error=contract.resources.length;
	const bodies=methods.map(m=>{
		const e=m.entry,n=cIdentifier(e.name),r=byRef(e.result,n+"_value"),f=e.error&&byRef(e.error,n+"_failure");
		const args=e.parameters.map(v=>byRef(v.type,n+"_arg")),nominal=m.params.flatMap(({type},j)=>type.slot!==undefined?[j]:[]);
		const names=args.map((_,i)=>"a"+i),success=witOpEmit(m.result,"value","dest",contract.resources);
		const fallback=m.declared?witOpEmit(m.declared,"failure","detail",contract.resources):witOpEmit({k: "string"},"diag.message","detail",contract.resources);
		return `static wasmtime_error_t *lwit_op_${m.index}(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *ft,
    lb_val *args,size_t argc,lb_val *results,size_t resultc){
    (void)ft;(void)args;lwit_operations *g=data;lwit_bridge *b=&g->bridge;lwit_store *s=b->members.store;
    if(!lwit_open(s) || ctx!=s->ctx || argc!=${args.length} || resultc!=1)return wasmtime_error_new("invalid WIT call frame");
    lb_scope scope={.remaining=16u*1024u*1024u};lb_val result={0},*dest=&result;
    lwit_owner original={0},moved={0},*transfer=NULL;size_t slot=0;bool ok=false,invalid=false;
    ${p}diagnostic diag={0};${r.type} value={0};${f?f.type+" failure={0};":""}
    ${args.map((a,i)=>a.arg+" a"+i+"={0};").join("")}
    ${nominal.map(j=>"lwit_owner staged"+j+"={0};").join("")}
    ${[...nominal].reverse().map(j=>`if(!lwit_no_error(lwit_exchange_take(&g->slots[${m.params[j].type.slot}],&staged${j})))goto done;`).join("\n    ")}
    ${m.params.map(({type: t},j)=>t.slot===undefined?witOpInbound(t,names[j],args[j].arg,"args["+j+"]")
		:`if(args[${j}].kind!=WASMTIME_COMPONENT_U32 || args[${j}].of.u32){invalid=true;goto done;}`).join("\n    ")}
    ${nominal.map(j=>`if(!lwit_import_${contract.resources[m.params[j].type.slot].name.replaceAll("-","_")}(b,&staged${j},&a${j}))goto done;`).join("\n    ")}
    ${p}status status=lwit_sync_${n}(${["b",...names,"&value",...f?["&failure"]:[],"&original","&diag"].join(",")});
    ${!m.errors.length?`if(status!=${p}OK){goto done;}${success}`
		:`if(lb_result(&result,status==${p}OK,&dest,&scope)!=LB_GOOD)goto done;
    if(status==${p}OK){${success}}else{
        lb_val *detail=dest;${m.role==="invoke"?`if(lb_result(dest,status==${p}STALE,&detail,&scope)!=LB_GOOD)goto done;
        if(status==${p}STALE)*detail=(lb_val){.kind=WASMTIME_COMPONENT_U8};else {dest=detail;`:""}${m.member?`if(lb_result(dest,status==${p}HOST_ERROR,&detail,&scope)!=LB_GOOD)goto done;
        if(status==${p}HOST_ERROR){if(!original.any)goto done;transfer=&original;slot=${error};*detail=(lb_val){.kind=WASMTIME_COMPONENT_U32,.of.u32=0};}
        else `:""}if(status==${p}${f?"DECLARED_ERROR":"IO_ERROR"}){${fallback}}else goto done;${m.role==="invoke"?"}":""}}`}
    ok=true;
done:
    ${nominal.map(j=>`if(!lwit_no_error(lwit_drop(&staged${j}))){ok=false;}(void)${args[j].type}_drop(&a${j});`).join("\n    ")}
    ${r.clear("value")}${f?f.clear("failure"):""}${p}diagnostic_clear(&diag);lb_scope_close(&scope);
    if(ok && lwit_open(s) && transfer && !lwit_no_error(lwit_exchange_put(&g->slots[slot],transfer)))ok=false;
    if(!lwit_no_error(lwit_drop(&moved)))ok=false;
    if(!lwit_no_error(lwit_drop(&original)))ok=false;
    if(!ok || !lwit_open(s)){wasmtime_component_val_delete(&result);s->failed=true;
        return wasmtime_error_new(invalid?"invalid WIT argument or conversion limit: ${m.name}":"WIT application runtime failure: ${m.name}");}
    results[0]=result;return NULL;
}`;
	});
	const iface=JSON.stringify(operations.nativeName);
	return `/* Generated private link table for compiled Lean application operations. */
#include "application-dispatch.h"
#include "application-exchange.h"
typedef struct {lwit_bridge bridge;lwit_exchange slots[${error+1}];} lwit_operations;
${bodies.join("\n")}
static inline wasmtime_error_t *lwit_operations_link(wasmtime_component_linker_t *l,lwit_operations *g){
    if(!l || !g)return wasmtime_error_new("missing WIT linker");
    wasmtime_component_linker_instance_t *root=wasmtime_component_linker_root(l),*api=NULL;
    wasmtime_error_t *e=wasmtime_component_linker_instance_add_instance(root,${iface},sizeof(${iface})-1,&api);
    if(!e){
        ${methods.map(m=>`if(!e)e=wasmtime_component_linker_instance_add_func(api,"${m.name}",${m.name.length},lwit_op_${m.index},g,NULL);`).join("\n        ")}
        wasmtime_component_linker_instance_delete(api);
    }
    wasmtime_component_linker_instance_delete(root);return e;
}
static inline bool lwit_operations_open(lwit_store *s,lwit_operations *g){
    if(!g || !lwit_bridge_open(s,&g->bridge))return false;
    wasmtime_component_export_index_t *scope=wasmtime_component_instance_get_export_index(&s->instance,s->ctx,NULL,"private-exchange",16);
    bool ok=scope!=NULL;
    ${Array.from({length: error+1},(_,i)=>`if(ok)ok=lwit_exchange_bind(s,scope,${i===error?"g->bridge.members.error":"g->bridge.members.kinds["+i+"].type"},"put-item${i}","take-item${i}",&g->slots[${i}]);`).join("\n    ")}
    if(scope)wasmtime_component_export_index_delete(scope);
    if(!ok){(void)lwit_bridge_close(&g->bridge);memset(g->slots,0,sizeof g->slots);}
    return ok;
}
static inline ${p}status lwit_operations_close(lwit_operations *g){
    if(!g){return ${p}INVALID;}${p}status rc=lwit_bridge_close(&g->bridge);if(rc==${p}OK)memset(g->slots,0,sizeof g->slots);return rc;
}\n`;
};
