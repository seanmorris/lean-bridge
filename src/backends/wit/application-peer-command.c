/* Offline synchronous package composition. Package directories contain trusted
 * native code; the owner and application are independent untrusted Wasm guests. */
#define _POSIX_C_SOURCE 200809L
#include "application-peer-graph.h"
#include "peer-abi.h"
#include <dlfcn.h>
#include <inttypes.h>
#include <stdio.h>

#include "application-peer-io.h"
static const lb_peer_package *load_peer(const char *dir){
    const char suffix[]="/lib/lean-bridge-wit-peer.so";size_t n=strlen(dir);if(n>SIZE_MAX-sizeof suffix)return NULL;
    char *path=malloc(n+sizeof suffix);if(!path)return NULL;
    memcpy(path,dir,n);memcpy(path+n,suffix,sizeof suffix);void *dso=dlopen(path,RTLD_NOW|RTLD_LOCAL);
    if(!dso)fprintf(stderr,"cannot load WIT package %s: %s\n",dir,dlerror());
    free(path);if(!dso)return NULL;
    /* Lean runtime workers can survive the last binding. Keep native code
     * mapped for the remaining lifetime of this one-shot process. */
    lb_peer_query get=(lb_peer_query)dlsym(dso,"lean_bridge_wit_peer_v1");const lb_peer_package *p=get?get():NULL;
    if(!p || p->version!=1 || p->size!=sizeof *p || strcmp(p->abi,LB_PEER_ABI)){fprintf(stderr,"unsupported WIT package adapter: %s\n",dir);return NULL;}
    return p;
}
int main(int argc,char **argv){
    if(argc<5 || argc>4+(int)LB_PEER_LIMIT || strcmp(argv[argc-3],"--")){
        fputs("usage: lean-bridge-wit-run PACKAGE_DIR [PACKAGE_DIR ...] -- objects.wasm application.wasm\n",stderr);return 2;
    }
    unsigned n=(unsigned)argc-4,opened=0;const lb_peer_package *pkgs[LB_PEER_LIMIT];void *states[LB_PEER_LIMIT]={0};
    for(unsigned j=0;j<n;j++){
        if(!(pkgs[j]=load_peer(argv[1+j])))return 1;
        if(strcmp(pkgs[0]->compat,pkgs[j]->compat) || strcmp(pkgs[0]->objects,pkgs[j]->objects) || strcmp(pkgs[0]->exchange,pkgs[j]->exchange)){
            fputs("incompatible WIT object contract, host domain or runtime\n",stderr);return 1;
        }
        for(unsigned k=0;k<j;k++)if(!strcmp(pkgs[j]->api,pkgs[k]->api) || !strcmp(pkgs[j]->native,pkgs[k]->native)){
            fprintf(stderr,"duplicate WIT package interface: %s\n",pkgs[j]->api);return 1;
        }
    }
    lb_pg_buf obj=read_guest(argv[argc-2]),app=read_guest(argv[argc-1]),b={0};
    if(!obj.bad && !app.bad)b=lb_pg_build(pkgs,n,(lb_peer_bytes){obj.p,obj.n},(lb_peer_bytes){app.p,app.n});
    free(obj.p);free(app.p);if(b.bad || !b.p){free(b.p);return 1;}
    lwit_store graph={0};wasm_engine_t *engine=NULL;wasmtime_component_t *component=NULL;
    wasmtime_store_t *store=NULL;wasmtime_component_linker_t *link=NULL;bool ok=false;int64_t answer=0;
    wasm_config_t *cfg=wasm_config_new();if(!cfg)goto end;
    wasmtime_config_wasm_component_model_set(cfg,true);engine=wasm_engine_new_with_config(cfg);if(!engine)goto end;
    if(!report(wasmtime_component_new(engine,b.p,b.n,&component)))goto end;
    store=wasmtime_store_new(engine,NULL,NULL);link=wasmtime_component_linker_new(engine);if(!store || !link)goto end;
    graph.ctx=wasmtime_store_context(store);
    for(unsigned j=0;j<n;j++)if(!(states[j]=pkgs[j]->create()) || !report(pkgs[j]->link(link,states[j])))goto end;
    if(!report(wasmtime_component_linker_instantiate(link,graph.ctx,component,&graph.instance)))goto end;
    while(opened<n){if(!pkgs[opened]->open(&graph,states[opened]))goto end;++opened;}
    wasmtime_component_func_t run;wasmtime_component_val_t v={0};
    if(!lwit_lookup(&graph,NULL,"run",&run) || !report(wasmtime_component_func_call(&run,graph.ctx,NULL,0,&v,1)))goto end;
    if(v.kind!=WASMTIME_COMPONENT_S64){wasmtime_component_val_delete(&v);goto end;}
    answer=v.of.s64;ok=true;
end:
    free(b.p);if(!ok)graph.failed=true;
    while(opened){--opened;if(!pkgs[opened]->close(states[opened])){ok=false;graph.failed=true;}}
    if(graph.ctx && (!report(lwit_shutdown(&graph)) || graph.failed))ok=false;
    if(link)wasmtime_component_linker_delete(link);
    if(store)wasmtime_store_delete(store);
    for(unsigned j=0;j<n;j++)if(states[j])pkgs[j]->destroy(states[j]);
    if(component)wasmtime_component_delete(component);
    if(engine)wasm_engine_delete(engine);
    if(ok)printf("%" PRId64 "\n",answer);else fputs("WIT peer application failed\n",stderr);
    return ok?0:1;
}
