/* One Wasmtime store and one native rendezvous owner for all installed Lean
 * worker packages. The user supplies only Wasm guests and package prefixes. */
#define _POSIX_C_SOURCE 200809L
#include <dlfcn.h>
#include <inttypes.h>
#include <time.h>
#include "application-async-graph.h"
#include "application-peer-io.h"
#include "peer-abi.h"
typedef struct {
    unsigned n;const lb_async_peer *p[LB_PEER_LIMIT];void *state[LB_PEER_LIMIT];
    char prefix[LB_PEER_LIMIT][32];lb_pg_buf graph;lb_wit_wait_set interest;bool finished;int64_t answer;
} group;
static const lb_async_peer *load_peer(const char *dir){
    const char suffix[]="/lib/lean-bridge-wit-async-peer.so";size_t n=strlen(dir);if(n>SIZE_MAX-sizeof suffix)return NULL;
    char *path=malloc(n+sizeof suffix);if(!path)return NULL;memcpy(path,dir,n);memcpy(path+n,suffix,sizeof suffix);
    /* Detached Lean tasks may still execute compiled package code until
     * process exit. Do not dlclose a successfully opened trusted package. */
    void *dso=dlopen(path,RTLD_LOCAL|RTLD_NOW);free(path);
    if(!dso){fprintf(stderr,"cannot load WIT worker package %s: %s\n",dir,dlerror());return NULL;}
    lb_async_query q=(lb_async_query)dlsym(dso,"lean_bridge_wit_async_peer_v1");const lb_async_peer *p=q?q():NULL;
    if(!p || p->version!=1 || p->size!=sizeof *p || strcmp(p->abi,LB_PEER_ABI)){
        fprintf(stderr,"unsupported WIT worker package adapter: %s\n",dir);return NULL;
    }
    return p;
}
static void finish(void *data){
    group *g=data;bool ok=true;
    for(unsigned i=g->n;i-->0;)if(!g->p[i]->finish(g->state[i]))ok=false;
    g->finished=ok;
}
static bool get(wasmtime_component_instance_t *i,wasmtime_context_t *ctx,const char *name,wasmtime_component_func_t *f){
    wasmtime_component_export_index_t *ix=wasmtime_component_instance_get_export_index(i,ctx,NULL,name,strlen(name));
    if(!ix)return false;
    bool ok=wasmtime_component_instance_get_func(i,ctx,ix,f);wasmtime_component_export_index_delete(ix);return ok;
}
static bool control(wasmtime_component_instance_t *i,wasmtime_context_t *ctx,const char *prefix,const char *name,bool bind){
    char key[64];int n=snprintf(key,sizeof key,"%s%s",prefix,name);wasmtime_component_func_t f;
    if(n<0 || (size_t)n>=sizeof key || !get(i,ctx,key,&f))return false;
    wasmtime_component_val_t domain={.kind=WASMTIME_COMPONENT_U32,.of.u32=1},v={0};
    return report(wasmtime_component_func_call(&f,ctx,bind?&domain:NULL,bind,bind?&v:NULL,bind)) &&
        (!bind || (v.kind==WASMTIME_COMPONENT_BOOL && v.of.boolean));
}
static bool owners(group *g,wasmtime_component_instance_t *i,wasmtime_context_t *ctx,const char *op,bool bind){
    if(!control(i,ctx,"objects-",op,bind))return false;
    for(unsigned j=0;j<g->n;j++)if(g->p[j]->callbacks && !control(i,ctx,g->prefix[j],op,bind))return false;
    return true;
}
static bool step(wasmtime_component_func_t *fn,wasmtime_context_t *ctx){
    wasmtime_error_t *e=NULL;wasmtime_call_future_t *f=wasmtime_component_func_call_async(fn,ctx,NULL,0,NULL,0,&e);
    if(!f){(void)report(e);return false;}
    struct timespec pause={0,1000000};while(!wasmtime_call_future_poll(f))nanosleep(&pause,NULL);
    wasmtime_call_future_delete(f);return report(e);
}
static bool execute(group *g,wasmtime_component_instance_t *i,wasmtime_context_t *ctx){
    wasmtime_component_func_t launch,tick,done,take;wasmtime_component_val_t v={0};
    if(!get(i,ctx,"launch",&launch) || !get(i,ctx,"tick",&tick) || !get(i,ctx,"done",&done) ||
       !get(i,ctx,"take",&take) || !owners(g,i,ctx,"bind",true))return false;
    for(unsigned j=0;j<g->n;j++)if(!g->p[j]->open(g->state[j],i,ctx,g->prefix[j]))return false;
    if(!step(&launch,ctx))return false;
    for(;;){
        if(!step(&tick,ctx) || !report(wasmtime_component_func_call(&done,ctx,NULL,0,&v,1)) || v.kind!=WASMTIME_COMPONENT_BOOL)return false;
        if(v.of.boolean)break;
        unsigned changed=0;for(unsigned j=0;j<g->n;j++)if(!report(g->p[j]->advance(g->state[j],&changed)))return false;
        if(!changed){
            g->interest.used=0;g->interest.immediate=false;bool ready=false;
            for(unsigned j=0;j<g->n;j++)if(!report(g->p[j]->collect(g->state[j],&g->interest)))return false;
            if(lb_wit_wait_poll(&g->interest,100,&ready)){fputs("invalid shared scheduler wait\n",stderr);return false;}
        }
    }
    if(!report(wasmtime_component_func_call(&take,ctx,NULL,0,&v,1)) || v.kind!=WASMTIME_COMPONENT_S64)return false;
    g->answer=v.of.s64;
    for(unsigned j=0;j<g->n;j++)if(!report(g->p[j]->retire(g->state[j])))return false;
    for(unsigned j=g->n;j-->0;)if(!g->p[j]->close(g->state[j]))return false;
    for(unsigned j=0;j<g->n;j++)if(!report(g->p[j]->drain(g->state[j])))return false;
    return owners(g,i,ctx,"seal",false) && owners(g,i,ctx,"close",false);
}
static bool application(lb_wit_turns *root,void *data){
    group *g=data;wasm_config_t *cfg=wasm_config_new();if(!cfg)return false;
    wasmtime_config_wasm_component_model_set(cfg,true);wasmtime_config_wasm_component_model_async_set(cfg,true);
    wasmtime_config_wasm_component_model_more_async_builtins_set(cfg,true);
    wasm_engine_t *engine=wasm_engine_new_with_config(cfg);if(!engine)return false;
    wasmtime_component_t *c=NULL;wasmtime_store_t *s=NULL;wasmtime_component_linker_t *l=NULL;bool ok=false;
    if(!report(wasmtime_component_new(engine,g->graph.p,g->graph.n,&c)))goto end;
    s=wasmtime_store_new(engine,NULL,NULL);l=wasmtime_component_linker_new(engine);if(!s || !l)goto end;
    for(unsigned j=0;j<g->n;j++){
        wasmtime_component_linker_instance_t *top=wasmtime_component_linker_root(l),*ports=NULL;
        const char *name=g->p[j]->scheduler;
        bool linked=report(wasmtime_component_linker_instance_add_instance(top,name,strlen(name),&ports)) &&
            g->p[j]->attach(g->state[j],root,ports);
        if(ports)wasmtime_component_linker_instance_delete(ports);
        wasmtime_component_linker_instance_delete(top);if(!linked)goto end;
    }
    wasmtime_component_instance_t i;wasmtime_context_t *ctx=wasmtime_store_context(s);
    if(report(wasmtime_component_linker_instantiate(l,ctx,c,&i)))ok=execute(g,&i,ctx);
end:
    if(!lb_wit_turn_retire(root))ok=false;
    for(unsigned j=0;j<g->n;j++)if(!g->p[j]->clear(g->state[j],root))ok=false;
    if(l)wasmtime_component_linker_delete(l);
    if(s)wasmtime_store_delete(s);
    if(c)wasmtime_component_delete(c);
    wasm_engine_delete(engine);return ok;
}
int main(int argc,char **argv){
    int sep=1;while(sep<argc && strcmp(argv[sep],"--"))++sep;
    if(sep<2 || sep>(int)LB_PEER_LIMIT+1 || argc-sep<3){
        fputs("usage: lean-bridge-wit-run PACKAGE_DIR ... -- objects.wasm [callbacks.wasm ...] application.wasm\n",stderr);return 2;
    }
    group g={.n=(unsigned)(sep-1)};bool ok=false;unsigned registrations=0;
    for(unsigned j=0;j<g.n;j++){
        const lb_async_peer *p=g.p[j]=load_peer(argv[j+1]);if(!p)goto end;
        if(strcmp(g.p[0]->compat,p->compat) || strcmp(g.p[0]->objects,p->objects) || strcmp(g.p[0]->exchange,p->exchange)){
            fputs("incompatible WIT object contract, host domain or runtime\n",stderr);goto end;
        }
        for(unsigned k=0;k<j;k++)if(!strcmp(g.p[k]->api,p->api) || !strcmp(g.p[k]->scheduler,p->scheduler)){
            fputs("duplicate WIT package interface\n",stderr);goto end;
        }
        if(!p->n_channels || p->n_channels>(LB_GRAPH_BYTES/sizeof(struct pollfd)-g.interest.capacity)/64)goto end;
        g.interest.capacity+=p->n_channels*64;registrations+=p->callbacks!=NULL;
        snprintf(g.prefix[j],sizeof g.prefix[j],"p%u-",j);
    }
    if((unsigned)(argc-sep)!=3+registrations){
        fputs("expected objects.wasm, one callbacks.wasm for each registering package in argument order, then application.wasm\n",stderr);return 2;
    }
    lb_pg_buf obj=read_guest(argv[sep+1]),app=read_guest(argv[argc-1]),cb[LB_PEER_LIMIT]={0};lb_peer_bytes providers[LB_PEER_LIMIT]={0};
    bool valid=!obj.bad && !app.bad;int next=sep+2;
    for(unsigned j=0;j<g.n;j++)if(g.p[j]->callbacks){
        cb[j]=read_guest(argv[next++]);providers[j]=(lb_peer_bytes){cb[j].p,cb[j].n};if(cb[j].bad)valid=false;
    }
    if(valid)g.graph=lb_ag_build(g.p,g.n,(lb_peer_bytes){obj.p,obj.n},providers,(lb_peer_bytes){app.p,app.n});
    free(obj.p);free(app.p);for(unsigned j=0;j<g.n;j++)free(cb[j].p);
    if(!valid || !g.graph.p || g.graph.bad)goto end;
    if(!(g.interest.fds=calloc(g.interest.capacity,sizeof *g.interest.fds)))goto end;
    for(unsigned j=0;j<g.n;j++)if(!(g.state[j]=g.p[j]->create()))goto end;
    lb_wit_turns root={0};ok=lb_wit_turn_run(&root,NULL,finish,&g,application,&g) && g.finished;
end:
    free(g.graph.p);free(g.interest.fds);
    for(unsigned j=0;j<g.n;j++)if(g.state[j])g.p[j]->destroy(g.state[j]);
    if(ok)printf("%" PRId64 "\n",g.answer);else fputs("WIT worker peer application failed\n",stderr);
    return ok?0:1;
}
