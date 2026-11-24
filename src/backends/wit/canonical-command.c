/* Compiled once by the publisher. The only consumer input is a Wasm component.
 * This runner owns its process, Wasmtime store and all native Lean task handles. */
#define _POSIX_C_SOURCE 200809L
#include <errno.h>
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <wasmtime.h>
#include "canonical-future-reactor.h"
#include "package.h"

static lb_cf_reactor drivers[LB_METHODS];
static lb_cf_row rows[LB_METHODS][LB_SLOTS];
static struct pollfd local_fds[LB_METHODS][LB_SLOTS], fds[LB_METHODS*LB_SLOTS];
static bool accepting;
static void fail(const char *msg) { fprintf(stderr,"%s\n",msg); exit(1); }
static void check(wasmtime_error_t *err) {
    if (!err) return;
    wasm_name_t msg; wasmtime_error_message(err,&msg);
    fprintf(stderr,"%.*s\n",(int)msg.size,msg.data); wasm_name_delete(&msg); wasmtime_error_delete(err); exit(1);
}
static inline wasmtime_component_val_t *lb_child(wasmtime_component_val_t *parent,bool ok) {
    wasmtime_component_val_t empty={0}; wasmtime_component_val_t *child=wasmtime_component_val_new(&empty);
    if (!child) fail("insufficient memory for result");
    parent->kind=WASMTIME_COMPONENT_RESULT; parent->of.result.is_ok=ok; parent->of.result.val=child;
    return child;
}
static inline wasmtime_error_t *lb_peek(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *type,
    wasmtime_component_val_t *args,size_t argc,wasmtime_component_val_t *out,size_t retc) {
    (void)type; lb_cf_reactor *r=data;
    if (ctx!=r->ctx || !r->staged || argc!=1 || retc!=1 || args[0].kind!=WASMTIME_COMPONENT_U32 || args[0].of.u32!=r->staged_key)
        return wasmtime_error_new("canonical writer has no matching delivery");
    *out=*r->staged; *r->staged=(wasmtime_component_val_t){0}; r->staged=NULL; return NULL;
}
#include "canonical-hooks.h"

static void shutdown_owners(void) {
    accepting=false;
    for (size_t i=0;i<LB_METHODS;++i) lb_cf_shutdown(&drivers[i]);
}
static wasmtime_component_func_t port(wasmtime_component_instance_t *inst,wasmtime_context_t *ctx,const char *name) {
    wasmtime_component_export_index_t *idx=wasmtime_component_instance_get_export_index(inst,ctx,NULL,name,strlen(name));
    wasmtime_component_func_t f;
    if (!idx || !wasmtime_component_instance_get_func(inst,ctx,idx,&f)) fail("missing packaged scheduler port");
    wasmtime_component_export_index_delete(idx); return f;
}
static void step(wasmtime_component_func_t *f,wasmtime_context_t *ctx) {
    wasmtime_error_t *err=NULL;
    wasmtime_call_future_t *next=wasmtime_component_func_call_async(f,ctx,NULL,0,NULL,0,&err);
    if (!next) fail("failed to enter guest");
    const struct timespec pause={0,1000000};
    while (!wasmtime_call_future_poll(next)) nanosleep(&pause,NULL);
    wasmtime_call_future_delete(next); check(err);
}
/* Splice a full component into one Component Model section, never into code or
 * text. Wasmtime checks the resulting import/export types before instantiation. */
static wasmtime_component_t *compose(wasm_engine_t *engine,const char *path) {
    FILE *file=fopen(path,"rb"); if (!file || fseek(file,0,SEEK_END)) fail("could not open guest component");
    long size=ftell(file); if (size<8 || size>64*1024*1024) fail("guest component size out of bounds"); rewind(file);
    uint8_t *buf=malloc(sizeof(template_head)+6+(size_t)size+sizeof(template_tail));
    if (!buf) fail("insufficient memory for guest component");
    memcpy(buf,template_head,sizeof(template_head)); size_t pos=sizeof(template_head); buf[pos++]=4;
    for (uint32_t v=(uint32_t)size;;v>>=7) { buf[pos++]=(uint8_t)((v&127)|(v>=128?128:0)); if (v<128) break; }
    if (fread(buf+pos,1,(size_t)size,file)!=(size_t)size || fgetc(file)!=EOF || ferror(file)) fail("guest component changed while loading");
    fclose(file);
    const uint8_t component_header[]={0,97,115,109,13,0,1,0};
    if (memcmp(buf+pos,component_header,sizeof(component_header))) fail("expected a Component Model binary");
    pos+=(size_t)size;memcpy(buf+pos,template_tail,sizeof(template_tail));pos+=sizeof(template_tail);
    wasmtime_component_t *component=NULL; wasmtime_error_t *err=wasmtime_component_new(engine,buf,pos,&component);
    free(buf);check(err);return component;
}
/* Readiness can arise in the guest while Lean is still parked. Probe each
 * stream once per guest turn, before waiting on unrelated native fds. */
