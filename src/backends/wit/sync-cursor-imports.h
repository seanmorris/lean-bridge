/* Generated into the pinned Wasmtime host. A canonical resource owns one
 * native cursor. Exhaustion or a declared pull error consumes only its native
 * cursor; the WIT resource remains valid until its own canonical drop. */
#include <pthread.h>
#include <unistd.h>

typedef int (*lb_direct_decode)(const uint64_t *,const uint8_t *,lb_scope *,lb_val *);
typedef struct {
    const char *resource,*factory,*next; size_t nargs,ntags; const int *args;
    int open_error,step_error;
    int (*open)(const uint64_t *,uint64_t *,uint64_t *,uint8_t *);
    int (*pull)(uint64_t *,uint64_t *,uint8_t *); int (*close)(uint64_t *);
    lb_direct_decode item,open_failure,step_failure;
} lb_direct_method;
/* LB_DIRECT_METHODS */

enum { LB_DIRECT_LIMIT=256 };
typedef struct { uint32_t rep; size_t kind; uint64_t native[2]; } lb_direct_slot;
typedef struct lb_direct lb_direct;
typedef struct { lb_direct *owner; size_t kind; } lb_direct_binding;
struct lb_direct {
    wasmtime_context_t *ctx; pid_t pid; pthread_t thread; lb_direct *previous;
    uint32_t generation,tags[LB_DIRECT_KINDS]; lb_direct_binding bindings[LB_DIRECT_KINDS];
    lb_direct_slot slots[LB_DIRECT_LIMIT];
};
extern uint32_t lean_bridge_wit_cursor_brand_v1(void);
static _Thread_local lb_direct *lb_direct_stores;
/* Linkers may outlive an attached session. Carry an unrepeatable numeric
 * cookie, never a pointer to freed session storage, into Wasmtime. */
