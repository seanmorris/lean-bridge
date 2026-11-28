/* Private typed values stay in this process; only an operation and row
 * number cross the rendezvous. The calling store thread keeps arguments
 * alive until the native owner replies. Copied workers cannot call a guest. */
#ifndef LB_WIT_APPLICATION_TURN_COPIED_LINK_H
#define LB_WIT_APPLICATION_TURN_COPIED_LINK_H
#include "application-turn-channels.h"
enum {LB_CP_START=9,LB_CP_CHECK,LB_CP_PEEK,LB_CP_PULL,LB_CP_CLOSE,LB_CP_ACT};
typedef struct {const lb_val *args;size_t count;lb_val reply;const char *error;bool busy;} lb_cp_wire;
typedef struct {lb_cp_wire *wire;lb_tc_port *port;bool *delivered;unsigned action;} lb_cp_hook;
typedef struct {lb_cp_hook hooks[4];} lb_cp_linker;
static inline wasmtime_error_t *lb_cp_step(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *type,
    lb_val *args,size_t n,lb_val *out,size_t results){
    (void)ctx;(void)type;lb_cp_hook *h=data;lb_cp_wire *w=h->wire;lb_tc_port *p=h->port;
    unsigned action=h->action,op=action,k=0;bool stream=!h->delivered;
    if(!p->turns || w->busy || results!=(unsigned)(action!=LB_CP_CLOSE))return wasmtime_error_new("invalid copied worker frame");
    if(action!=LB_CP_START){
        if(n!=(action==LB_CP_ACT?2u:1u) || args[0].kind!=WASMTIME_COMPONENT_U32 ||
           !(k=args[0].of.u32) || k>64 || !p->active[k-1])return wasmtime_error_new("inactive copied worker");
        if(action==LB_CP_ACT){
            if(args[1].kind!=WASMTIME_COMPONENT_U32 || args[1].of.u32>2)return wasmtime_error_new("invalid copied cursor action");
            const unsigned actions[]={LB_CP_PULL,LB_CP_CHECK,LB_CP_CLOSE};op=actions[args[1].of.u32];
        }
    }
    *w=(lb_cp_wire){.busy=true,.args=args,.count=n};lb_wit_event ev={0};
    bool ok=lb_wit_turn_begin(p->turns,(lb_wit_message){.op=p->base+op,.words={k}},&ev);
    const char *error=w->error;
    if(!ok || !ev.done || ev.message.op!=LB_TC_DONE || ev.message.words[2] || ev.message.words[1]>(uint64_t)INT_MAX+1)
        error="copied worker operation failed";
    if(!error){
        uint64_t state=ev.message.words[0],fd=ev.message.words[1];
        if(op==LB_CP_START){
            if(state>64 || (state && p->active[state-1]) || (!state && fd))error="invalid copied factory result";
            else if(state){p->active[state-1]=true;p->fd[state-1]=fd?(int)(fd-1):-1;if(!stream)h->delivered[state-1]=false;}
        }else if(op==LB_CP_CHECK){
            if(state>(stream?3u:1u) || (state && fd) || (!state && !fd))error="invalid copied readiness";
            else p->fd[k-1]=fd?(int)(fd-1):-1;
        }else if(op==LB_CP_CLOSE){p->active[k-1]=false;p->fd[k-1]=-1;if(!stream)h->delivered[k-1]=false;}
        if(!error){
            if(op==LB_CP_START || op==LB_CP_PEEK){*out=w->reply;w->reply=(lb_val){0};}
            else if(action==LB_CP_ACT)*out=(lb_val){.kind=WASMTIME_COMPONENT_U32,.of.u32=(uint32_t)state};
            else if(op==LB_CP_CHECK)*out=(lb_val){.kind=WASMTIME_COMPONENT_BOOL,.of.boolean=state!=0};
        }
    }
    wasmtime_component_val_delete(&w->reply);*w=(lb_cp_wire){0};return error?wasmtime_error_new(error):NULL;
}
static inline wasmtime_error_t *lb_cp_link(lb_cp_linker *l,lb_cp_wire *w,lb_tg_port *g,bool stream,
    const char *name,wasmtime_component_linker_instance_t *root){
    wasmtime_component_linker_instance_t *ns=NULL;
    wasmtime_error_t *e=wasmtime_component_linker_instance_add_instance(root,name,strlen(name),&ns);if(e)return e;
    lb_tc_port *p=stream?&g->stream.port:&g->future.port.port;
    const char *names[]={"begin","peek",stream?"act":"poll","close"};
    const unsigned ops[]={LB_CP_START,LB_CP_PEEK,stream?LB_CP_ACT:LB_CP_CHECK,LB_CP_CLOSE};
    for(unsigned i=0;i<(stream?3u:4u) && !e;i++){
        l->hooks[i]=(lb_cp_hook){w,p,stream?NULL:g->future.port.delivered,ops[i]};
        e=wasmtime_component_linker_instance_add_func(ns,names[i],strlen(names[i]),lb_cp_step,l->hooks+i,NULL);
    }
    wasmtime_component_linker_instance_delete(ns);return e;
}
#endif
