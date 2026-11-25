/* Private implementation for the package's generated, typed entry points.
 * Only this file handles ResourceAny. No caller-supplied resource reaches Wasmtime. */
#include <poll.h>
#include <errno.h>
#include "lean_bridge_native_runtime.h"
#if LB_CALLBACKS
typedef LBP(status) (*lb_fn_invoke)(void *,const lb_val *,bool *,lb_val *);
typedef struct { uint64_t id; size_t signature,refs; bool external,revoked; void *ctx; lb_fn_invoke invoke; void (*destroy)(void *); } lb_fn;
typedef struct lb_fn_hold { size_t site; lb_fn *fn; struct lb_fn_hold *next; } lb_fn_hold;
typedef struct lb_fn_frame { uint32_t rep; struct lb_fn_frame *outer; } lb_fn_frame;
typedef struct { size_t site,signature; const uint64_t *handle; } lb_fn_arg;
#endif
struct LBP(session) {
    lb_tasks tasks;
    wasm_engine_t *engine;
    wasmtime_component_t *component;
    wasmtime_store_t *store;
    wasmtime_component_linker_t *linker;
    wasmtime_component_instance_t instance;
    lb_val owners[LB_TASK_MAX];
    uint64_t key;
    bool failed;
#if LB_CALLBACKS
    lb_fn funcs[LB_TASK_MAX]; lb_fn_hold *holds[LB_TASK_MAX]; uint64_t fn_generation,fn_domain;
    lb_fn_frame *frame; bool close_pending,finalizing;
#endif
};
typedef LBP(session) lb_session;
#if LB_CALLBACKS
static void lb_fn_close_all(lb_session *);
static void lb_fn_detach(lb_session *,size_t);
#endif
static bool lb_main(void) { return !lb_package_failure() && getpid()==(pid_t)syscall(SYS_gettid); }
/* The process/fork guard is not a health check. Cold permits the first start;
 * a retired broker cannot admit work even on a previously untouched store. */
