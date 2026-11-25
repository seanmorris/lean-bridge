/* Private Wasmtime 42 adapter for imported, application-defined resources.
 * Session entry/close is confined to the store owner. Bind to an instance
 * just instantiated by that session; never accept a caller's function or
 * instance index paired with an unrelated context. */
#ifndef LB_WIT_APPLICATION_OBJECT_STORE_H
#define LB_WIT_APPLICATION_OBJECT_STORE_H
#include <wasmtime.h>
#include <stdint.h>
#include <string.h>

typedef struct lwit_owner lwit_owner;
typedef struct lwit_box lwit_box;
typedef struct {
    wasmtime_context_t *ctx;
    wasmtime_component_instance_t instance;
    lwit_owner *owners;
    uint64_t revision;
    unsigned active;
    bool failed, closing;
} lwit_store;
typedef struct {
    lwit_store *store;
    wasmtime_component_resource_type_t *type;
    wasmtime_component_func_t retain,same;
} lwit_class;
/* Move-only, address-stable slots allocated by the binding. Closing a store
 * retires every live slot before its context disappears. No finalizer may
 * subsequently touch the destroyed store. Classes need not outlive slots. */
struct lwit_owner {
    lwit_store *source;
    wasmtime_component_resource_any_t *any;
    lwit_owner **prev,*next;
    lwit_box *box;
};

static inline bool lwit_open(const lwit_store *s) {
    return s && s->ctx && !s->failed && !s->closing;
}

static inline bool lwit_lookup(lwit_store *s,const wasmtime_component_export_index_t *scope,
                               const char *name,wasmtime_component_func_t *out) {
    if(!lwit_open(s) || !name || !out)return false;
    wasmtime_component_export_index_t *index=wasmtime_component_instance_get_export_index(
        &s->instance,s->ctx,scope,name,strlen(name));
    if(!index)return false;
    bool ok=wasmtime_component_instance_get_func(&s->instance,s->ctx,index,out);
    wasmtime_component_export_index_delete(index);return ok;
}
static inline void lwit_class_clear(lwit_class *k) {
    if(k->type)wasmtime_component_resource_type_delete(k->type);
    *k=(lwit_class){0};
}
/* Check both borrow<T> -> own<T> and (borrow<T>,borrow<T>) -> bool against
 * the instantiated resource type, including distinct generative instances. */
static inline bool lwit_class_bind(lwit_store *s,const wasmtime_component_export_index_t *scope,
                                   const char *retain,const char *same,lwit_class *out) {
    if(!lwit_open(s) || !scope || !out || out->store || out->type)return false;
    lwit_class k={.store=s};
    if(!lwit_lookup(s,scope,retain,&k.retain) || !lwit_lookup(s,scope,same,&k.same))return false;
    for(unsigned i=0;i<2;i++){
        wasmtime_component_func_type_t *ft=wasmtime_component_func_type(i?&k.same:&k.retain,s->ctx);
        bool ok=wasmtime_component_func_type_param_count(ft)==i+1;
        for(unsigned j=0;ok && j<=i;j++){
            wasmtime_component_valtype_t t;const char *name=NULL;size_t n=0;
            ok=wasmtime_component_func_type_param_nth(ft,j,&name,&n,&t);
            if(ok){
                ok=t.kind==WASMTIME_COMPONENT_VALTYPE_BORROW;
                if(ok && !k.type) k.type=wasmtime_component_resource_type_clone(t.of.borrow);
                if(ok) ok=k.type && wasmtime_component_resource_type_equal(k.type,t.of.borrow);
                wasmtime_component_valtype_delete(&t);
            }
        }
        wasmtime_component_valtype_t result;
        if(ok && wasmtime_component_func_type_result(ft,&result)){
            ok=i?result.kind==WASMTIME_COMPONENT_VALTYPE_BOOL:result.kind==WASMTIME_COMPONENT_VALTYPE_OWN &&
                wasmtime_component_resource_type_equal(result.of.own,k.type);
            wasmtime_component_valtype_delete(&result);
        }else ok=false;
        wasmtime_component_func_type_delete(ft);
        if(!ok){lwit_class_clear(&k);return false;}
    }
    *out=k;return true;
}
/* Only the result of a successful call in 'source' can enter here. Ownership
 * moves from the Wasmtime result on success and stays with it on failure. */
