/* Store-side channel operations. Advance only between top-level guest turns:
 * a parked native descriptor must not mask a reader's cancellation. */
#ifndef LB_WIT_APPLICATION_TURN_CHANNELS_H
#define LB_WIT_APPLICATION_TURN_CHANNELS_H
#include "application-turn-future-link.h"
#include <stdlib.h>
enum {LB_TG_STREAM=LB_TF_RETAINED+1,LB_TG_BASE=65536};
typedef struct {const char *name;unsigned kind;} lb_tg_spec;
typedef struct {lb_tc_port port;wasmtime_context_t *ctx;wasmtime_component_func_t pump,retire,drain;} lb_tg_stream;
typedef union {lb_tg_stream stream;lb_tf_driver future;} lb_tg_port;
static inline uint32_t lb_tg_code(unsigned channel,unsigned op){return LB_TG_BASE+channel*16+op;}
static inline wasmtime_error_t *lb_tg_link_one(lb_tg_port *c,const lb_tg_spec *s,unsigned i,wasmtime_component_linker_instance_t *root,lb_wit_turns *turns){
    unsigned base=lb_tg_code(i,0);
    return s->kind==LB_TG_STREAM?lb_tc_link(root,s->name,turns,base,&c->stream.port):lb_tf_link(root,s->name,turns,base,s->kind,&c->future.port);
}
static inline bool lb_tg_open_one_at(lb_tg_port *c,const lb_tg_spec *s,wasmtime_component_instance_t *inst,wasmtime_context_t *ctx,const char *scope){
    const bool stream=s->kind==LB_TG_STREAM;const char *prefix=s->name+5;
    const char *names[]={"retire","drain",stream?"pump":"poll","deliver","reap","close"};
    wasmtime_component_func_t *fs[6];
    if(stream){
        if(c->stream.ctx || !c->stream.port.turns)return false;
        c->stream.ctx=ctx;fs[0]=&c->stream.retire;fs[1]=&c->stream.drain;fs[2]=&c->stream.pump;
    }else{
        if(c->future.ctx || !c->future.port.port.turns)return false;
        lb_tf_driver *d=&c->future;d->ctx=ctx;
        fs[0]=&d->retire;fs[1]=&d->drain;fs[2]=&d->poll;fs[3]=&d->deliver;fs[4]=&d->reap;fs[5]=&d->close;
    }
    size_t ns=strlen(scope),np=strlen(prefix);if(ns>SIZE_MAX-9 || np>SIZE_MAX-9-ns)return false;
    size_t n=ns+np;char *full=malloc(n+9);if(!full)return false;memcpy(full,scope,ns);memcpy(full+ns,prefix,np);full[n]='-';
    bool ok=true;for(unsigned j=0;j<(stream?3u:6u);j++){
        size_t len=strlen(names[j]);memcpy(full+n+1,names[j],len);
        wasmtime_component_export_index_t *id=wasmtime_component_instance_get_export_index(inst,ctx,NULL,full,n+1+len);
        ok=id && wasmtime_component_instance_get_func(inst,ctx,id,fs[j]);
        if(id)wasmtime_component_export_index_delete(id);
        if(!ok)break;
    }free(full);return ok;
}
static inline bool lb_tg_open_one(lb_tg_port *c,const lb_tg_spec *s,wasmtime_component_instance_t *inst,wasmtime_context_t *ctx){
    return lb_tg_open_one_at(c,s,inst,ctx,"");
}
static inline wasmtime_error_t *lb_tg_advance_one(lb_tg_port *c,const lb_tg_spec *s,unsigned *changed){
    if(s->kind!=LB_TG_STREAM){
        for(unsigned i=0;i<64;i++)if(c->future.port.port.active[i])return lb_tf_advance(&c->future,changed);
        return NULL;
    }
    lb_tg_stream *d=&c->stream;
    for(unsigned k=0;k<64;k++)if(d->port.active[k]){
        wasmtime_component_val_t key={.kind=WASMTIME_COMPONENT_U32,.of.u32=k+1},v={0};
        wasmtime_error_t *e=wasmtime_component_func_call(&d->pump,d->ctx,&key,1,&v,1);if(e)return e;
        if(v.kind!=WASMTIME_COMPONENT_U32 || v.of.u32>2)return wasmtime_error_new("invalid cursor pump state");
        if(v.of.u32>=2)++*changed;
    }return NULL;
}
static inline wasmtime_error_t *lb_tg_retire_one(lb_tg_port *c,const lb_tg_spec *s){
    if(s->kind!=LB_TG_STREAM)return lb_tf_retire(&c->future);
    lb_tg_stream *d=&c->stream;
    for(unsigned k=0;k<64;k++)if(d->port.active[k]){
        wasmtime_component_val_t key={.kind=WASMTIME_COMPONENT_U32,.of.u32=k+1};
        wasmtime_error_t *e=wasmtime_component_func_call(&d->retire,d->ctx,&key,1,NULL,0);if(e)return e;
        if(d->port.active[k])return wasmtime_error_new("cursor did not retire");
    }return NULL;
}
#endif
