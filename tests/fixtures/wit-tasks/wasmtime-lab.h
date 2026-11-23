/* Exercise the actual binary's *exports*, rather than calling the native wire. */
#include "task-host.h"
#include "lean_bridge_native_runtime.h"
#include <assert.h>
#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <stdio.h>

typedef struct {
    wasmtime_store_t *store;
    wasmtime_component_linker_t *linker;
    wasmtime_component_instance_t instance;
    lb_tasks tasks;
} lab;
static inline void ok(wasmtime_error_t *e) {
    if (e) { wasm_name_t text; wasmtime_error_message(e,&text);
        fprintf(stderr,"Wasmtime: %.*s\n",(int)text.size,text.data);
        wasm_name_delete(&text); wasmtime_error_delete(e); abort(); }
}
static inline void open_lab(lab *s,wasm_engine_t *engine,wasmtime_component_t *component) {
    s->store=wasmtime_store_new(engine,NULL,NULL);
    s->linker=wasmtime_component_linker_new(engine);
    ok(lb_tasks_link(&s->tasks,wasmtime_store_context(s->store),s->linker));
    ok(wasmtime_component_linker_instantiate(s->linker,s->tasks.ctx,component,&s->instance));
}
static inline void close_lab(lab *s) {
    assert(lb_tasks_shutdown(&s->tasks)); assert(!s->tasks.live);
    wasmtime_component_linker_delete(s->linker); wasmtime_store_delete(s->store);
}
static inline wasmtime_error_t *calln(lab *s,const char *name,lb_val *arg,size_t n,lb_val *out) {
    wasmtime_context_t *ctx=s->tasks.ctx;
    wasmtime_component_export_index_t *api=wasmtime_component_instance_get_export_index(&s->instance,ctx,NULL,LB_TASK_API,strlen(LB_TASK_API)); assert(api);
    wasmtime_component_export_index_t *idx=wasmtime_component_instance_get_export_index(&s->instance,ctx,api,name,strlen(name));
    wasmtime_component_export_index_delete(api); assert(idx);
    wasmtime_component_func_t f; assert(wasmtime_component_instance_get_func(&s->instance,ctx,idx,&f));
    wasmtime_component_export_index_delete(idx);
    return wasmtime_component_func_call(&f,ctx,arg,n,out,1);
}
static inline wasmtime_error_t *call(lab *s,const char *name,lb_val *arg,lb_val *out) { return calln(s,name,arg,arg?1:0,out); }
static inline lb_val invoke(lab *s,const char *name,lb_val *arg) { lb_val out={0}; ok(call(s,name,arg,&out)); return out; }