static bool lb_runtime_active(uint64_t *domain) {
    lean_bridge_native_snapshot snap={0}; lean_bridge_native_snapshot_read(&snap);
    if (domain) *domain=snap.identity_domain_id;
    return snap.abi_version==LEAN_BRIDGE_NATIVE_RUNTIME_ABI_VERSION && snap.identity_domain_id &&
           (snap.runtime_state==LB_RUNTIME_COLD || snap.runtime_state==LB_RUNTIME_READY);
}
static LBP(status) lb_store(lb_session *s) {
    if (!lb_main()) return LBP(UNAVAILABLE);
    if (!s || !lb_task_owner(&s->tasks,s->tasks.ctx)) return LBP(INVALID);
#if LB_CALLBACKS
    if (s->close_pending) return LBP(UNAVAILABLE);
    if (s->finalizing) return LBP(BUSY);
#endif
    return LBP(OK);
}
static LBP(status) lb_check(lb_session *s) {
    LBP(status) rc=lb_store(s);
    if (rc!=LBP(OK)) return rc;
    return !s->failed && lb_runtime_active(NULL) ? LBP(OK) : LBP(UNAVAILABLE);
}
static void lb_dispose(lb_session *s) {
#if LB_CALLBACKS
    s->close_pending=true; lb_fn_close_all(s);
#endif
    if (s->tasks.ctx) (void)lb_tasks_shutdown(&s->tasks);
    for (size_t i=0;i<LB_TASK_MAX;i++) wasmtime_component_val_delete(&s->owners[i]);
    if (s->key) lean_bridge_native_identity_release(s->key,LB_SESSION_KIND,s);
    if (s->linker) wasmtime_component_linker_delete(s->linker);
    if (s->store) wasmtime_store_delete(s->store);
    if (s->component) wasmtime_component_delete(s->component);
    if (s->engine) wasm_engine_delete(s->engine);
    free(s);
}
LBP(status) LBP(open)(lb_session **out) {
    if (!lb_main() || !lb_runtime_active(NULL)) return LBP(UNAVAILABLE);
    if (!out || *out) return LBP(INVALID);
    lb_session *s=calloc(1,sizeof *s); if (!s) return LBP(UNAVAILABLE);
    wasm_config_t *cfg=wasm_config_new(); if (!cfg) { free(s); return LBP(UNAVAILABLE); }
    wasmtime_config_wasm_component_model_set(cfg,true);
    s->engine=wasm_engine_new_with_config(cfg); if (!s->engine) { free(s); return LBP(UNAVAILABLE); }
    wasmtime_error_t *err=wasmtime_component_new(s->engine,lb_task_component,sizeof(lb_task_component),&s->component);
    if (!err) {
        s->store=wasmtime_store_new(s->engine,NULL,NULL); s->linker=wasmtime_component_linker_new(s->engine);
        if (!s->store || !s->linker) { lb_dispose(s); return LBP(UNAVAILABLE); }
        err=lb_tasks_link(&s->tasks,wasmtime_store_context(s->store),s->linker);
    }
    if (!err) err=wasmtime_component_linker_instantiate(s->linker,s->tasks.ctx,s->component,&s->instance);
    if (err) { wasmtime_error_delete(err); lb_dispose(s); return LBP(UNAVAILABLE); }
    uint64_t domain=0;
    if (!lb_runtime_active(&domain) || !s->instance.store_id) { lb_dispose(s); return LBP(UNAVAILABLE); }
#if LB_CALLBACKS
    s->fn_domain=domain;
#endif
    *out=s; return LBP(OK);
}
LBP(status) LBP(close)(lb_session **owner) {
    if (!lb_main()) return LBP(UNAVAILABLE);
    if (!owner) return LBP(INVALID);
    if (*owner) {
        lb_session *s=*owner;
#if LB_CALLBACKS
        if (s->finalizing) return LBP(BUSY);
        if (s->frame) { s->close_pending=true; *owner=NULL; return LBP(OK); }
#endif
        *owner=NULL; lb_dispose(s);
    }
    return LBP(OK);
}
static LBP(status) lb_fault(lb_session *s,bool poison) {
    s->failed=true; if (poison) lean_bridge_native_runtime_retire();
    return poison ? LBP(TRAPPED) : LBP(UNAVAILABLE);
}
static LBP(status) lb_invoke(lb_session *s,const char *name,const lb_val *args,size_t n,lb_val *out) {
    wasmtime_context_t *ctx=s->tasks.ctx; wasmtime_component_func_t f;
    wasmtime_component_export_index_t *api=wasmtime_component_instance_get_export_index(&s->instance,ctx,NULL,LB_TASK_API,strlen(LB_TASK_API));
    if (!api) return lb_fault(s,true);
    wasmtime_component_export_index_t *idx=wasmtime_component_instance_get_export_index(&s->instance,ctx,api,name,strlen(name));
    wasmtime_component_export_index_delete(api); if (!idx) return lb_fault(s,true);
    bool found=wasmtime_component_instance_get_func(&s->instance,ctx,idx,&f); wasmtime_component_export_index_delete(idx);
    if (!found) return lb_fault(s,true);
    s->tasks.import_failed=false;
    wasmtime_error_t *err=wasmtime_component_func_call(&f,ctx,args,n,out,1); /* includes canonical post-return */
    if (err) { wasmtime_error_delete(err); return lb_fault(s,!s->tasks.import_failed); }
    return LBP(OK);
}
static LBP(status) lb_start(lb_session *s,size_t i,const lb_val *args,uint64_t *out,lb_val *failure) {
    LBP(status) rc=lb_check(s); if (rc!=LBP(OK)) return rc;
    if (!out || out[0] || out[1]) return LBP(INVALID);
    if (LB_TASK_MAX-s->tasks.live <= (LB_HEAPS!=0) || UINT32_MAX-s->tasks.last_rep <= (LB_HEAPS!=0)) return LBP(LIMIT);
    const lb_task_method *m=&lb_methods[i]; lb_scope sc={.remaining=16u*1024u*1024u};
    for (size_t n=0;n<m->argc;n++) {
#if LB_HEAPS
        if (m->args[n]>=LB_HEAP_BASE) {
            if (args[n].kind!=WASMTIME_COMPONENT_RESOURCE || !args[n].of.resource) return LBP(INVALID);
            continue;
        }
#endif
        if (!lb_input(m->args[n],&args[n],&sc,NULL)) return LBP(INVALID);
    }
    lb_val v={0}; rc=lb_invoke(s,m->names[0],args,m->argc,&v);
    if (rc!=LBP(OK)) return rc;
    if (m->start_failure) {
        if (!failure || v.kind!=WASMTIME_COMPONENT_RESULT || !v.of.result.val) {
            wasmtime_component_val_delete(&v); return lb_fault(s,true);
        }
        bool ok=v.of.result.is_ok;
        lb_val branch=*v.of.result.val; *v.of.result.val=(lb_val){0};
        wasmtime_component_val_delete(&v);
        if (!ok) { *failure=branch; return LBP(START_ERROR); }
        v=branch;
    }
    lb_task_slot *t=lb_task_find(&s->tasks,i,s->tasks.last_rep);
    if (!t || v.kind!=WASMTIME_COMPONENT_RESOURCE || !wasmtime_component_resource_any_owned(v.of.resource)) {
        wasmtime_component_val_delete(&v); return lb_fault(s,true);
    }
    s->owners[t-s->tasks.slots]=v;
    /* The first successful start initializes Lean. The process broker now gives
       this store a generation-safe identity shared across independent host DSOs. */
    if (!s->key) s->key=lean_bridge_native_identity_acquire(LB_SESSION_KIND,s);
    if (!s->key) return lb_fault(s,false);
    out[0]=s->key; out[1]=t->rep; return LBP(OK);
}
static LBP(status) lb_owned(lb_session *s,size_t i,const uint64_t *h,lb_val **v,bool release) {
    LBP(status) rc=release?lb_store(s):lb_check(s); if (rc!=LBP(OK)) return rc;
    if (s->failed) return LBP(UNAVAILABLE); /* A trapped store needs full teardown. */
    if (!h || !s->key || h[0]!=s->key || h[1]>UINT32_MAX) return LBP(STALE);
    lb_task_slot *t=lb_task_find(&s->tasks,i,(uint32_t)h[1]); if (!t) return LBP(STALE);
    *v=&s->owners[t-s->tasks.slots]; return LBP(OK);
}
static LBP(status) lb_handle(lb_session *s,size_t i,const uint64_t *h,lb_val **v) {
    return lb_owned(s,i,h,v,false);
}
static LBP(status) lb_cancel(lb_session *s,size_t i,const uint64_t *h,bool *accepted) {
    if (!accepted) return LBP(INVALID);
    lb_val *owner=NULL,result={0}; LBP(status) rc=lb_handle(s,i,h,&owner);
    if (rc!=LBP(OK)) return rc;
    rc=lb_invoke(s,lb_methods[i].names[2],owner,1,&result); if (rc!=LBP(OK)) return rc;
    bool valid=result.kind==WASMTIME_COMPONENT_BOOL;
    if (valid) *accepted=result.of.boolean;
#if LB_CALLBACKS
    if (valid && *accepted) lb_fn_detach(s,(size_t)(owner-s->owners));
#endif
    wasmtime_component_val_delete(&result); return valid ? LBP(OK) : lb_fault(s,true);
}
static inline LBP(status) lb_request_cursor(lb_session *s,size_t i,const uint64_t *h) {
    lb_val *owner=NULL,result={0}; LBP(status) rc=lb_handle(s,i,h,&owner);
    if (rc!=LBP(OK)) return rc;
    rc=lb_invoke(s,lb_methods[i].names[3],owner,1,&result); if (rc!=LBP(OK)) return rc;
    if (result.kind==WASMTIME_COMPONENT_VARIANT && !result.of.variant.val) {
        wasm_name_t *label=&result.of.variant.discriminant;
        if (lb_name(label,"accepted")) rc=LBP(OK);
        else if (lb_name(label,"busy")) rc=LBP(BUSY);
        else if (lb_name(label,"closed")) rc=LBP(FINISHED);
        else rc=lb_fault(s,true);
    } else rc=lb_fault(s,true);
    wasmtime_component_val_delete(&result); return rc;
}
static LBP(status) lb_drop_owner(lb_session *s,size_t i,uint64_t *h) {
    lb_val *owner=NULL; LBP(status) rc=lb_owned(s,i,h,&owner,true); if (rc!=LBP(OK)) return rc;
    wasmtime_error_t *err=wasmtime_component_resource_any_drop(s->tasks.ctx,owner->of.resource);
    if (err) { wasmtime_error_delete(err); return lb_fault(s,true); }
#if LB_CALLBACKS
    lb_fn_detach(s,(size_t)(owner-s->owners));
#endif
    wasmtime_component_val_delete(owner); *owner=(lb_val){0}; h[0]=h[1]=0; return LBP(OK);
}
/* LB_CALLER_DISPATCH */
static LBP(status) lb_observe(lb_session *s,size_t i,const uint64_t *h,bool wait,LBP(state) *state,int *fd,lb_val *payload) {
    if (!state || !fd) return LBP(INVALID);
    lb_val *owner=NULL; LBP(status) rc=lb_handle(s,i,h,&owner); if (rc!=LBP(OK)) return rc;
#if LB_CALLBACKS
    /* Waiting on the very callback being executed cannot make progress. */
    for (lb_fn_frame *f=s->frame;f;f=f->outer) if (f->rep==h[1]) return LBP(BUSY);
#endif
    for (;;) {
        lb_val result={0}; rc=lb_invoke(s,lb_methods[i].names[1],owner,1,&result);
        if (rc!=LBP(OK)) return rc;
        LBP(state) next; int gate=-1;
        if (result.kind!=WASMTIME_COMPONENT_VARIANT) goto malformed;
        wasm_name_t *label=&result.of.variant.discriminant;
#if LB_CALLBACKS
        size_t cb=0;
        while (cb<LB_CALLBACKS && (lb_cb_methods[cb].owner!=i || !lb_name(label,lb_cb_methods[cb].state))) ++cb;
        if (cb<LB_CALLBACKS) {
            rc=lb_fn_dispatch(s,owner,(uint32_t)h[1],cb,result.of.variant.val);
            wasmtime_component_val_delete(&result);
            if (rc!=LBP(OK)) return rc;
            /* The user may have dropped or cancelled this task during dispatch. */
            rc=lb_handle(s,i,h,&owner); if (rc!=LBP(OK)) return rc;
            if (!wait) {
                rc=lb_fn_yield(s,i,owner,&gate); if (rc!=LBP(OK)) return rc;
                if (gate>=0) { *state=LBP(PENDING); *fd=gate; return LBP(OK); }
            }
            continue;
        }
#endif
        bool cursor=lb_methods[i].request!=NULL;
        if (!cursor && lb_name(label,"ready")) { next=LBP(READY); }
        else if (cursor && lb_name(label,"idle")) { next=LBP(IDLE); }
        else if (cursor && lb_name(label,"end")) { next=LBP(END); }
        else if (cursor && lb_name(label,"item")) { next=LBP(ITEM); }
        else if (lb_methods[i].terminal && lb_name(label,lb_methods[i].terminal_case)) {
#if LB_STEP_IO
            next=lb_name(label,"io-failed") ? LBP(STEP_IO_FAILED) : LBP(FAILED);
#else
            next=LBP(FAILED);
#endif
        }
#if LB_CALLBACKS
        else if (lb_cb_ports[i].factory && lb_name(label,"factory-failed")) { next=LBP(FACTORY_FAILED); }
        else if (lb_cb_ports[i].factory_host && lb_name(label,"factory-callback-failed")) { next=LBP(FACTORY_CALLBACK_FAILED); }
        else if (lb_cb_ports[i].worker_host && lb_name(label,"worker-callback-failed")) { next=LBP(WORKER_CALLBACK_FAILED); }
#endif
        else if (lb_name(label,"pending")) { next=LBP(PENDING); gate=s->tasks.pending_fd; if (gate<0) goto malformed; }
        else if (lb_name(label,"cancelled")) { next=LBP(CANCELLED); }
        else if (lb_name(label,"closed")) { next=LBP(CLOSED); }
        else goto malformed;
        bool has_value=next==LBP(READY) || next==LBP(ITEM) || next==LBP(FAILED);
#if LB_STEP_IO
        has_value=has_value || next==LBP(STEP_IO_FAILED);
#endif
#if LB_CALLBACKS
        has_value=has_value || next==LBP(FACTORY_FAILED) || next==LBP(FACTORY_CALLBACK_FAILED) || next==LBP(WORKER_CALLBACK_FAILED);
        if (next!=LBP(PENDING) && lb_cb_ports[i].fd) lb_fn_detach(s,(size_t)(owner-s->owners));
#endif
        if (has_value!=(result.of.variant.val!=NULL)) goto malformed;
        if (has_value) { *payload=*result.of.variant.val; *result.of.variant.val=(lb_val){0}; }
        wasmtime_component_val_delete(&result);
        if (wait && next==LBP(PENDING)) {
            struct pollfd p={gate,POLLIN,0}; int n;
            do { n=poll(&p,1,-1); } while (n<0 && errno==EINTR);
            if (n!=1 || !(p.revents&POLLIN)) return lb_fault(s,false);
            if (!lb_runtime_active(NULL)) return LBP(UNAVAILABLE);
            continue;
        }
        *fd=gate; *state=next; return LBP(OK);
malformed:
        wasmtime_component_val_delete(&result); return lb_fault(s,true);
    }
}
