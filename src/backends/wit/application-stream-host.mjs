/** @file Owner-thread driver for canonical streams backed by a compiled Lean cursor. */

/**
 * Pull only after a guest read. A canonical owner is held in its stable slot
 * until the Wasm adapter takes exactly that item or step error.
 *
 * @param m - Reconciled source protocol, typed native handles and guest resource slots.
 */
export const objectStreamHost=m=>{
	const {p,n,label,capacity,a,z,err,from,to,input,output,fault,faultKind}=m,f="lwit_stream_"+n,j=p+n;
	const typed=err!==null;
	return `#include "canonical-future-reactor.h"
typedef struct {${j}_handle handle; lwit_owner frame; lwit_operations *ops; bool error;} ${f}_slot;
typedef struct {lwit_operations *ops;lb_cf_reactor r;wasmtime_component_func_t retire;unsigned pumping;
    lb_cf_row rows[${capacity}];${f}_slot slots[${capacity}];} ${f};
static void ${f}_release(void *data){
    ${f}_slot *slot=data;
    bool ok=${j}_close(&slot->handle)==${p}OK;
    if(!lwit_no_error(lwit_drop(&slot->frame)) || !ok)slot->ops->bridge.members.store->failed=true;
}
static wasmtime_error_t *${f}_fail(${f} *s,const char *why){
    if(s->ops)s->ops->bridge.members.store->failed=true;
    return lb_cf_fail(&s->r,why);
}
static wasmtime_error_t *${f}_start(void *p,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *ft,
    lb_val *args,size_t argc,lb_val *out,size_t retc){
    (void)ft;(void)args;${f} *s=p;lwit_operations *ops=s->ops;
    if(!ops || !lwit_open(ops->bridge.members.store) || ctx!=s->r.ctx || argc || retc!=1)return wasmtime_error_new("invalid cursor factory");
    lwit_owner owner={0};${input} input={0};${p}diagnostic d={0};bool imported=false,ok=false;unsigned key=0;
    const char *why="no object cursor slot";wasmtime_error_t *error=lwit_exchange_take(&ops->slots[${a}],&owner);
    if(error)goto done;
    key=lb_cf_reserve(&s->r);if(!key)goto done;
    why="could not import cursor argument";if(!lwit_import_${from}(&ops->bridge,&owner,&input))goto done;
    imported=true;s->slots[key-1].ops=ops;
    why="could not start compiled Lean cursor";
    ok=${j}_start(ops->bridge.binding,input,&s->slots[key-1].handle,&d)==${p}OK;
done:
    if(imported && ${input}_drop(&input)!=${p}OK)ok=false;
    if(!lwit_no_error(lwit_drop(&owner)))ok=false;
    ${p}diagnostic_clear(&d);
    if(!ok){
        if(key){if(imported)${f}_release(&s->slots[key-1]);s->rows[key-1]=(lb_cf_row){0};}
        if(error){ops->bridge.members.store->failed=true;s->r.poisoned=true;return error;}
        return ${f}_fail(s,why);
    }
    s->rows[key-1]=(lb_cf_row){.phase=LB_CF_STREAM,.fd=-1,.owner=&s->slots[key-1],.close=${f}_release};
    *out=(lb_val){.kind=WASMTIME_COMPONENT_U32,.of.u32=key};return NULL;
}
static wasmtime_error_t *${f}_act(void *p,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *ft,
    lb_val *args,size_t argc,lb_val *out,size_t retc){
    (void)ft;${f} *s=p;unsigned key=s->pumping;
    if(!s->ops || !lwit_open(s->ops->bridge.members.store) || ctx!=s->r.ctx || !key || key>${capacity} || argc!=2 || retc!=1 ||
        args[0].kind!=WASMTIME_COMPONENT_U32 || args[0].of.u32!=key || args[1].kind!=WASMTIME_COMPONENT_U32)
        return ${f}_fail(s,"unexpected cursor operation");
    lb_cf_row *row=&s->rows[key-1];${f}_slot *slot=&s->slots[key-1];
    if(row->phase!=LB_CF_STREAM || !row->owner || slot->frame.any)return ${f}_fail(s,"cursor unavailable");
    unsigned op=args[1].of.u32;*out=(lb_val){.kind=WASMTIME_COMPONENT_U32};
    if(op==2){${f}_release(slot);*row=(lb_cf_row){0};return lwit_open(s->ops->bridge.members.store)?NULL:${f}_fail(s,"cursor cleanup failed");}
    if(op==0){
        if(row->requested || ${j}_pull(slot->handle)!=${p}OK)return ${f}_fail(s,"duplicate cursor pull");
        row->requested=true;return NULL;
    }
    if(op!=1 || !row->requested || s->r.staged_key)return ${f}_fail(s,"no matching object stream demand");
    int fd=-1;${p}status rc=${j}_poll(slot->handle,&fd);row->fd=fd;
    if(rc==${p}PENDING && fd>=0)return NULL;
    if(rc!=${p}OK || fd!=-1)return ${f}_fail(s,"invalid cursor notification");
    ${output} item={0};${typed?`${fault} error={0};`:""}${p}diagnostic d={0};
    rc=${j}_take(&slot->handle,&item,${typed?"&error,":""}&d);${p}diagnostic_clear(&d);
    row->requested=false;row->fd=-1;slot->error=false;
    if(rc==${p}END){out->of.u32=2;return NULL;}
    bool ok=false;
    if(rc==${p}OK){
        ok=lwit_no_error(lwit_export_${to}(&s->ops->bridge,item,&slot->frame));if(${output}_drop(&item)!=${p}OK)ok=false;
        out->of.u32=1;
    }${typed?`else if(rc==${p}STEP_ERROR){
        ok=lwit_no_error(lwit_export_${faultKind}(&s->ops->bridge,error,&slot->frame));if(${fault}_drop(&error)!=${p}OK)ok=false;
        out->of.u32=3;slot->error=true;
    }`:""}
    if(!ok)return ${f}_fail(s,"invalid nominal cursor result");
    s->r.staged_key=key;return NULL;
}
static wasmtime_error_t *${f}_stage(void *p,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *ft,
    lb_val *args,size_t argc,lb_val *out,size_t retc){
    (void)ft;${f} *s=p;unsigned key=s->pumping;
    if(!key || key>${capacity} || s->r.staged_key!=key || ctx!=s->r.ctx || argc!=1 || retc!=1 ||
        args->kind!=WASMTIME_COMPONENT_U32 || args->of.u32!=key)return ${f}_fail(s,"invalid cursor frame claim");
    ${f}_slot *slot=&s->slots[key-1];
    wasmtime_error_t *e=lwit_exchange_put(&s->ops->slots[${typed?`slot->error?${err}:${z}`:z}],&slot->frame);
    if(e)return e;
    *out=(lb_val){.kind=WASMTIME_COMPONENT_U32,.of.u32=slot->error};s->r.staged_key=0;return NULL;
}
static inline wasmtime_error_t *${f}_link(wasmtime_component_linker_t *l,${f} *s){
    wasmtime_component_linker_instance_t *root=wasmtime_component_linker_root(l);wasmtime_error_t *e=NULL;
    ${["start","stage","act"].map(x=>`if(!e)e=wasmtime_component_linker_instance_add_func(root,"${label}-native-${x}",${label.length+8+x.length},${f}_${x},s,NULL);`).join("\n    ")}
    wasmtime_component_linker_instance_delete(root);return e;
}
static inline bool ${f}_open(${f} *s,lwit_operations *ops){
    if(!s || s->r.rows || !ops || !lwit_open(ops->bridge.members.store))return false;
    lwit_store *g=ops->bridge.members.store;
    lb_cf_reactor r={.capacity=${capacity},.rows=s->rows,.ctx=g->ctx};
    if(!lwit_lookup(g,NULL,"${label}-pump",&r.pump) || !lwit_lookup(g,NULL,"${label}-retire",&s->retire))return false;
    s->r=r;s->ops=ops;return true;
}
static inline wasmtime_error_t *${f}_pump(${f} *s,unsigned key,unsigned *state){
    if(!s || !s->ops || !state || s->pumping || !key || key>${capacity} || s->r.poisoned || !lwit_open(s->ops->bridge.members.store) ||
        s->rows[key-1].phase!=LB_CF_STREAM)return wasmtime_error_new("unavailable object stream");
    lb_val arg={.kind=WASMTIME_COMPONENT_U32,.of.u32=key},out={0};s->pumping=key;
    wasmtime_error_t *e=wasmtime_component_func_call(&s->r.pump,s->r.ctx,&arg,1,&out,1);s->pumping=0;
    if(e){s->ops->bridge.members.store->failed=true;s->r.poisoned=true;return e;}
    if(s->r.staged_key || out.kind!=WASMTIME_COMPONENT_U32 || out.of.u32>2)return ${f}_fail(s,"cursor did not claim its frame");
    s->rows[key-1].wait_native=out.of.u32==1;*state=out.of.u32;return NULL;
}
static inline wasmtime_error_t *${f}_shutdown(${f} *s){
    if(!s || !s->ops)return NULL;
    wasmtime_error_t *e=NULL;
    for(unsigned i=0;!e && lwit_open(s->ops->bridge.members.store) && !s->r.poisoned && i<${capacity};i++){
        if(s->rows[i].phase!=LB_CF_STREAM)continue;
        lb_val key={.kind=WASMTIME_COMPONENT_U32,.of.u32=i+1};s->pumping=i+1;
        e=wasmtime_component_func_call(&s->retire,s->r.ctx,&key,1,NULL,0);s->pumping=0;
        if(e)s->ops->bridge.members.store->failed=true;
    }
    lb_cf_shutdown(&s->r);s->ops=NULL;return e;
}
`;
};
