/* The store thread owns every Wasmtime call. The process main thread owns
 * the compiled Lean binding, synchronous frames and outstanding jobs. */
#define _POSIX_C_SOURCE 200809L
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <wasmtime.h>
#include "application-command.h"
#include "application-command-inputs.h"

enum { LB_CMD_OPEN=8192,LB_CMD_CLOSE };
typedef struct {
    lb_wit_turns turns; lb_tc_refs refs; lb_ts_bus sync; lb_tg_native tasks;
    LB_BINDING binding; bool bound,finished;
} native_owner;
typedef struct {
    char **inputs; native_owner *owner; lb_ts_linker sync; lb_tg_store tasks; int64_t answer;
} store_owner;

static bool dispatch(lb_wit_turns *t,void *data,lb_wit_message in,lb_wit_message *out){
    native_owner *n=data;
    if(in.op==LB_CMD_OPEN){
        if(n->bound || n->refs.turns)return false;
        n->refs.turns=t;n->sync.refs=&n->refs;
        return n->bound=LB_OPEN(&lb_ts_hosts,&n->sync,&n->binding)==LB_OK;
    }
    if(in.op==LB_CMD_CLOSE){
        if(!n->bound || LB_CLOSE(&n->binding)!=LB_OK)return false;
        n->bound=false;return true;
    }
    if(in.op==LB_TS_ENTER)return n->bound && lb_ts_dispatch(&n->sync,n->binding,in,out);
    if(!lb_tg_contains(in.op) || !n->refs.turns)return false;
    unsigned i=(in.op-LB_TG_BASE)/16,op=(in.op-LB_TG_BASE)%16;
    bool drain=op==(lb_tg_specs[i].kind==LB_TG_STREAM?LB_TC_DRAIN:LB_TF_DRAIN);
    return (n->bound || drain) && lb_tg_dispatch(&n->tasks,&n->refs,n->binding,in,out);
}
static void finish(void *data){
    native_owner *n=data;bool ok=lb_tg_shutdown(&n->tasks);
    if(n->bound){if(LB_CLOSE(&n->binding)!=LB_OK)ok=false;n->bound=false;}
    n->finished=ok;
}
static bool start_or_close(lb_wit_turns *t,unsigned op){
    lb_wit_event ev={0};
    return lb_wit_turn_begin(t,(lb_wit_message){.op=op},&ev) && ev.done && ev.message.op==0;
}
static bool get(wasmtime_component_instance_t *i,wasmtime_context_t *ctx,const char *name,wasmtime_component_func_t *out){
    wasmtime_component_export_index_t *ix=wasmtime_component_instance_get_export_index(i,ctx,NULL,name,strlen(name));
    if(!ix)return false;
    bool ok=wasmtime_component_instance_get_func(i,ctx,ix,out);wasmtime_component_export_index_delete(ix);return ok;
}
static bool step(wasmtime_component_func_t *fn,wasmtime_context_t *ctx){
    wasmtime_error_t *err=NULL;wasmtime_call_future_t *f=wasmtime_component_func_call_async(fn,ctx,NULL,0,NULL,0,&err);
    if(!f){(void)report(err);return false;}
    struct timespec pause={0,1000000};while(!wasmtime_call_future_poll(f))nanosleep(&pause,NULL);
    wasmtime_call_future_delete(f);return report(err);
}
static bool execute(store_owner *s,wasmtime_component_instance_t *i,wasmtime_context_t *ctx){
    wasmtime_component_func_t bind,close,launch,tick,done,take;
    wasmtime_component_val_t domain={.kind=WASMTIME_COMPONENT_U32,.of.u32=1},v={0};
    if(!get(i,ctx,"bind-owners",&bind) || !get(i,ctx,"close-owners",&close) ||
       !get(i,ctx,"launch",&launch) || !get(i,ctx,"tick",&tick) || !get(i,ctx,"done",&done) || !get(i,ctx,"take",&take) ||
       !report(wasmtime_component_func_call(&bind,ctx,&domain,1,&v,1)) || v.kind!=WASMTIME_COMPONENT_BOOL || !v.of.boolean ||
       !lb_tg_open_all(&s->tasks,i,ctx) || !start_or_close(&s->owner->turns,LB_CMD_OPEN) || !step(&launch,ctx))return false;
    for(;;){
        if(!step(&tick,ctx) || !report(wasmtime_component_func_call(&done,ctx,NULL,0,&v,1)) || v.kind!=WASMTIME_COMPONENT_BOOL)return false;
        if(v.of.boolean)break;
        unsigned changed=0;bool ready=false;
        if(!report(lb_tg_advance_all(&s->tasks,&changed)) || (!changed && !report(lb_tg_wait(&s->tasks,100,&ready))))return false;
    }
    if(!report(wasmtime_component_func_call(&take,ctx,NULL,0,&v,1)) || v.kind!=WASMTIME_COMPONENT_S64)return false;
    s->answer=v.of.s64;
    return report(lb_tg_retire_all(&s->tasks)) && start_or_close(&s->owner->turns,LB_CMD_CLOSE) &&
        report(lb_tg_drain(&s->tasks)) && report(wasmtime_component_func_call(&close,ctx,NULL,0,NULL,0));
}
static bool application(lb_wit_turns *turns,void *data){
    store_owner *s=data;
    wasm_config_t *cfg=wasm_config_new();if(!cfg)return false;
    wasmtime_config_wasm_component_model_set(cfg,true);wasmtime_config_wasm_component_model_async_set(cfg,true);
    wasmtime_config_wasm_component_model_more_async_builtins_set(cfg,true);
    wasm_engine_t *engine=wasm_engine_new_with_config(cfg);if(!engine)return false;
    wasmtime_component_t *component=compose(engine,s->inputs);
    wasmtime_store_t *store=NULL;wasmtime_component_linker_t *link=NULL;bool ok=false;
    if(!component)goto end;
    store=wasmtime_store_new(engine,NULL,NULL);link=wasmtime_component_linker_new(engine);if(!store || !link)goto end;
    wasmtime_component_linker_instance_t *root=wasmtime_component_linker_root(link);
    bool linked=report(lb_ts_link(&s->sync,&s->owner->sync,turns,root)) && report(lb_tg_link_all(&s->tasks,root,turns));
    wasmtime_component_linker_instance_delete(root);if(!linked)goto end;
    wasmtime_context_t *ctx=wasmtime_store_context(store);wasmtime_component_instance_t i;
    if(report(wasmtime_component_linker_instantiate(link,ctx,component,&i)))ok=execute(s,&i,ctx);
end:
    /* Stop the native owner before deleting the store, including when a
       guest member traps while the owner is waiting for a synchronous reply. */
    if(s->sync.ctl.bus?!lb_ts_retire(&s->sync.ctl):!lb_wit_turn_retire(turns))ok=false;
    if(link)wasmtime_component_linker_delete(link);
    if(store)wasmtime_store_delete(store);
    if(component)wasmtime_component_delete(component);
    wasm_engine_delete(engine);return ok;
}
int main(int argc,char **argv){
    if(argc!=LB_INPUTS+1){
        fprintf(stderr,"usage: %s",argv[0]);for(unsigned i=0;i<LB_INPUTS;i++)fprintf(stderr," <%s.wasm>",input_roles[i]);fputc('\n',stderr);return 2;
    }
    /* Per-channel state scales with the source inventory, not the thread stack. */
    native_owner *n=calloc(1,sizeof *n);store_owner *s=calloc(1,sizeof *s);bool ok=false;
    if(n && s){s->owner=n;s->inputs=argv+1;ok=lb_wit_turn_run(&n->turns,dispatch,finish,n,application,s) && n->finished;}
    if(ok)printf("%" PRId64 "\n",s->answer);else fputs("WIT application failed\n",stderr);
    free(s);free(n);return ok?0:1;
}
