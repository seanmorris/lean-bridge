/* The native worker never enters the Wasm store. One store-owner turn per
 * method services at most one request per live future before yielding. */
#define _GNU_SOURCE
#include <inttypes.h>
#include <errno.h>
#include <poll.h>
#include <stdio.h>
#include <time.h>
#include "task-host.h"
#include "callback-package.h"
#include "application-command-inputs.h"

static bool port(wasmtime_component_instance_t *inst,wasmtime_context_t *ctx,
    const char *name,wasmtime_component_func_t *f){
    wasmtime_component_export_index_t *idx=wasmtime_component_instance_get_export_index(inst,ctx,NULL,name,strlen(name));
    if(!idx)return false;
    bool ok=wasmtime_component_instance_get_func(inst,ctx,idx,f);
    wasmtime_component_export_index_delete(idx);return ok;
}
static bool tick(wasmtime_component_func_t *f,wasmtime_context_t *ctx){
    wasmtime_error_t *err=NULL;
    wasmtime_call_future_t *next=wasmtime_component_func_call_async(f,ctx,NULL,0,NULL,0,&err);
    if(!next)return false;
    const struct timespec pause={0,1000000};
    while(!wasmtime_call_future_poll(next))nanosleep(&pause,NULL);
    wasmtime_call_future_delete(next);return report(err);
}
int main(int argc,char **argv){
    if(argc!=3){fputs("usage: package-run CALLBACK-PROVIDER.wasm APPLICATION.wasm\n",stderr);return 2;}
    wasm_config_t *cfg=wasm_config_new();if(!cfg)return 1;
    wasmtime_config_wasm_component_model_set(cfg,true);
    wasmtime_config_wasm_component_model_async_set(cfg,true);
    wasmtime_config_wasm_component_model_more_async_builtins_set(cfg,true);
    wasm_engine_t *engine=wasm_engine_new_with_config(cfg);if(!engine)return 1;
    wasmtime_component_t *component=compose(engine,argv+1);
    wasmtime_store_t *store=wasmtime_store_new(engine,NULL,NULL);
    wasmtime_component_linker_t *link=wasmtime_component_linker_new(engine);
    lb_tasks tasks={0};int status=1;int64_t answer=0;bool linked=false;
    if(!component || !store || !link)goto done;
    wasmtime_context_t *ctx=wasmtime_store_context(store);wasmtime_component_instance_t inst;
    if(!report(lb_tasks_link(&tasks,ctx,link)))goto done;
    linked=true;
    if(!report(wasmtime_component_linker_instantiate(link,ctx,component,&inst)))goto done;
    wasmtime_component_func_t launch,advance,finished,take,turn[LB_METHODS],close[LB_METHODS];
    if(!port(&inst,ctx,"launch",&launch) || !port(&inst,ctx,"tick",&advance) ||
       !port(&inst,ctx,"done",&finished) || !port(&inst,ctx,"take",&take))goto done;
    for(unsigned i=0;i<LB_METHODS;i++){
        char a[40],b[40];snprintf(a,sizeof a,"turn-m%u",i);snprintf(b,sizeof b,"shutdown-m%u",i);
        if(!port(&inst,ctx,a,turn+i) || !port(&inst,ctx,b,close+i))goto done;
    }
    if(!tick(&launch,ctx))goto done;
    for(;;){
        wasmtime_component_val_t v={0};
        if(!tick(&advance,ctx) || !report(wasmtime_component_func_call(&finished,ctx,NULL,0,&v,1)) ||
           v.kind!=WASMTIME_COMPONENT_BOOL)goto done;
        if(v.of.boolean)break;
        bool immediate=false;
        for(unsigned i=0;i<LB_METHODS;i++){
            if(!report(wasmtime_component_func_call(turn+i,ctx,NULL,0,&v,1)) ||
               v.kind!=WASMTIME_COMPONENT_U32 || v.of.u32>3)goto done;
            immediate|=v.of.u32>=2;
        }
        struct pollfd fds[LB_TASK_MAX];nfds_t n=0;
        for(size_t i=0;i<LB_TASK_MAX;i++)if(tasks.slots[i].rep && tasks.slots[i].waiting)
            fds[n++]=(struct pollfd){.fd=tasks.slots[i].gate[0],.events=POLLIN};
        if(!immediate && poll(fds,n,n?100:1)<0 && errno!=EINTR)goto done;
    }
    wasmtime_component_val_t out={0};
    if(!report(wasmtime_component_func_call(&take,ctx,NULL,0,&out,1)) || out.kind!=WASMTIME_COMPONENT_S64)goto done;
    answer=out.of.s64;
    for(unsigned i=0;i<LB_METHODS;i++)
        if(!report(wasmtime_component_func_call(close+i,ctx,NULL,0,NULL,0)))goto done;
    if(tasks.live){fputs("callback scheduler left a native owner alive\n",stderr);goto done;}
    status=0;
done:
    if(linked && !lb_tasks_shutdown(&tasks))status=1;
    if(link)wasmtime_component_linker_delete(link);
    if(store)wasmtime_store_delete(store);
    if(component)wasmtime_component_delete(component);
    wasm_engine_delete(engine);
    if(!status)printf("%" PRId64 "\n",answer);
    return status;
}
