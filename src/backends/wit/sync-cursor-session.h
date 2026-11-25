/* Caller arguments are ordinary Wasmtime values. Track which outward resource
 * boxes came from this store before entering Wasmtime: passing a ResourceAny
 * to a foreign store is a C API precondition violation, not a catchable trap. */
#include <sys/syscall.h>
struct LB_SESSION {
    wasm_engine_t *engine; wasmtime_component_t *component;
    wasmtime_store_t *store; wasmtime_component_linker_t *linker; wasmtime_component_instance_t instance;
    lb_direct cursors;
    struct { wasmtime_component_resource_any_t *box; int kind; } owners[LB_DIRECT_LIMIT];
    bool ready,failed,busy;
};
static bool lb_main_thread(void) { return getpid()==(pid_t)syscall(SYS_gettid); }
static bool lb_direct_ready(LB_SESSION *s) {
    return !lb_package_failure() && lb_main_thread() && s && s->store && !s->failed && !s->busy
        && lb_direct_affine(&s->cursors,wasmtime_store_context(s->store));
}
static int lb_outward(LB_SESSION *s,const lb_val *v,int kind) {
    if (!v || v->kind!=WASMTIME_COMPONENT_RESOURCE || !v->of.resource) return -1;
    for (size_t j=0;j<LB_DIRECT_LIMIT;j++)
        if (s->owners[j].box==v->of.resource && (kind<0 || s->owners[j].kind==kind)) return (int)j;
    return -1;
}
static bool lb_direct_args(LB_SESSION *s,const char *name,const lb_val *args,size_t count,int *opened) {
    lb_scope scope={.remaining=16u*1024u*1024u}; (void)scope; *opened=-1;
    /* In validation mode lb_input does not allocate or retain output. */
    /* LB_CHECKS */
    return false;
}
wasmtime_error_t *LB_SESSION_link_cursors(wasmtime_store_t *store,wasmtime_component_linker_t *linker,LB_SESSION **out) {
    const char *f=lb_package_failure(); if (f) return wasmtime_error_new(f);
    if (!lb_main_thread() || !store || !linker || !out) return wasmtime_error_new("Expected an owner-thread cursor store and linker");
    LB_SESSION *s=calloc(1,sizeof(*s)); if (!s) return wasmtime_error_new("Cannot allocate WIT cursor session");
    s->store=store; s->linker=linker;
    wasmtime_component_linker_instance_t *root=wasmtime_component_linker_root(linker),*host=NULL;
    wasmtime_error_t *err=wasmtime_component_linker_instance_add_instance(root,LB_DIRECT_IMPORT,strlen(LB_DIRECT_IMPORT),&host);
    if (!err) err=lb_direct_link(&s->cursors,wasmtime_store_context(store),host);
    /* LB_LINK_SCALAR */
    if (host) wasmtime_component_linker_instance_delete(host);
    wasmtime_component_linker_instance_delete(root);
    if (err) { lb_direct_shutdown(&s->cursors); free(s); return err; }
    *out=s; return NULL;
}
wasmtime_error_t *LB_SESSION_instantiate(LB_SESSION *s,const wasmtime_component_t *component) {
    if (!lb_direct_ready(s) || s->ready || !component) return wasmtime_error_new("Expected a new linked WIT cursor scope");
    wasmtime_error_t *err=wasmtime_component_linker_instantiate(s->linker,s->cursors.ctx,component,&s->instance);
    s->ready=!err; s->failed=!!err; return err;
}
void LB_SESSION_close(LB_SESSION *s) {
    if (!s || !lb_main_thread() || s->busy || s->cursors.pid!=getpid()) return;
    lb_direct_shutdown(&s->cursors);
    if (s->engine) {
        wasmtime_store_delete(s->store); wasmtime_component_linker_delete(s->linker);
        wasmtime_component_delete(s->component); wasm_engine_delete(s->engine);
    }
    free(s);
}
wasmtime_error_t *LB_SESSION_open(LB_SESSION **out) {
    const char *f=lb_package_failure(); if (f) return wasmtime_error_new(f);
    if (!out || !lb_main_thread()) return wasmtime_error_new("WIT cursors require the process main thread");
    wasm_config_t *config=wasm_config_new();
    if (!config) return wasmtime_error_new("Cannot configure Wasmtime");
    wasmtime_config_wasm_component_model_set(config,true); wasm_engine_t *engine=wasm_engine_new_with_config(config);
    if (!engine) return wasmtime_error_new("Cannot open Wasmtime engine");
    wasmtime_component_t *component=NULL;
    wasmtime_error_t *err=wasmtime_component_new(engine,lb_component,sizeof(lb_component),&component);
    if (err) { wasm_engine_delete(engine); return err; }
    wasmtime_store_t *store=wasmtime_store_new(engine,NULL,NULL);
    wasmtime_component_linker_t *linker=wasmtime_component_linker_new(engine); LB_SESSION *s=NULL;
    err=LB_SESSION_link_cursors(store,linker,&s);
    if (err) {
        if (store) wasmtime_store_delete(store);
        if (linker) wasmtime_component_linker_delete(linker);
        wasmtime_component_delete(component); wasm_engine_delete(engine); return err;
    }
    s->engine=engine; s->component=component; err=LB_SESSION_instantiate(s,component);
    if (err) { LB_SESSION_close(s); return err; }
    *out=s; return NULL;
}
wasmtime_error_t *LB_SESSION_call(LB_SESSION *s,const char *name,const lb_val *args,size_t count,lb_val *out) {
    if (!lb_direct_ready(s) || !s->ready || !name || (count&&!args) || !out) return wasmtime_error_new("Invalid cursor call or store");
    lean_bridge_native_snapshot snap={0}; lean_bridge_native_snapshot_read(&snap);
    if (!snap.identity_domain_id || (snap.runtime_state!=LB_DIRECT_COLD && snap.runtime_state!=LB_DIRECT_READY))
        return wasmtime_error_new("Native Lean runtime unavailable");
    int opened=-1;
    if (!lb_direct_args(s,name,args,count,&opened)) return wasmtime_error_new("Invalid WIT arguments or foreign cursor");
    size_t free_box=0;
    if (opened>=0) {
        while (free_box<LB_DIRECT_LIMIT && s->owners[free_box].box) ++free_box;
        if (free_box==LB_DIRECT_LIMIT) return wasmtime_error_new("Too many outstanding WIT cursors");
    }
    wasmtime_context_t *ctx=s->cursors.ctx;
    wasmtime_component_export_index_t *api=wasmtime_component_instance_get_export_index(&s->instance,ctx,NULL,LB_DIRECT_EXPORT,strlen(LB_DIRECT_EXPORT));
    if (!api) return wasmtime_error_new("Missing WIT cursor API");
    wasmtime_component_export_index_t *idx=wasmtime_component_instance_get_export_index(&s->instance,ctx,api,name,strlen(name));
    wasmtime_component_export_index_delete(api);
    if (!idx) return wasmtime_error_new("Missing WIT cursor function");
    wasmtime_component_func_t fn; bool found=wasmtime_component_instance_get_func(&s->instance,ctx,idx,&fn);
    wasmtime_component_export_index_delete(idx); if (!found) return wasmtime_error_new("Not a WIT function");
    s->busy=true; lb_val result={0}; lb_call_frame frame={.context=ctx,.previous=lb_active}; lb_active=&frame;
    wasmtime_error_t *err=wasmtime_component_func_call(&fn,ctx,args,count,&result,1);
    lb_active=frame.previous; s->busy=false;
    if (!err && opened>=0) {
        lb_val *owner=&result; const lb_direct_method *m=lb_direct_methods+opened;
        if (m->open_failure) {
            if (result.kind!=WASMTIME_COMPONENT_RESULT || !result.of.result.val) goto malformed;
            owner=result.of.result.is_ok?result.of.result.val:NULL;
        }
        if (owner) {
            if (!lb_direct_type(&s->cursors,(size_t)opened,owner,true)) goto malformed;
            s->owners[free_box].box=owner->of.resource; s->owners[free_box].kind=opened;
        }
    }
    if (!err) { *out=result; return NULL; }
    goto failed;
malformed:
    err=wasmtime_error_new("Invalid WIT factory result");
failed:
    if (!frame.handled) lean_bridge_native_runtime_retire();
    s->failed=true; wasmtime_component_val_delete(&result); lb_direct_shutdown(&s->cursors); return err;
}
wasmtime_error_t *LB_SESSION_drop(LB_SESSION *s,lb_val *v) {
    if (!lb_direct_ready(s) || !s->ready) return wasmtime_error_new("Invalid WIT cursor session");
    int pos=lb_outward(s,v,-1);
    if (pos<0) return wasmtime_error_new("Foreign or already dropped WIT cursor");
    s->busy=true;
    wasmtime_error_t *err=wasmtime_component_resource_any_drop(s->cursors.ctx,v->of.resource);
    s->busy=false; s->owners[pos].box=NULL; wasmtime_component_val_delete(v); *v=(lb_val){0};
    if (err) { s->failed=true; lean_bridge_native_runtime_retire(); lb_direct_shutdown(&s->cursors); }
    return err;
}
