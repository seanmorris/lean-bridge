/* Private transaction state. Only the Lean owner thread accesses the native
 * registry and this pool. The Wasm component owns the originals, and alone
 * implements equality, retain and drop. Every native frame holds tickets. */
#ifndef LB_WIT_APPLICATION_TURN_CURSOR_H
#define LB_WIT_APPLICATION_TURN_CURSOR_H
#include "application-turn.h"
#include <stddef.h>
enum { LB_TC_OPEN,LB_TC_PULL,LB_TC_CHECK,LB_TC_CLOSE,LB_TC_PEEK,LB_TC_ACK,LB_TC_REPLY,LB_TC_DRAIN };
enum { LB_TC_DONE,LB_TC_RELEASE,LB_TC_SAME };
enum { LB_TC_FREE,LB_TC_LIVE,LB_TC_RETIRED };
typedef struct { unsigned state,kind,pins; uint64_t ticket; } lb_tc_ref;
typedef struct { lb_wit_turns *turns; lb_tc_ref rows[256]; } lb_tc_refs;
static inline bool lb_tc_guest(lb_tc_refs *s,unsigned op,unsigned kind,uint64_t a,uint64_t b,bool *answer){
    lb_wit_message result={0};
    if(!lb_wit_turn_request(s->turns,(lb_wit_message){op,{kind,a,b}},&result) ||
       result.op!=LB_TC_REPLY || result.words[0]>1)return false;
    *answer=result.words[0]!=0;return true;
}
static inline bool lb_tc_release(lb_tc_refs *s,unsigned kind,uint64_t token){
    bool ok=false;return lb_tc_guest(s,LB_TC_RELEASE,kind,token,0,&ok) && ok;
}
static inline void lb_tc_dispose(void *ptr){
    lb_tc_ref *r=ptr;r->state=LB_TC_RETIRED;
}
static inline bool lb_tc_flush(lb_tc_refs *s){
    for(unsigned i=0;i<256;i++){
        lb_tc_ref *r=&s->rows[i];
        if(r->state!=LB_TC_RETIRED || r->pins)continue;
        unsigned kind=r->kind;uint64_t token=r->ticket;*r=(lb_tc_ref){0};
        if(!lb_tc_release(s,kind,token))return false;
    }
    return true;
}
static inline lb_tc_ref *lb_tc_acquire(lb_tc_refs *s,unsigned kind,uint64_t token){
    if(!token || !lb_tc_flush(s))return NULL;
    for(unsigned i=0;i<256;i++){
        lb_tc_ref *r=&s->rows[i];
        if(r->state!=LB_TC_LIVE || r->kind!=kind)continue;
        bool same=false;
        if(r->ticket==token)return NULL;
        /* A defining guest can re-enter Lean while comparing or dropping
           owners. Do not physically retire or reuse a row across that call. */
        ++r->pins;
        bool ok=lb_tc_guest(s,LB_TC_SAME,kind,token,r->ticket,&same);
        if(ok && same)ok=lb_tc_release(s,kind,token);
        --r->pins;
        if(!ok)return NULL;
        if(same){r->state=LB_TC_LIVE;return r;}
    }
    /* Never cache an empty row across a guest call. */
    for(unsigned i=0;i<256;i++)if(s->rows[i].state==LB_TC_FREE){
        s->rows[i]=(lb_tc_ref){.state=LB_TC_LIVE,.kind=kind,.ticket=token};return &s->rows[i];
    }
    (void)lb_tc_release(s,kind,token);return NULL;
}
static inline bool lb_tc_token(const lb_tc_refs *s,unsigned kind,const void *ptr,uint64_t *token){
    for(unsigned i=0;i<256;i++){
        const lb_tc_ref *r=&s->rows[i];
        if(ptr==r && r->state==LB_TC_LIVE && r->kind==kind){*token=r->ticket;return true;}
    }
    return false;
}
#endif