static inline bool lwit_take_type(lwit_store *source,const wasmtime_component_resource_type_t *type,wasmtime_component_val_t *v,lwit_owner *out) {
    if(!lwit_open(source) || !type || !v || !out || out->source || out->any ||
       v->kind!=WASMTIME_COMPONENT_RESOURCE || !v->of.resource || !wasmtime_component_resource_any_owned(v->of.resource))return false;
    wasmtime_component_resource_type_t *actual=wasmtime_component_resource_any_type(v->of.resource);
    bool ok=wasmtime_component_resource_type_equal(type,actual);wasmtime_component_resource_type_delete(actual);
    if(ok){
        *out=(lwit_owner){.source=source,.any=v->of.resource,.prev=&source->owners,.next=source->owners};
        if(out->next)out->next->prev=&out->next;
        source->owners=out;*v=(wasmtime_component_val_t){0};
    }
    return ok;
}
static inline bool lwit_take(lwit_store *source,lwit_class *k,wasmtime_component_val_t *v,lwit_owner *out) {
    return lwit_open(source) && k && lwit_open(k->store) && source->ctx==k->store->ctx && lwit_take_type(source,k->type,v,out);
}
/* Move out the canonical owner, without running a destructor. Its receiver
 * must consume or drop it. Never move a slot published in the native registry. */
static inline bool lwit_give(lwit_owner *v,wasmtime_component_val_t *out) {
    if(!v || v->box || !lwit_open(v->source) || !v->any || !out)return false;
    *v->prev=v->next;if(v->next)v->next->prev=v->prev;
    *out=(wasmtime_component_val_t){.kind=WASMTIME_COMPONENT_RESOURCE,.of.resource=v->any};
    *v=(lwit_owner){0};return true;
}
static inline wasmtime_error_t *lwit_drop(lwit_owner *v) {
    if(!v || !v->any)return NULL;
    lwit_owner old=*v;
    *old.prev=old.next;if(old.next)old.next->prev=old.prev;
    *v=(lwit_owner){0};
    lwit_store *s=old.source;
    // A trapped store will be destroyed. Never execute a guest destructor
    // in a poisoned instance; the C ResourceAny wrapper still needs deletion.
    wasmtime_error_t *e=s->failed?NULL:wasmtime_component_resource_any_drop(s->ctx,old.any);
    if(e)s->failed=true;
    wasmtime_component_resource_any_delete(old.any);return e;
}
/* Call before deleting the underlying Wasmtime store. Retain the first trap
 * for the caller and release wrappers without executing more guest code. */
static inline wasmtime_error_t *lwit_shutdown(lwit_store *s) {
    if(!s || !s->ctx || s->closing)return NULL;
    if(s->active)return wasmtime_error_new("cannot close an active WIT application binding");
    s->closing=true;
    wasmtime_error_t *first=NULL;
    while(s->owners){
        wasmtime_error_t *e=lwit_drop(s->owners);
        if(!first) first=e; else if(e) wasmtime_error_delete(e);
    }
    s->ctx=NULL;return first;
}
static inline bool lwit_has_type(const lwit_store *s,const wasmtime_component_resource_type_t *expected,const lwit_owner *v) {
    if(!expected || !lwit_open(s) || !v || !v->any ||
       !lwit_open(v->source) || s->ctx!=v->source->ctx)return false;
    wasmtime_component_resource_type_t *type=wasmtime_component_resource_any_type(v->any);
    bool same=wasmtime_component_resource_type_equal(type,expected);
    wasmtime_component_resource_type_delete(type);return same;
}
static inline bool lwit_is(const lwit_class *k,const lwit_owner *v) {
    return k && lwit_has_type(k->store,k->type,v);
}
static inline wasmtime_error_t *lwit_retain(lwit_class *k,const lwit_owner *v,lwit_owner *out) {
    if(!lwit_is(k,v) || !out || out->source || out->any)
        return wasmtime_error_new("foreign, closed or occupied WIT owner");
    wasmtime_component_val_t arg={.kind=WASMTIME_COMPONENT_RESOURCE,.of.resource=v->any},result={0};
    wasmtime_error_t *e=wasmtime_component_func_call(&k->retain,k->store->ctx,&arg,1,&result,1);
    if(e){k->store->failed=true;return e;}
    if(!lwit_take(k->store,k,&result,out)){k->store->failed=true;wasmtime_component_val_delete(&result);
        return wasmtime_error_new("invalid retained WIT owner");}
    return NULL;
}
static inline wasmtime_error_t *lwit_same(lwit_class *k,const lwit_owner *a,const lwit_owner *b,bool *out) {
    if(!out || !lwit_is(k,a) || !lwit_is(k,b))
        return wasmtime_error_new("cannot compare foreign or closed WIT owners");
    wasmtime_component_val_t args[2]={{.kind=WASMTIME_COMPONENT_RESOURCE,.of.resource=a->any},
                                      {.kind=WASMTIME_COMPONENT_RESOURCE,.of.resource=b->any}},result={0};
    wasmtime_error_t *e=wasmtime_component_func_call(&k->same,k->store->ctx,args,2,&result,1);
    if(e){k->store->failed=true;return e;}
    if(result.kind!=WASMTIME_COMPONENT_BOOL){k->store->failed=true;wasmtime_component_val_delete(&result);
        return wasmtime_error_new("invalid WIT identity reply");}
    *out=result.of.boolean;return NULL;
}
#endif
