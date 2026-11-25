/** @file Bridge graph-local canonical future ownership to typed compiled Lean tasks. */

/**
 * Generate one per-instance readiness reactor. An owned result stays in its
 * address-stable slot until the graph takes it; a Wasmtime value wrapper alone
 * cannot stand in for the defining component's resource destructor.
 *
 * @param m - Reconciled nominal input, output, native declarations and row limit.
 */
export const objectFutureHost=m=>{
	const {p,n,label,capacity,a,z,from,to,input,output}=m,f="lwit_future_"+n,j=p+n;
	return `/* Include after application-operations.h. */
#include "canonical-future-reactor.h"
typedef struct {${j}_handle job; lwit_owner result; lwit_operations *ops;} ${f}_slot;
typedef struct {
    lwit_operations *ops; lb_cf_reactor r; wasmtime_component_func_t retire; lb_cf_row rows[${capacity}];
    struct pollfd fds[${capacity}]; ${f}_slot slots[${capacity}];
} ${f};
static void ${f}_release(void *data){
    ${f}_slot *s=data;
    bool ok=${j}_close(&s->job)==${p}OK;
    if(!lwit_no_error(lwit_drop(&s->result)) || !ok)s->ops->bridge.members.store->failed=true;
}
static bool ${f}_take(void *data,wasmtime_component_val_t *marker){
    ${f}_slot *s=data; ${output} out={0}; ${p}diagnostic d={0};
    bool ok=${j}_take(&s->job,&out,&d)==${p}OK;
    if(ok)ok=lwit_no_error(lwit_export_${to}(&s->ops->bridge,out,&s->result));
    if(${output}_drop(&out)!=${p}OK)ok=false;
    ${p}diagnostic_clear(&d);
    if(ok)*marker=(wasmtime_component_val_t){.kind=WASMTIME_COMPONENT_U32,.of.u32=0};
    return ok;
}
static wasmtime_error_t *${f}_start(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *ft,
    lb_val *args,size_t argc,lb_val *result,size_t resultc){
    (void)ft;(void)args;${f} *s=data;lwit_operations *ops=s->ops;
    if(!ops || !lwit_open(ops->bridge.members.store) || ctx!=s->r.ctx || argc || resultc!=1)
        return wasmtime_error_new("invalid object future start");
    lwit_owner owner={0}; ${input} arg={0}; ${p}diagnostic d={0};
    bool ok=false;unsigned key=0; ${f}_slot *slot=NULL;int fd=-1;
    if(!lwit_no_error(lwit_exchange_take(&ops->slots[${a}],&owner)))goto done;
    key=lb_cf_reserve(&s->r);if(!key || !lwit_import_${from}(&ops->bridge,&owner,&arg))goto done;
    slot=&s->slots[key-1];slot->ops=ops;
    if(${j}_start(ops->bridge.binding,arg,&slot->job,&d)!=${p}OK)goto done;
    ${p}status state=${j}_poll(slot->job,&fd);
    if(state!=${p}OK && (state!=${p}PENDING || fd<0))goto done;
    ok=lb_cf_arm(&s->r,key,state==${p}OK?-1:fd,slot,${f}_take,${f}_release);
done:
    ${p}diagnostic_clear(&d);
    if(${input}_drop(&arg)!=${p}OK)ok=false;
    if(!lwit_no_error(lwit_drop(&owner)))ok=false;
    if(!ok || !lwit_open(ops->bridge.members.store)){
        if(slot)${f}_release(slot);
        if(key)s->rows[key-1]=(lb_cf_row){0};
        ops->bridge.members.store->failed=true;return lb_cf_fail(&s->r,"cannot start compiled object future");
    }
    *result=(lb_val){.kind=WASMTIME_COMPONENT_U32,.of.u32=key};return NULL;
}
static wasmtime_error_t *${f}_stage(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *ft,
    lb_val *args,size_t argc,lb_val *result,size_t resultc){
    (void)ft;(void)result;${f} *s=data;unsigned key=s->r.staged_key;
    if(!s->ops || ctx!=s->r.ctx || !lwit_open(s->ops->bridge.members.store) ||
        !s->r.staged || !key || key>${capacity} || argc!=1 || resultc ||
        args->kind!=WASMTIME_COMPONENT_U32 || args->of.u32!=key ||
        s->r.staged->kind!=WASMTIME_COMPONENT_U32 || s->r.staged->of.u32)
        return lb_cf_fail(&s->r,"invalid object future payload claim");
    wasmtime_error_t *e=lwit_exchange_put(&s->ops->slots[${z}],&s->slots[key-1].result);
    if(!e)s->r.staged=NULL;
    return e;
}
static inline wasmtime_error_t *${f}_link(wasmtime_component_linker_t *l,${f} *s){
    wasmtime_component_linker_instance_t *root=wasmtime_component_linker_root(l);
    wasmtime_error_t *e=wasmtime_component_linker_instance_add_func(root,"${label}-native-start",${label.length+13},${f}_start,s,NULL);
    if(!e)e=wasmtime_component_linker_instance_add_func(root,"${label}-native-stage",${label.length+13},${f}_stage,s,NULL);
    wasmtime_component_linker_instance_delete(root);return e;
}
static inline bool ${f}_open(${f} *s,lwit_operations *ops){
    if(!s || !ops || s->r.rows || !lwit_open(ops->bridge.members.store))return false;
    lwit_store *g=ops->bridge.members.store;
    lb_cf_reactor r={.capacity=${capacity},.rows=s->rows,.fds=s->fds,.ctx=g->ctx,.pull_payload=true};
    if(!lwit_lookup(g,NULL,"${label}-deliver",&r.deliver) || !lwit_lookup(g,NULL,"${label}-reap",&r.reap) ||
        !lwit_lookup(g,NULL,"${label}-retire",&s->retire))return false;
    s->r=r;s->ops=ops;return true;
}
static inline wasmtime_error_t *${f}_shutdown(${f} *s){
    if(!s || !s->ops)return NULL;
    if(!lwit_open(s->ops->bridge.members.store))s->r.poisoned=true;
    wasmtime_error_t *e=s->r.poisoned?NULL:lb_cf_reap(&s->r);
    for(unsigned i=0;!e && !s->r.poisoned && i<${capacity};i++){
        if(s->rows[i].phase!=LB_CF_WRITER)continue;
        lb_val key={.kind=WASMTIME_COMPONENT_U32,.of.u32=i+1};
        e=wasmtime_component_func_call(&s->retire,s->r.ctx,&key,1,NULL,0);
    }
    lb_cf_shutdown(&s->r);
    for(unsigned i=0;i<${capacity};i++)if(!lwit_no_error(lwit_drop(&s->slots[i].result)))s->ops->bridge.members.store->failed=true;
    s->ops=NULL;return e;
}
`;
};
