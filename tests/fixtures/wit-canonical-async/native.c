/* The provider side uses the installed Pulse C package. Neither the Wasm
 * component nor this executable contains or recompiles the Lean program. */
#define _POSIX_C_SOURCE 200809L
#include <assert.h>
#include <errno.h>
#include <poll.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <lbc_pulse.h>
#include <wasmtime.h>
#include <wasmtime/component.h>

#define P(x) lbc_pulse_##x
typedef struct { P(late_handle) task; int fd; unsigned began,delivered; } state;
static void ok(wasmtime_error_t *error) {
    if (!error) return;
    wasm_name_t msg; wasmtime_error_message(error,&msg);
    fprintf(stderr,"%.*s\n",(int)msg.size,msg.data);
    wasm_name_delete(&msg); wasmtime_error_delete(error); exit(1);
}
static wasmtime_error_t *begin(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *type,
        wasmtime_component_val_t *args,size_t n,wasmtime_component_val_t *results,size_t m) {
    (void)ctx; (void)type; (void)results; state *s=data; uint8_t unit=0;
    assert(n==1 && args[0].kind==WASMTIME_COMPONENT_S64 && !m && !s->task.id);
    assert(P(reset_call)(&unit,NULL)==P(OK));
    assert(P(late_start)(false,args[0].of.s64,&s->task)==P(OK));
    assert(P(late_poll)(s->task,&s->fd)==P(PENDING) && s->fd>=0);
    s->began++; return NULL;
}
static wasmtime_error_t *resume(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *type,
        wasmtime_component_val_t *args,size_t n,wasmtime_component_val_t *results,size_t m) {
    (void)ctx; (void)type; (void)args; state *s=data; uint8_t unit=0;
    assert(!n && m==1 && s->task.id && s->began==s->delivered+1);
    assert(P(release_call)(&unit,NULL)==P(OK));
    struct pollfd event={s->fd,POLLIN,0}; int ready;
    do { ready=poll(&event,1,5000); } while (ready<0 && errno==EINTR);
    assert(ready==1 && (event.revents&POLLIN));
    int64_t actual=0; assert(P(late_take)(&s->task,&actual)==P(OK));
    int64_t duplicate=0; assert(P(late_take)(&s->task,&duplicate)==P(CLOSED));
    results[0].kind=WASMTIME_COMPONENT_S64; results[0].of.s64=actual;
    s->delivered++; return NULL;
}
int main(int argc,char **argv) {
    assert(argc==2); alarm(20); FILE *f=fopen(argv[1],"rb"); assert(f);
    assert(!fseek(f,0,SEEK_END)); long len=ftell(f); assert(len>0 && len<1048576); rewind(f);
    uint8_t *bytes=malloc((size_t)len); assert(bytes && fread(bytes,1,(size_t)len,f)==(size_t)len); fclose(f);
    wasm_config_t *cfg=wasm_config_new(); assert(cfg);
    wasmtime_config_wasm_component_model_set(cfg,true);
    wasmtime_config_wasm_component_model_async_set(cfg,true);
    wasmtime_config_wasm_component_model_more_async_builtins_set(cfg,true);
    wasm_engine_t *engine=wasm_engine_new_with_config(cfg); assert(engine);
    wasmtime_component_t *component=NULL; ok(wasmtime_component_new(engine,bytes,(size_t)len,&component)); free(bytes);
    wasmtime_store_t *store=wasmtime_store_new(engine,NULL,NULL); assert(store);
    wasmtime_context_t *ctx=wasmtime_store_context(store);
    wasmtime_component_linker_t *link=wasmtime_component_linker_new(engine);
    wasmtime_component_linker_instance_t *root=wasmtime_component_linker_root(link);
    state s={0};
    ok(wasmtime_component_linker_instance_add_func(root,"begin",5,begin,&s,NULL));
    ok(wasmtime_component_linker_instance_add_func(root,"resume",6,resume,&s,NULL));
    wasmtime_component_linker_instance_delete(root);
    wasmtime_component_instance_t inst; ok(wasmtime_component_linker_instantiate(link,ctx,component,&inst));
    wasmtime_component_export_index_t *idx=wasmtime_component_instance_get_export_index(&inst,ctx,NULL,"run",3); assert(idx);
    wasmtime_component_func_t fn; assert(wasmtime_component_instance_get_func(&inst,ctx,idx,&fn));
    wasmtime_component_export_index_delete(idx);
    const int64_t inputs[]={INT64_MIN,0,INT64_MAX};
    for (size_t i=0;i<3;++i) {
        wasmtime_component_val_t arg={.kind=WASMTIME_COMPONENT_S64,.of.s64=inputs[i]},out={0};
        ok(wasmtime_component_func_call(&fn,ctx,&arg,1,&out,1));
        assert(out.kind==WASMTIME_COMPONENT_S64 && out.of.s64==inputs[i]);
    }
    assert(s.began==3 && s.delivered==3 && !s.task.id);
    wasmtime_component_linker_delete(link); wasmtime_store_delete(store);
    wasmtime_component_delete(component); wasm_engine_delete(engine);
    puts("three parked Lean tasks crossed canonical future<s64>; exact signed results, owners consumed");
    return 0;
}