static lb_direct_binding *lb_direct_resolve(void *cookie,wasmtime_context_t *ctx) {
    uint32_t tag=(uint32_t)(uintptr_t)cookie;
    for (lb_direct *s=lb_direct_stores;s;s=s->previous) if (s->pid==getpid() && s->ctx==ctx)
        for (size_t i=0;i<LB_DIRECT_KINDS;i++) if (s->tags[i]==tag) return s->bindings+i;
    return NULL;
}
static bool lb_direct_affine(const lb_direct *s,wasmtime_context_t *ctx) {
    return s && ctx && s->ctx==ctx && s->pid==getpid() && pthread_equal(s->thread,pthread_self());
}
static bool lb_direct_empty(const uint64_t *w,const uint8_t *tags,size_t ntags) {
    if (w[0] || w[1] || w[2] || w[3]) return false;
    for (size_t j=0;j<ntags;j++) if (tags[j]) return false;
    return true;
}
static bool lb_direct_release(lb_direct_slot *slot) {
    bool ok=true;
    if (slot->native[0]) {
        ok=!lb_direct_methods[slot->kind].close(slot->native) && !slot->native[0];
        if (!ok) lean_bridge_native_runtime_retire();
    }
    *slot=(lb_direct_slot){0}; return ok;
}
static void lb_direct_shutdown(lb_direct *s) {
    if (!lb_direct_affine(s,s->ctx)) return;
    for (size_t j=0;j<LB_DIRECT_LIMIT;j++) if (s->slots[j].rep) (void)lb_direct_release(s->slots+j);
    lb_direct **p=&lb_direct_stores; while (*p && *p!=s) p=&(*p)->previous;
    if (*p) *p=s->previous;
    s->ctx=NULL; s->previous=NULL;
}
static bool lb_direct_exit_armed;
static void lb_direct_at_exit(void) {
    /* Never invoke Lean from a foreign-thread exit, a forked child, or an
     * active call. Normal main-thread exit needs no Wasmtime store access. */
    if (lb_active) return;
    while (lb_direct_stores && lb_direct_affine(lb_direct_stores,lb_direct_stores->ctx))
        lb_direct_shutdown(lb_direct_stores);
}
static lb_direct_slot *lb_direct_find(lb_direct *s,size_t k,uint32_t rep) {
    for (size_t j=0;rep && j<LB_DIRECT_LIMIT;j++)
        if (s->slots[j].rep==rep && s->slots[j].kind==k) return s->slots+j;
    return NULL;
}
static wasmtime_error_t *lb_direct_dtor(void *data,wasmtime_context_t *ctx,uint32_t rep) {
    lb_direct_binding *b=lb_direct_resolve(data,ctx);
    lb_direct_slot *slot=b?lb_direct_find(b->owner,b->kind,rep):NULL;
    if (!slot || !lb_direct_release(slot)) return wasmtime_error_new("Wrong store or invalid WIT cursor drop");
    return NULL;
}
static bool lb_direct_type(lb_direct *s,size_t kind,const lb_val *v,bool own) {
    if (!v || v->kind!=WASMTIME_COMPONENT_RESOURCE || !v->of.resource ||
        wasmtime_component_resource_any_owned(v->of.resource)!=own) return false;
    wasmtime_component_resource_type_t *actual=wasmtime_component_resource_any_type(v->of.resource);
    wasmtime_component_resource_type_t *want=wasmtime_component_resource_type_new_host(s->tags[kind]);
    bool match=wasmtime_component_resource_type_equal(actual,want);
    wasmtime_component_resource_type_delete(actual); wasmtime_component_resource_type_delete(want);
    return match;
}
static wasmtime_error_t *lb_direct_call(bool pull,void *data,wasmtime_context_t *ctx,
    lb_val *args,size_t count,lb_val *results,size_t nresults) {
    lb_direct_binding *b=lb_direct_resolve(data,ctx);
    if (!b || !lb_active || lb_active->context!=ctx)
        return wasmtime_error_new("WIT cursor requires a guarded call in its owning store");
    lb_direct *s=b->owner; const lb_direct_method *m=lb_direct_methods+b->kind;
    if (count!=(pull?1:m->nargs) || (count&&!args) || nresults!=1 || !results)
        return wasmtime_error_new("Wrong WIT cursor import signature");
    lb_scope scope={.remaining=16u*1024u*1024u}; lb_val reply={0},*branch=&reply;
    uint64_t a[LB_DIRECT_WORDS]={0},w[4]={0}; uint8_t tags[LB_DIRECT_TAGS]={0};
    lb_direct_slot *slot=NULL; wasmtime_error_t *err=NULL; int decoded=LB_GOOD,rc=0;
    if (!pull) {
        for (size_t j=0;j<count;j++) if (!lb_input(m->args[j],args+j,&scope,a+3*j)) {
            err=wasmtime_error_new("Invalid WIT cursor input"); goto done;
        }
        for (size_t j=0;j<LB_DIRECT_LIMIT;j++) if (!s->slots[j].rep) { slot=s->slots+j; break; }
        if (!slot || s->generation==UINT32_MAX) { err=wasmtime_error_new("WIT cursor capacity exhausted"); goto done; }
        if (!lb_direct_exit_armed && atexit(lb_direct_at_exit)) {
            err=wasmtime_error_new("Cannot register WIT cursor cleanup"); goto done;
        }
        lb_direct_exit_armed=true;
        slot->kind=b->kind;
        if (m->open_failure && (decoded=lb_result(&reply,true,&branch,&scope))!=LB_GOOD) goto done;
        rc=m->open(a,slot->native,w,tags);
        if (!rc) {
            if (!slot->native[0] || !slot->native[1] || !lb_direct_empty(w,tags,m->ntags)) goto malformed;
            slot->rep=++s->generation;
            wasmtime_component_resource_host_t *host=wasmtime_component_resource_host_new(true,slot->rep,s->tags[b->kind]);
            if (!host) { decoded=LB_OVER_BUDGET; goto done; }
            wasmtime_component_resource_any_t *owner=NULL;
            err=wasmtime_component_resource_host_to_any(ctx,host,&owner);
            wasmtime_component_resource_host_delete(host); if (err) goto done;
            *branch=(lb_val){.kind=WASMTIME_COMPONENT_RESOURCE,.of.resource=owner};
        } else if (slot->native[0] || slot->native[1]) goto malformed;
        else if (m->open_failure && rc==m->open_error) {
            reply.of.result.is_ok=false; decoded=m->open_failure(w,tags,&scope,branch);
        } else goto native_error;
    } else {
        if (!lb_direct_type(s,b->kind,args,false)) { err=wasmtime_error_new("Wrong WIT cursor borrow"); goto done; }
        wasmtime_component_resource_host_t *host=NULL;
        err=wasmtime_component_resource_any_to_host(ctx,args->of.resource,&host); if (err) goto done;
        slot=lb_direct_find(s,b->kind,wasmtime_component_resource_host_rep(host));
        wasmtime_component_resource_host_delete(host);
        if (!slot) { err=wasmtime_error_new("Expired WIT cursor"); goto done; }
        if (m->step_failure && (decoded=lb_result(&reply,true,&branch,&scope))!=LB_GOOD) goto done;
        uint64_t id=slot->native[0],domain=slot->native[1];
        rc=id?m->pull(slot->native,w,tags):2;
        if (slot->native[1]!=domain || (!rc && (!id || slot->native[0]!=id))) goto malformed;
        if (!rc) {
            if (!lb_charge(&scope,1,sizeof(lb_val))) { decoded=LB_OVER_BUDGET; goto done; }
            lb_val empty={0}; branch->kind=WASMTIME_COMPONENT_OPTION;
            branch->of.option=wasmtime_component_val_new(&empty);
            decoded=branch->of.option?m->item(w,tags,&scope,branch->of.option):LB_OVER_BUDGET;
        } else if (rc==2) {
            if (slot->native[0] || !lb_direct_empty(w,tags,m->ntags)) goto malformed;
            branch->kind=WASMTIME_COMPONENT_OPTION;
        } else if (m->step_failure && rc==m->step_error) {
            if (slot->native[0]) goto malformed;
            reply.of.result.is_ok=false; decoded=m->step_failure(w,tags,&scope,branch);
        } else goto native_error;
    }
    goto done;
native_error:
    /* A pending status or a failure from the wrong phase cannot arise on this wire. */
    if ((rc!=5 && rc!=9 && rc!=10 && rc!=11 && rc!=12) || !lb_direct_empty(w,tags,m->ntags)) goto malformed;
    err=wasmtime_error_new("Native WIT cursor operation failed"); goto done;
malformed:
    decoded=LB_MALFORMED;
done:
    if (decoded==LB_MALFORMED) { lean_bridge_native_runtime_retire(); err=wasmtime_error_new("Malformed native WIT cursor reply; runtime retired"); }
    else if (decoded==LB_OVER_BUDGET) err=wasmtime_error_new("WIT cursor result conversion limit");
    if (err && slot && !pull) (void)lb_direct_release(slot);
    if (!err) { *results=reply; reply=(lb_val){0}; } else lb_active->handled=true;
    LB_DIRECT_CLEAR(w); wasmtime_component_val_delete(&reply); lb_scope_close(&scope); return err;
}
static wasmtime_error_t *lb_direct_factory(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *type,
    lb_val *args,size_t n,lb_val *out,size_t count) { (void)type; return lb_direct_call(false,data,ctx,args,n,out,count); }