static unsigned pump_stream(lb_cf_reactor *r,unsigned key) {
    wasmtime_component_val_t arg={.kind=WASMTIME_COMPONENT_U32,.of.u32=key},out={0};
    wasmtime_error_t *err=wasmtime_component_func_call(&r->pump,r->ctx,&arg,1,&out,1);
    bool missed=r->staged!=NULL;
    if (missed) {wasmtime_component_val_delete(&r->stream_value);r->staged=NULL;}
    r->staged_key=0;check(err);
    if (missed || out.kind!=WASMTIME_COMPONENT_U32 || out.of.u32>2) fail("invalid cursor pump");
    r->rows[key-1].wait_native=out.of.u32==1;
    return out.of.u32;
}
int main(int argc,char **argv) {
    if (argc!=2) fail("usage: package-run <application.wasm>");
    wasm_config_t *cfg=wasm_config_new();if(!cfg) fail("could not allocate Wasmtime config");
    wasmtime_config_wasm_component_model_set(cfg,true);
    wasmtime_config_wasm_component_model_async_set(cfg,true);
    wasmtime_config_wasm_component_model_more_async_builtins_set(cfg,true);
    wasm_engine_t *engine=wasm_engine_new_with_config(cfg);if (!engine) fail("could not create Wasmtime engine");
    wasmtime_component_t *component=compose(engine,argv[1]);
    wasmtime_store_t *store=wasmtime_store_new(engine,NULL,NULL);if (!store) fail("could not create store");
    wasmtime_context_t *ctx=wasmtime_store_context(store);
    wasmtime_component_linker_t *link=wasmtime_component_linker_new(engine);
    wasmtime_component_linker_instance_t *root=wasmtime_component_linker_root(link);
    link_hooks(root); wasmtime_component_linker_instance_delete(root);
    wasmtime_component_instance_t inst;check(wasmtime_component_linker_instantiate(link,ctx,component,&inst));
    for (unsigned i=0;i<LB_METHODS;++i) {
        char d[48],r[48];snprintf(d,sizeof(d),"deliver-%s",methods[i]);snprintf(r,sizeof(r),"reap-%s",methods[i]);
        drivers[i]=(lb_cf_reactor){.rows=rows[i],.fds=local_fds[i],.capacity=LB_SLOTS,.ctx=ctx,
            .pull_payload=pull_methods[i]};
        if (stream_methods[i]) {snprintf(d,sizeof(d),"pump-%s",methods[i]); drivers[i].pump=port(&inst,ctx,d);}
        else {drivers[i].deliver=port(&inst,ctx,d);drivers[i].reap=port(&inst,ctx,r);}
    }
    if (atexit(shutdown_owners)) fail("could not install owner cleanup");
    wasmtime_component_func_t launch=port(&inst,ctx,"launch"),tick=port(&inst,ctx,"tick"),done=port(&inst,ctx,"done"),take=port(&inst,ctx,"take");
    accepting=true;step(&launch,ctx);
    while (true) {
        step(&tick,ctx);wasmtime_component_val_t result={0};check(wasmtime_component_func_call(&done,ctx,NULL,0,&result,1));
        if (result.kind!=WASMTIME_COMPONENT_BOOL) fail("invalid application status");
        if (result.of.boolean) break;
        unsigned count=0;bool immediate=false;
        for (unsigned i=0;i<LB_METHODS;++i) {
            /* A guest may have dropped a reader while its Lean worker is
               still parked. Do not wait on that worker's fd to notice. */
            if (!stream_methods[i]) { check(lb_cf_reap(&drivers[i])); continue; }
            for (unsigned j=0;j<LB_SLOTS;++j) if (rows[i][j].phase==LB_CF_STREAM)
                immediate |= pump_stream(&drivers[i],j+1)==2;
        }
        for (unsigned i=0;i<LB_METHODS;++i) for (unsigned j=0;j<LB_SLOTS;++j) if (rows[i][j].phase==LB_CF_NATIVE || (rows[i][j].phase==LB_CF_STREAM && rows[i][j].wait_native)) {
            int fd=rows[i][j].fd; if (fd<0) immediate=true; else fds[count++]=(struct pollfd){fd,POLLIN,0};
        }
        /* One aggregate wait: an earlier pending method cannot starve a later
         * one. A bounded timeout also admits independent guest continuations. */
        if (!immediate && poll(fds,count,count?100:1)<0 && errno!=EINTR) fail("could not wait for native tasks");
        for (unsigned i=0;i<LB_METHODS;++i) if (!stream_methods[i]) check(lb_cf_advance(&drivers[i],0));
    }
    wasmtime_component_val_t value={0};check(wasmtime_component_func_call(&take,ctx,NULL,0,&value,1));
    if (value.kind!=WASMTIME_COMPONENT_S64) fail("invalid application result");
    shutdown_owners();wasmtime_component_linker_delete(link);wasmtime_store_delete(store);
    wasmtime_component_delete(component);wasm_engine_delete(engine);
    printf("%" PRId64 "\n",value.of.s64);return 0;
}
