/* Native side of a synchronous call inside an async Wasm store. Only the
 * frame number, event and lease tokens enter the rendezvous. The typed slots
 * hold copied Component Model data, never ResourceAny or guest pointers.
 * The two threads alternate ownership at the rendezvous, including reentry. */
#ifndef LB_WIT_APPLICATION_TURN_SYNC_H
#define LB_WIT_APPLICATION_TURN_SYNC_H
#include "application-turn-cursor.h"
#include <stdlib.h>
enum {LB_TS_ENTER=4096,LB_TS_MEMBER,LB_TS_MEMBER_REPLY,LB_TS_CLONE,LB_TS_CLONED};
typedef struct {lb_val args,result,request,reply;unsigned method;bool occupied;} lb_ts_slot;
typedef struct lb_ts_fault {struct lb_ts_fault *next;uint64_t token;uint32_t id;} lb_ts_fault;
typedef struct lb_ts_frame {
    struct lb_ts_frame *parent;lb_ts_fault *faults;unsigned count,index;
} lb_ts_frame;
typedef struct {
    lb_tc_refs *refs;lb_ts_frame *frame;lb_ts_slot slots[LB_WIT_TURN_DEPTH];bool poisoned;
} lb_ts_bus;
static inline bool lb_ts_read_token(const lb_val *v,uint64_t *out){
    if(!v || v->kind!=WASMTIME_COMPONENT_U64 || !v->of.u64)return false;
    *out=v->of.u64;return true;
}
static inline bool lb_ts_clone(lb_ts_bus *b,unsigned kind,uint64_t ticket,lb_val *out){
    lb_wit_message r={0};
    if(!ticket || !lb_wit_turn_request(b->refs->turns,(lb_wit_message){LB_TS_CLONE,{kind,ticket}},&r) ||
       r.op!=LB_TS_CLONED || !r.words[0] || r.words[0]==ticket || r.words[1] || r.words[2])return false;
    *out=(lb_val){.kind=WASMTIME_COMPONENT_U64,.of.u64=r.words[0]};return true;
}
static inline uint32_t lb_ts_capture(lb_ts_bus *b,lb_val *v){
    lb_ts_frame *f=b->frame;uint64_t t=0;
    if(!f || f->count>=4096 || !lb_ts_read_token(v,&t))return UINT32_MAX;
    lb_ts_fault *p=malloc(sizeof *p);if(!p)return UINT32_MAX;
    *p=(lb_ts_fault){.next=f->faults,.token=t,.id=++f->count};f->faults=p;return p->id;
}
static inline bool lb_ts_finish(lb_ts_bus *b,unsigned kind,uint32_t id,lb_val *out){
    bool found=!id,ok=true;lb_ts_frame *f=b->frame;
    while(f->faults){
        lb_ts_fault *p=f->faults;f->faults=p->next;
        if(id==p->id && out && !found){*out=(lb_val){.kind=WASMTIME_COMPONENT_U64,.of.u64=p->token};found=true;}
        else if(!b->poisoned && !lb_tc_release(b->refs,kind,p->token))ok=false;
        free(p);
    }return found && ok;
}
static inline bool lb_ts_member(lb_ts_bus *b,unsigned member,lb_val *args,size_t n,lb_val *result){
    if(!b || b->poisoned || !b->frame)return false;
    unsigned k=b->frame->index;lb_ts_slot *s=b->slots+k;s->request=(lb_val){.kind=WASMTIME_COMPONENT_TUPLE};
    wasmtime_component_valtuple_new_uninit(&s->request.of.tuple,n);
    for(size_t i=0;i<n;i++){s->request.of.tuple.data[i]=args[i];args[i]=(lb_val){0};}
    lb_wit_message r={0};bool ok=lb_wit_turn_request(b->refs->turns,(lb_wit_message){LB_TS_MEMBER,{member,k}},&r) &&
        r.op==LB_TS_MEMBER_REPLY && r.words[0]==k && !r.words[1] && !r.words[2];
    wasmtime_component_val_delete(&s->request);s->request=(lb_val){0};
    if(ok){*result=s->reply;s->reply=(lb_val){0};}return ok;
}
static inline void lb_ts_slot_clear(lb_ts_slot *s){
    wasmtime_component_val_delete(&s->args);wasmtime_component_val_delete(&s->result);
    wasmtime_component_val_delete(&s->request);wasmtime_component_val_delete(&s->reply);*s=(lb_ts_slot){0};
}
#endif
