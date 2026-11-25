/* Publisher-built command. Application components see only each other's
 * public WIT imports. All scheduler calls occur on this Wasmtime store owner. */
#define _POSIX_C_SOURCE 200809L
#include <errno.h>
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <wasmtime.h>
#include "application-command.h"

static bool report(wasmtime_error_t *e){
    if(!e)return true;
    wasm_name_t msg;wasmtime_error_message(e,&msg);fprintf(stderr,"%.*s\n",(int)msg.size,msg.data);
    wasm_name_delete(&msg);wasmtime_error_delete(e);return false;
}
static wasmtime_component_t *compose(wasm_engine_t *engine,char **paths){
    static const uint8_t magic[]={0,97,115,109,13,0,1,0};
    FILE *files[LB_INPUTS]={0};size_t sizes[LB_INPUTS],size=0,at=0;uint8_t *bytes=NULL;
    wasmtime_component_t *component=NULL;
    for(unsigned i=0;i<=LB_INPUTS;i++)size+=fixed[i].n;
    for(unsigned i=0;i<LB_INPUTS;i++){
        FILE *f=files[i]=fopen(paths[i],"rb");long length;
        if(!f || fseek(f,0,SEEK_END) || (length=ftell(f))<8 || length>64*1024*1024 || fseek(f,0,SEEK_SET)){
            fprintf(stderr,"cannot read %s component (8 bytes to 64 MiB): %s\n",input_roles[i],paths[i]);goto done;
        }
        sizes[i]=(size_t)length;if(size>SIZE_MAX-sizes[i]-6)goto done;size+=sizes[i]+6;
    }
    bytes=malloc(size);if(!bytes){fputs("insufficient memory for component graph\n",stderr);goto done;}
    for(unsigned i=0;i<=LB_INPUTS;i++){
        memcpy(bytes+at,fixed[i].p,fixed[i].n);at+=fixed[i].n;if(i==LB_INPUTS)break;
        bytes[at++]=4;for(uint32_t n=(uint32_t)sizes[i];;n>>=7){bytes[at++]=(n&127)|(n>=128?128:0);if(n<128)break;}
        if(fread(bytes+at,1,sizes[i],files[i])!=sizes[i] || fgetc(files[i])!=EOF || ferror(files[i]) || memcmp(bytes+at,magic,8)){
            fprintf(stderr,"invalid %s component: %s\n",input_roles[i],paths[i]);goto done;
        }
        at+=sizes[i];
    }
    (void)report(wasmtime_component_new(engine,bytes,at,&component));
done:
    free(bytes);for(unsigned i=0;i<LB_INPUTS;i++)if(files[i])fclose(files[i]);return component;
}
static bool step(wasmtime_component_func_t *f){
    wasmtime_error_t *e=NULL;wasmtime_call_future_t *next=wasmtime_component_func_call_async(f,graph.ctx,NULL,0,NULL,0,&e);
    if(!next){(void)report(e);return false;}
    const struct timespec pause={0,1000000};while(!wasmtime_call_future_poll(next))nanosleep(&pause,NULL);
    wasmtime_call_future_delete(next);return report(e);
}
static bool advance(void){
    struct pollfd fds[LB_FDS];nfds_t count=0;bool ready=false;
    for(const channel *c=channels;c->r;c++){
        if(!c->pump && !report(lb_cf_reap(c->r)))return false;
        for(unsigned i=0;i<c->r->capacity;i++){
            lb_cf_row *row=&c->r->rows[i];
            if(c->pump && row->phase==LB_CF_STREAM){
                unsigned state=0;if(!report(c->pump(i+1,&state)))return false;ready|=state==2;
            }
            if(row->phase!=LB_CF_NATIVE && !(row->phase==LB_CF_STREAM && row->wait_native))continue;
            if(row->fd<0)ready=true;
            else {if(count>=LB_FDS)return false;fds[count++]=(struct pollfd){.fd=row->fd,.events=POLLIN};}
        }
    }
    if(!ready && poll(fds,count,count?100:1)<0 && errno!=EINTR){perror("poll");return false;}
    for(const channel *c=channels;c->r;c++)if(!c->pump && !report(lb_cf_advance(c->r,0)))return false;
    return true;
}
static bool execute(int64_t *answer){
    wasmtime_component_func_t launch,tick,done,take;
    if(!LB_ASYNC){
        wasmtime_component_val_t v={0};
        if(!lwit_lookup(&graph,NULL,"run",&take) || !report(wasmtime_component_func_call(&take,graph.ctx,NULL,0,&v,1)) || v.kind!=WASMTIME_COMPONENT_S64)return false;
        *answer=v.of.s64;return true;
    }
    if(!lwit_lookup(&graph,NULL,"launch",&launch) || !lwit_lookup(&graph,NULL,"tick",&tick) ||
       !lwit_lookup(&graph,NULL,"done",&done) || !lwit_lookup(&graph,NULL,"take",&take) || !step(&launch))return false;
    for(;;){
        wasmtime_component_val_t v={0};
        if(!step(&tick) || !report(wasmtime_component_func_call(&done,graph.ctx,NULL,0,&v,1)) || v.kind!=WASMTIME_COMPONENT_BOOL)return false;
        if(v.of.boolean)break;
        if(!advance())return false;
    }
    wasmtime_component_val_t v={0};
    if(!report(wasmtime_component_func_call(&take,graph.ctx,NULL,0,&v,1)) || v.kind!=WASMTIME_COMPONENT_S64)return false;
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
    for(const channel *c=channels;c->r;c++)if(!report(c->link(link)))goto end;
    if(!report(wasmtime_component_linker_instantiate(link,graph.ctx,component,&graph.instance)))goto end;
#if LB_ASYNC
    /* This executable hosts one store/graph for its entire process. */
    wasmtime_component_func_t bind_owners,close_owners;
    wasmtime_component_val_t domain={.kind=WASMTIME_COMPONENT_U32,.of.u32=1},bound={0};
    if(!lwit_lookup(&graph,NULL,"bind-owners",&bind_owners) || !lwit_lookup(&graph,NULL,"close-owners",&close_owners) ||
       !report(wasmtime_component_func_call(&bind_owners,graph.ctx,&domain,1,&bound,1)) ||
       bound.kind!=WASMTIME_COMPONENT_BOOL || !bound.of.boolean)goto end;
#endif
    opened=lwit_operations_open(&graph,&ops);if(!opened)goto end;
    for(const channel *c=channels;c->r;c++)if(!c->open())goto end;
    success=execute(&answer);
end:
    /* Never call back into a guest after a trap. Still release native owners,
       including a late worker, before destroying its Wasmtime context. */
    if(!success)graph.failed=true;
    for(const channel *c=channels;c->r;c++)if(!report(c->close())){graph.failed=true;success=false;}
    if(opened && lwit_operations_close(&ops)!=LB_GRAPH_OK)success=false;
#if LB_ASYNC
    if(success && !graph.failed && !report(wasmtime_component_func_call(&close_owners,graph.ctx,NULL,0,NULL,0)))success=false;
#endif
    if(!report(lwit_shutdown(&graph)) || graph.failed)success=false;
    if(link)wasmtime_component_linker_delete(link);
    if(store)wasmtime_store_delete(store);
    if(component)wasmtime_component_delete(component);
    wasm_engine_delete(engine);
    if(success)printf("%" PRId64 "\n",answer);else fputs("WIT application failed\n",stderr);
    return success?0:1;
}
