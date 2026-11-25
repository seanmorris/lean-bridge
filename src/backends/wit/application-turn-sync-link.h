/* Private store calls for source-typed synchronous operations. No linker
 * callback calls into the store. Wasm serves the yielded member/equality
 * requests after this callback has already returned to it. */
#ifndef LB_WIT_APPLICATION_TURN_SYNC_LINK_H
#define LB_WIT_APPLICATION_TURN_SYNC_LINK_H
enum {LB_TS_BEGIN,LB_TS_TAKE,LB_TS_ARGS,LB_TS_REPLY,LB_TS_ANSWER};
typedef struct {
    lb_wit_turns *turns;lb_ts_bus *bus;unsigned depth;uint64_t next;
    struct {uint64_t id;lb_wit_event ev;} frames[LB_WIT_TURN_DEPTH];
} lb_ts_control;
/* Retire the owner first: it may still be reading or unwinding these slots.
 * The store is never entered during disposal, even after a guest trap. */
static inline bool lb_ts_retire(lb_ts_control *c){
    if(!c || !c->bus || !lb_wit_turn_retire(c->turns))return false;
    for(unsigned i=0;i<LB_WIT_TURN_DEPTH;i++)if(c->bus->slots[i].occupied)lb_ts_slot_clear(c->bus->slots+i);
    c->depth=0;return true;
}
typedef struct {lb_ts_control *control;unsigned action,method;} lb_ts_hook;
static inline wasmtime_error_t *lb_ts_step(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *ft,
    lb_val *in,size_t n,lb_val *out,size_t results){
    (void)ctx;(void)ft;lb_ts_hook *h=data;lb_ts_control *c=h->control;lb_ts_bus *b=c->bus;unsigned k=0;
    if(results!=1)return wasmtime_error_new("invalid sync result arity");
    lb_wit_event ev={0};lb_ts_slot *s=NULL;
    if(h->action==LB_TS_BEGIN){
        if(c->next==UINT64_MAX || c->depth>=LB_WIT_TURN_DEPTH || (c->depth && c->frames[c->depth-1].ev.done))
            return wasmtime_error_new("invalid nested synchronous call");
        if(n!=1 || in->kind!=WASMTIME_COMPONENT_LIST || in->of.list.size>1)return wasmtime_error_new("invalid synchronous argument list");
        k=c->depth;s=b->slots+k;if(s->occupied)return wasmtime_error_new("synchronous slot occupied");
        ++c->depth;s->occupied=true;s->method=h->method;c->frames[k].id=++c->next;
        if(in->of.list.size)wasmtime_component_val_clone(in->of.list.data,&s->args);
        else {s->args=(lb_val){.kind=WASMTIME_COMPONENT_TUPLE};wasmtime_component_valtuple_new_uninit(&s->args.of.tuple,0);}
        if(!lb_wit_turn_begin(c->turns,(lb_wit_message){LB_TS_ENTER,{k,h->method}},&ev))return wasmtime_error_new("synchronous Lean operation failed");
    }else{
        if(!c->depth || !n || in->kind!=WASMTIME_COMPONENT_U64 || in->of.u64!=c->frames[c->depth-1].id)
            return wasmtime_error_new("stale or suspended synchronous frame");
        k=c->depth-1;s=b->slots+k;ev=c->frames[k].ev;
        if(h->action==LB_TS_TAKE){
            if(n!=1 || !ev.done || s->method!=h->method)return wasmtime_error_new("unexpected synchronous return");
            *out=s->result;s->result=(lb_val){0};lb_ts_slot_clear(s);--c->depth;return NULL;
        }
        unsigned op=ev.message.op;bool member=!ev.done && op==LB_TS_MEMBER && ev.message.words[0]==h->method && ev.message.words[1]==k;
        if(h->action==LB_TS_ARGS){
            if(!member || n!=1 || s->request.kind!=WASMTIME_COMPONENT_TUPLE)return wasmtime_error_new("unexpected member arguments");
            /* A one-element list keeps arbitrarily wide tuples indirect.
               Zero-argument members return an empty list of u8. */
            *out=(lb_val){.kind=WASMTIME_COMPONENT_LIST};size_t len=s->request.of.tuple.size?1:0;
            wasmtime_component_vallist_new_uninit(&out->of.list,len);
            if(len)wasmtime_component_val_clone(&s->request,out->of.list.data);
            return NULL;
        }
        lb_wit_message reply={0};
        if(h->action==LB_TS_REPLY && member && n==2 && in[1].kind==WASMTIME_COMPONENT_LIST && in[1].of.list.size<=1){
            if(in[1].of.list.size)wasmtime_component_val_clone(in[1].of.list.data,&s->reply);
            reply=(lb_wit_message){LB_TS_MEMBER_REPLY,{k}};
        }else if(h->action==LB_TS_ANSWER && !ev.done && n==2 && in[1].kind==WASMTIME_COMPONENT_U64){
            uint64_t x=in[1].of.u64;
            if(op==LB_TS_CLONE && x)reply=(lb_wit_message){LB_TS_CLONED,{x}};
            else if((op==LB_TC_SAME || op==LB_TC_RELEASE) && x<=1)reply=(lb_wit_message){LB_TC_REPLY,{x}};
            else return wasmtime_error_new("unexpected owner reply");
        }else return wasmtime_error_new("unexpected synchronous reply");
        if(!lb_wit_turn_reply(c->turns,ev.ticket,reply,&ev))return wasmtime_error_new("synchronous Lean frame failed to resume");
    }
    if(ev.done?(ev.message.op!=LB_TC_DONE || ev.message.words[0]!=k):
        (ev.message.op!=LB_TC_SAME && ev.message.op!=LB_TC_RELEASE && ev.message.op!=LB_TS_CLONE && ev.message.op!=LB_TS_MEMBER))
        return wasmtime_error_new("invalid synchronous owner event");
    c->frames[k].ev=ev;*out=(lb_val){.kind=WASMTIME_COMPONENT_TUPLE};wasmtime_component_valtuple_new_uninit(&out->of.tuple,5);
    lb_val *v=out->of.tuple.data;
    v[0]=(lb_val){.kind=WASMTIME_COMPONENT_U64,.of.u64=c->frames[k].id};
    v[1]=(lb_val){.kind=WASMTIME_COMPONENT_U32,.of.u32=ev.message.op};
    v[2]=(lb_val){.kind=WASMTIME_COMPONENT_U32,.of.u32=(uint32_t)ev.message.words[0]};
    v[3]=(lb_val){.kind=WASMTIME_COMPONENT_U64,.of.u64=ev.message.words[1]};v[4]=(lb_val){.kind=WASMTIME_COMPONENT_U64,.of.u64=ev.message.words[2]};
    return NULL;
}
#endif
