/* Store-thread half of the private cursor protocol. A readiness descriptor
 * is local to this embedding and must never be passed to a Wasm guest. */
#ifndef LB_WIT_APPLICATION_TURN_CURSOR_LINK_H
#define LB_WIT_APPLICATION_TURN_CURSOR_LINK_H
#include "application-turn-cursor.h"
#include <limits.h>
#include <string.h>
#include <wasmtime.h>
typedef struct {
    lb_wit_turns *turns; unsigned base,depth;bool active[64];int fd[64];
    struct {lb_wit_ticket ticket;unsigned op,key;} frames[LB_WIT_TURN_DEPTH];
} lb_tc_port;
static inline wasmtime_error_t *lb_tc_wasm(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *ft,
    wasmtime_component_val_t *in,size_t argc,wasmtime_component_val_t *out,size_t retc){
    (void)ctx;(void)ft;lb_tc_port *p=data;
    if(argc!=3 || retc!=1 || in[0].kind!=WASMTIME_COMPONENT_U32 || in[1].kind!=WASMTIME_COMPONENT_U32 ||
       in[2].kind!=WASMTIME_COMPONENT_U64)return wasmtime_error_new("invalid cursor message");
    unsigned op=in[0].of.u32,key=in[1].of.u32;lb_wit_event ev={0};
    if(op==LB_TC_REPLY){
        if(!p->depth || key>1 || in[2].of.u64 || !lb_wit_turn_reply(p->turns,p->frames[p->depth-1].ticket,(lb_wit_message){op,{key}},&ev))
            return wasmtime_error_new("invalid cursor owner reply");
        op=p->frames[p->depth-1].op;key=p->frames[p->depth-1].key;
    }else{
        if(op>LB_TC_DRAIN || p->depth>=LB_WIT_TURN_DEPTH || (op==LB_TC_DRAIN ? key || in[2].of.u64 :
           op==LB_TC_OPEN ? key || !in[2].of.u64 : !key || key>64 || !p->active[key-1] || in[2].of.u64))
            return wasmtime_error_new("invalid cursor request");
        if(!lb_wit_turn_begin(p->turns,(lb_wit_message){p->base+op,{key,in[2].of.u64}},&ev))
            return wasmtime_error_new("compiled Lean cursor rejected request");
        p->frames[p->depth].op=op;p->frames[p->depth].key=key;++p->depth;
    }
    uint64_t second=ev.message.words[2];
    if(ev.done){
        if(ev.message.op!=LB_TC_DONE || ev.message.words[0]>UINT32_MAX)return wasmtime_error_new("invalid cursor completion");
        --p->depth;
        if(op==LB_TC_OPEN){
            uint64_t k=ev.message.words[0];if(!k || k>64 || p->active[k-1])return wasmtime_error_new("invalid new cursor");
            p->active[k-1]=true;p->fd[k-1]=-1;
        }else if(op==LB_TC_CLOSE){p->active[key-1]=false;p->fd[key-1]=-1;}
        else if(op==LB_TC_CHECK){
            if(second>(uint64_t)INT_MAX+1 || (!ev.message.words[0])!=!!second)return wasmtime_error_new("invalid cursor readiness");
            p->fd[key-1]=second?(int)(second-1):-1;
        }
        second=0;
    }else{
        if(ev.message.op!=LB_TC_SAME && ev.message.op!=LB_TC_RELEASE)return wasmtime_error_new("invalid cursor owner request");
        p->frames[p->depth-1].ticket=ev.ticket;
    }
    *out=(wasmtime_component_val_t){.kind=WASMTIME_COMPONENT_TUPLE};wasmtime_component_valtuple_new_uninit(&out->of.tuple,4);
    wasmtime_component_val_t *v=out->of.tuple.data;
    v[0]=(wasmtime_component_val_t){.kind=WASMTIME_COMPONENT_U32,.of.u32=ev.message.op};
    v[1]=(wasmtime_component_val_t){.kind=WASMTIME_COMPONENT_U32,.of.u32=(uint32_t)ev.message.words[0]};
    v[2]=(wasmtime_component_val_t){.kind=WASMTIME_COMPONENT_U64,.of.u64=ev.message.words[1]};
    v[3]=(wasmtime_component_val_t){.kind=WASMTIME_COMPONENT_U64,.of.u64=second};
    return NULL;
}
static inline wasmtime_error_t *lb_tc_link(wasmtime_component_linker_instance_t *root,const char *name,
    lb_wit_turns *s,unsigned base,lb_tc_port *p){
    if(!p || !s || p->turns || !root || !name || base>UINT32_MAX-LB_TC_DRAIN)return wasmtime_error_new("invalid cursor binding");
    p->turns=s;p->base=base;for(unsigned i=0;i<64;i++)p->fd[i]=-1;
    return wasmtime_component_linker_instance_add_func(root,name,strlen(name),lb_tc_wasm,p,NULL);
}
#endif
