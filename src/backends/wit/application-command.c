/* Synchronous application-owned object runner. No task scheduler is installed. */
#define _POSIX_C_SOURCE 200809L
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <wasmtime.h>
#include "application-command.h"

#include "application-command-inputs.h"

static bool execute(int64_t *answer){
    wasmtime_component_func_t run;wasmtime_component_val_t v={0};
    if(!lwit_lookup(&graph,NULL,"run",&run) || !report(wasmtime_component_func_call(&run,graph.ctx,NULL,0,&v,1)) ||
       v.kind!=WASMTIME_COMPONENT_S64)return false;
    *answer=v.of.s64;return true;
}
int main(int argc,char **argv){
    if(argc!=LB_INPUTS+1){
        fprintf(stderr,"usage: %s",argv[0]);for(unsigned i=0;i<LB_INPUTS;i++)fprintf(stderr," <%s.wasm>",input_roles[i]);fputc('\n',stderr);return 2;
    }
    wasm_config_t *cfg=wasm_config_new();if(!cfg)return 1;
    wasmtime_config_wasm_component_model_set(cfg,true);wasmtime_config_wasm_component_model_async_set(cfg,true);
    wasmtime_config_wasm_component_model_more_async_builtins_set(cfg,true);
    wasm_engine_t *engine=wasm_engine_new_with_config(cfg);if(!engine)return 1;
    wasmtime_component_t *component=compose(engine,argv+1);wasmtime_store_t *store=NULL;
    wasmtime_component_linker_t *link=NULL;bool success=false,opened=false;int64_t answer=0;
    if(!component)goto end;
    store=wasmtime_store_new(engine,NULL,NULL);link=wasmtime_component_linker_new(engine);if(!store || !link)goto end;
    graph.ctx=wasmtime_store_context(store);
    if(!report(lwit_operations_link(link,&ops)))goto end;
    if(!report(wasmtime_component_linker_instantiate(link,graph.ctx,component,&graph.instance)))goto end;
    opened=lwit_operations_open(&graph,&ops);if(!opened)goto end;
    success=execute(&answer);
end:
    /* Never call back into a guest after a trap. Still release native owners
       before destroying the Wasmtime context. */
    if(!success)graph.failed=true;
    if(opened && lwit_operations_close(&ops)!=LB_GRAPH_OK)success=false;
    if(!report(lwit_shutdown(&graph)) || graph.failed)success=false;
    if(link)wasmtime_component_linker_delete(link);
    if(store)wasmtime_store_delete(store);
    if(component)wasmtime_component_delete(component);
    wasm_engine_delete(engine);
    if(success)printf("%" PRId64 "\n",answer);else fputs("WIT application failed\n",stderr);
    return success?0:1;
}
