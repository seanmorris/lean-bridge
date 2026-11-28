/* Store-thread transport for callback-bearing tasks. The native owner alone
 * drives Lean and the store thread alone consults the borrowed readiness fd. */
#ifndef LB_WIT_APPLICATION_TURN_FUTURE_LINK_H
#define LB_WIT_APPLICATION_TURN_FUTURE_LINK_H
#include "application-turn-cursor-link.h"
#include <errno.h>
#include <poll.h>
typedef struct {
    lb_tc_port port;
    unsigned expected[LB_WIT_TURN_DEPTH],kind;bool delivered[64];
} lb_tf_port;
enum { LB_TF_SINGLE,LB_TF_FACTORY,LB_TF_RETAINED };
static inline wasmtime_error_t *lb_tf_wasm(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *ft,
    wasmtime_component_val_t *in,size_t argc,wasmtime_component_val_t *out,size_t retc){
    (void)ctx;(void)ft;lb_tf_port *f=data;lb_tc_port *p=&f->port;
    if(argc!=4 || retc!=1 || in[0].kind!=WASMTIME_COMPONENT_U32 || in[1].kind!=WASMTIME_COMPONENT_U32 ||
       in[2].kind!=WASMTIME_COMPONENT_U64 || in[3].kind!=WASMTIME_COMPONENT_U64)return wasmtime_error_new("invalid future message");
    unsigned op=in[0].of.u32,key=in[1].of.u32;uint64_t x=in[2].of.u64,y=in[3].of.u64;lb_wit_event ev={0};
    if(op==LB_TC_REPLY || op==LB_TC_CALLBACK_REPLY){
        if(!p->depth || key>1 || y || (op==LB_TC_CALLBACK_REPLY)!=!!x || f->expected[p->depth-1]!=op ||
           !lb_wit_turn_reply(p->turns,p->frames[p->depth-1].ticket,(lb_wit_message){op,{key,x}},&ev))
            return wasmtime_error_new("invalid future owner reply");
        op=p->frames[p->depth-1].op;key=p->frames[p->depth-1].key;
    }else{
        if(op>LB_TF_DRAIN || p->depth>=LB_WIT_TURN_DEPTH || (op==LB_TF_OPEN ? key || !x || !!y!=(f->kind==LB_TF_RETAINED) :
           op==LB_TF_DRAIN ? key || x || y : !key || key>64 || !p->active[key-1] || y || (op!=LB_TF_TEXT && x)))
            return wasmtime_error_new("invalid future request");
        if(!lb_wit_turn_begin(p->turns,(lb_wit_message){p->base+op,{key,x,y}},&ev))return wasmtime_error_new("compiled Lean future rejected request");
        p->frames[p->depth].op=op;p->frames[p->depth].key=key;++p->depth;
    }
    uint64_t tag=ev.message.words[0],last=ev.message.words[2];
    if(tag>UINT32_MAX)return wasmtime_error_new("invalid future status");
    if(ev.done){
        if(ev.message.op!=LB_TC_DONE)return wasmtime_error_new("invalid future completion");
        --p->depth;
        if(op==LB_TF_OPEN || op==LB_TF_POLL){
            if(last>(uint64_t)INT_MAX+1)return wasmtime_error_new("invalid future readiness");
            if(op==LB_TF_OPEN){
                if(!tag || tag>64 || p->active[tag-1] || (ev.message.words[1] && (f->kind!=LB_TF_FACTORY || last)))
                    return wasmtime_error_new("invalid new future");
                key=(unsigned)tag;p->active[key-1]=true;f->delivered[key-1]=false;
            }else if(tag>1 || (!tag)!=!!last)return wasmtime_error_new("invalid poll status");
            p->fd[key-1]=last?(int)(last-1):-1;last=0;
        }else if(op==LB_TF_CLOSE){p->active[key-1]=false;f->delivered[key-1]=false;p->fd[key-1]=-1;}
    }else{
        if((ev.message.op!=LB_TC_INVOKE || f->kind!=LB_TF_RETAINED) && ev.message.op!=LB_TC_SAME && ev.message.op!=LB_TC_RELEASE)return wasmtime_error_new("invalid future owner request");
        f->expected[p->depth-1]=ev.message.op==LB_TC_INVOKE?LB_TC_CALLBACK_REPLY:LB_TC_REPLY;p->frames[p->depth-1].ticket=ev.ticket;
    }
    *out=(wasmtime_component_val_t){.kind=WASMTIME_COMPONENT_TUPLE};wasmtime_component_valtuple_new_uninit(&out->of.tuple,4);
    wasmtime_component_val_t *v=out->of.tuple.data;
    v[0]=(wasmtime_component_val_t){.kind=WASMTIME_COMPONENT_U32,.of.u32=ev.message.op};
    v[1]=(wasmtime_component_val_t){.kind=WASMTIME_COMPONENT_U32,.of.u32=(uint32_t)tag};
    v[2]=(wasmtime_component_val_t){.kind=WASMTIME_COMPONENT_U64,.of.u64=ev.message.words[1]};
    v[3]=(wasmtime_component_val_t){.kind=WASMTIME_COMPONENT_U64,.of.u64=last};return NULL;
}
static inline wasmtime_error_t *lb_tf_link(wasmtime_component_linker_instance_t *root,const char *name,lb_wit_turns *s,unsigned base,unsigned kind,lb_tf_port *f){
    if(!f || f->port.turns || !s || !root || !name || base>UINT32_MAX-LB_TF_DRAIN || kind>LB_TF_RETAINED)return wasmtime_error_new("invalid future binding");
    f->port.turns=s;f->port.base=base;f->kind=kind;
    for(unsigned k=0;k<64;k++)f->port.fd[k]=-1;
    return wasmtime_component_linker_instance_add_func(root,name,strlen(name),lb_tf_wasm,f,NULL);
}
/* Called between application turns, not from within a Wasmtime linker hook. */
typedef struct {
    lb_tf_port port;wasmtime_context_t *ctx;
    wasmtime_component_func_t poll,deliver,reap,retire,close,drain;
} lb_tf_driver;
static inline wasmtime_error_t *lb_tf_close_key(lb_tf_driver *d,unsigned k){
    wasmtime_component_val_t key={.kind=WASMTIME_COMPONENT_U32,.of.u32=k};
    return wasmtime_component_func_call(&d->close,d->ctx,&key,1,NULL,0);
}
static inline wasmtime_error_t *lb_tf_reap(lb_tf_driver *d,unsigned *changed){
    for(;;){
        wasmtime_component_val_t v={0};wasmtime_error_t *e=wasmtime_component_func_call(&d->reap,d->ctx,NULL,0,&v,1);if(e)return e;
        if(v.kind!=WASMTIME_COMPONENT_U32 || v.of.u32>64)return wasmtime_error_new("invalid future acknowledgement");
        unsigned k=v.of.u32;if(!k)return NULL;
        if(!d->port.port.active[k-1])return wasmtime_error_new("acknowledgement for unknown future");
        if((e=lb_tf_close_key(d,k)))return e;
        ++*changed;
    }
}
static inline wasmtime_error_t *lb_tf_advance(lb_tf_driver *d,unsigned *changed){
    wasmtime_error_t *e=lb_tf_reap(d,changed);if(e)return e;
    for(unsigned i=0;i<64;i++){
        if(!d->port.port.active[i] || d->port.delivered[i])continue;
        int fd=d->port.port.fd[i];if(fd>=0){
            struct pollfd p={.fd=fd,.events=POLLIN};int n=poll(&p,1,0);
            if(n<0 && errno==EINTR)continue;
            if(n<0 || (n && !(p.revents&(POLLIN|POLLHUP))))return wasmtime_error_new("invalid native future wakeup");
            if(!n)continue;
        }
        wasmtime_component_val_t key={.kind=WASMTIME_COMPONENT_U32,.of.u32=i+1},v={0};
        if((e=wasmtime_component_func_call(&d->poll,d->ctx,&key,1,&v,1)))return e;
        if(v.kind!=WASMTIME_COMPONENT_BOOL)return wasmtime_error_new("invalid native future poll");
        ++*changed;if(!v.of.boolean)continue;
        if((e=wasmtime_component_func_call(&d->deliver,d->ctx,&key,1,&v,1)))return e;
        if(v.kind!=WASMTIME_COMPONENT_U32 || v.of.u32>2)return wasmtime_error_new("invalid future delivery");
        if(v.of.u32==2)d->port.delivered[i]=true;
        else if((e=lb_tf_close_key(d,i+1)))return e;
    }
    return NULL;
}
static inline wasmtime_error_t *lb_tf_retire(lb_tf_driver *d){
    unsigned changed=0;wasmtime_error_t *e=lb_tf_reap(d,&changed);if(e)return e;
    for(unsigned i=0;i<64;i++)if(d->port.port.active[i]){
        wasmtime_component_val_t key={.kind=WASMTIME_COMPONENT_U32,.of.u32=i+1};
        if(d->port.delivered[i] && (e=wasmtime_component_func_call(&d->retire,d->ctx,&key,1,NULL,0)))return e;
        if((e=lb_tf_close_key(d,i+1)))return e;
    }
    return NULL;
}
#endif