static wasmtime_error_t *lb_direct_pull(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *type,
    lb_val *args,size_t n,lb_val *out,size_t count) { (void)type; return lb_direct_call(true,data,ctx,args,n,out,count); }
/* The session drains its native slots on teardown. Wasmtime box deletion
 * releases a C allocation, which is not the canonical resource.drop. */
static wasmtime_error_t *lb_direct_link(lb_direct *s,wasmtime_context_t *ctx,wasmtime_component_linker_instance_t *host) {
    if (!s || s->ctx || !ctx || !host) return wasmtime_error_new("Expected a fresh WIT cursor store");
    s->ctx=ctx; s->pid=getpid(); s->thread=pthread_self(); wasmtime_error_t *err=NULL;
    s->previous=lb_direct_stores; lb_direct_stores=s;
    for (size_t i=0;!err && i<LB_DIRECT_KINDS;i++) {
        uint32_t tag=lean_bridge_wit_cursor_brand_v1();
        if (!tag) return wasmtime_error_new("WIT cursor type identities exhausted");
        s->tags[i]=tag; s->bindings[i]=(lb_direct_binding){s,i};
        const lb_direct_method *m=lb_direct_methods+i;
        wasmtime_component_resource_type_t *ty=wasmtime_component_resource_type_new_host(tag);
        void *cookie=(void *)(uintptr_t)tag;
        err=wasmtime_component_linker_instance_add_resource(host,m->resource,strlen(m->resource),ty,lb_direct_dtor,cookie,NULL);
        wasmtime_component_resource_type_delete(ty);
        if (!err) err=wasmtime_component_linker_instance_add_func(host,m->factory,strlen(m->factory),lb_direct_factory,cookie,NULL);
        if (!err) err=wasmtime_component_linker_instance_add_func(host,m->next,strlen(m->next),lb_direct_pull,cookie,NULL);
    }
    return err;
}
