/* A private, graph-local handoff. The embedding and facade move canonical
 * owners; they never receive a resource's i32 representation. */
#ifndef LB_WIT_APPLICATION_EXCHANGE_H
#define LB_WIT_APPLICATION_EXCHANGE_H
#include "application-member-types.h"
typedef struct {
    lwit_store *store;
    const wasmtime_component_resource_type_t *type;
    wasmtime_component_func_t put,take;
} lwit_exchange;
static inline bool lwit_exchange_bind(lwit_store *s,const wasmtime_component_export_index_t *scope,
    const wasmtime_component_resource_type_t *type,const char *put,const char *take,lwit_exchange *out){
    if(!scope || !type || !out || out->store)return false;
    lwit_exchange e={.store=s,.type=type};lwit_shape owned={WASMTIME_COMPONENT_VALTYPE_OWN,type};
    lwit_param p={"value",owned};
    if(!lwit_member_bind(s,scope,put,&p,1,(lwit_shape){LWIT_VOID,NULL},NULL,&e.put) ||
       !lwit_member_bind(s,scope,take,NULL,0,owned,NULL,&e.take))return false;
    *out=e;return true;
}
static inline wasmtime_error_t *lwit_exchange_put(lwit_exchange *e,lwit_owner *owner){
    if(!e || !owner || owner->source!=e->store || !lwit_has_type(e->store,e->type,owner))
        return wasmtime_error_new("foreign WIT exchange owner");
    wasmtime_component_val_t v={0};
    if(!lwit_give(owner,&v))return wasmtime_error_new("cannot move a registered WIT owner");
    wasmtime_error_t *err=wasmtime_component_func_call(&e->put,e->store->ctx,&v,1,NULL,0);
    wasmtime_component_val_delete(&v);if(err)e->store->failed=true;
    return err;
}
static inline wasmtime_error_t *lwit_exchange_take(lwit_exchange *e,lwit_owner *out){
    if(!e || !lwit_open(e->store) || !out || out->source || out->any)
        return wasmtime_error_new("unavailable WIT exchange destination");
    wasmtime_component_val_t v={0};
    wasmtime_error_t *err=wasmtime_component_func_call(&e->take,e->store->ctx,NULL,0,&v,1);
    if(!err && !lwit_take_type(e->store,e->type,&v,out))err=wasmtime_error_new("invalid WIT exchange result");
    if(err)e->store->failed=true;
    wasmtime_component_val_delete(&v);return err;
}
#endif
