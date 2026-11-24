/* Task conversion on the existing JVM owner, not on the caller's virtual
   thread. No JNI local or transport token survives one start/take/arg/reply. */
#define LB_JVM_WORKER_LEDGER_IMPL 1
#include "worker-ledger.h"
#include "lean_bridge_native_runtime.h"
#include <stdlib.h>
#include <string.h>

typedef struct lb_jw_token {
    struct lb_jw_token *next;
    const char *kind;
    uint64_t h[2];
    lean_object *input; /* borrowed from this lease, for delayed strong admission */
} lb_jw_token;
typedef struct { lb_jh_frame *frame; lb_jhd_session *session; lb_jw_token *tokens; } lb_jw_scope;
static _Thread_local lb_jw_scope *active;
static int owner(void) { return LB_JVM_OWNER(current)() && lean_bridge_native_process_valid(); }
static int usable(void) { return active && owner() && active->frame==lb_jh_current(); }
jobject lb_jw_visit(lb_jh_frame *f,lb_jhd_session *session,lb_jh_body body,void *ctx) {
    if(!owner() || !f || f!=lb_jh_current() || !session || !body) return NULL;
    lb_jw_scope s={.frame=f,.session=session}, *outer=active; active=&s;
    jobject result=body(f,ctx);
    active=outer;
    while(s.tokens) {
        lb_jw_token *t=s.tokens; s.tokens=t->next;
        LB_LEASE(release)(t->kind,t->h); free(t);
    }
    return result;
}
static lb_jw_token **find(const char *kind,const uint64_t h[2]) {
    if(!usable() || !kind || !h || !h[0]) return NULL;
    lb_jw_token **p=&active->tokens;
    while(*p && (*p)->h[0]!=h[0]) p=&(*p)->next;
    return *p && (*p)->h[1]==h[1] && !strcmp((*p)->kind,kind) ? p : NULL;
}
int lb_jw_create(const char *kind,lean_object *v,uint64_t h[2]) {
    if(!usable() || !kind || !v || !h) return LB_LEASE_CLOSED;
    lb_jw_token *t=malloc(sizeof(*t)); if(!t) return LB_LEASE_MEMORY;
    int status=LB_LEASE(create)(kind,v,h);
    if(status!=LB_LEASE_OK) { free(t); return status; }
    *t=(lb_jw_token){.next=active->tokens,.kind=kind,.h={h[0],h[1]}};
    active->tokens=t; return LB_LEASE_OK;
}
lean_object *lb_jw_borrow(const char *kind,const uint64_t h[2]) {
    return find(kind,h) ? LB_LEASE(borrow)(kind,h) : NULL;
}
int lb_jw_release(const char *kind,uint64_t h[2]) {
    lb_jw_token **p=find(kind,h); if(!p) return LB_LEASE_CLOSED;
    int status=LB_LEASE(release)(kind,h);
    if(status==LB_LEASE_OK) { lb_jw_token *t=*p; *p=t->next; free(t); }
    return status;
}
int lb_jw_pin(unsigned index,const char *kind,jobject object,uint64_t h[2]) {
    if(!usable() || !h || h[0] || h[1]) return 5;
    lean_object *v=LB_JHD(wrap)(active->frame,active->session,index,object,NULL);
    if(!v) return 5; /* preserve the JNI exception for the original caller */
    lean_mark_mt(v);
    int status=lb_jw_create(kind,v,h);
    if(status==LB_LEASE_OK) active->tokens->input=v;
    lean_dec(v);
    return status==LB_LEASE_OK?0:status==LB_LEASE_MEMORY?11:10;
}
void lb_jw_admit(void) {
    if(!usable()) return;
    for(lb_jw_token *t=active->tokens;t;t=t->next)
        if(t->input) { LB_JHD(admit)(t->input); t->input=NULL; }
}
jobject lb_jw_object(unsigned index,const char *kind,const uint64_t h[2]) {
    lean_object *v=lb_jw_borrow(kind,h);
    return v?LB_JHD(object)(active->frame,active->session,index,v):NULL;
}
