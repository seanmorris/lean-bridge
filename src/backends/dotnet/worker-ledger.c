/* Transport tokens exist only during one owner-side start, take, callback
   argument or reply. A worker holds ordinary Lean references instead. An
   unconsumed token cannot keep a dead CLR binding (or its assembly) alive. */
#define LB_CLR_WORKER_LEDGER_IMPL 1
#include "worker-ledger.h"
#include "lean_bridge_native_runtime.h"
#include <stdlib.h>
#include <string.h>
#include <sys/syscall.h>
#include <unistd.h>

typedef struct token {
    struct token *next;
    const char *kind; /* generated static literal */
    uint64_t h[2];
} token;
typedef struct scope { lb_dn_frame *frame; token *tokens; } scope;
static _Thread_local scope *current;
static int owner(void) {
    return getpid()==(pid_t)syscall(SYS_gettid) && lean_bridge_native_process_valid();
}
static int active(void) {
    return current && owner() && lb_dn_current()==current->frame;
}
lb_dn_frame *lb_clr_worker_frame(void) { return active()?current->frame:NULL; }
/* The provider admits f with LB_DND(enter) before visiting. The generated
   managed trampoline catches exceptions; it never waits on a Lean task or
   delivers a user callback while one of these native operations is open. */
int lb_clr_worker_visit(lb_dn_frame *f,int (*invoke)(uint64_t)) {
    if(!owner() || !f || f!=lb_dn_current() || !f->domain_session || !invoke) return 10;
    scope s={.frame=f}, *parent=current; current=&s;
    int status=invoke(f->call);
    if(status==-1) {
        for(lb_dn_frame *p=f;p;p=p->parent) p->fatal=1;
        f->retire();
    }
    current=parent;
    while(s.tokens) {
        token *row=s.tokens; s.tokens=row->next;
        LB_LEASE(release)(row->kind,row->h); free(row);
    }
    return f->fatal?10:status;
}
static token **lookup(const char *kind,const uint64_t h[2]) {
    if(!active() || !h || !h[0] || !kind) return NULL;
    token **p=&current->tokens;
    while(*p && (*p)->h[0]!=h[0]) p=&(*p)->next;
    return *p && (*p)->h[1]==h[1] && !strcmp((*p)->kind,kind) ? p : NULL;
}
int lb_clr_worker_create(const char *kind,lean_object *v,uint64_t h[2]) {
    if(!active() || !kind || !v || !h) return LB_LEASE_CLOSED;
    token *row=malloc(sizeof(*row)); if(!row) return LB_LEASE_MEMORY;
    int status=LB_LEASE(create)(kind,v,h); if(status!=LB_LEASE_OK) { free(row); return status; }
    *row=(token){current->tokens,kind,{h[0],h[1]}}; current->tokens=row;
    return LB_LEASE_OK;
}
lean_object *lb_clr_worker_borrow(const char *kind,const uint64_t h[2]) {
    return lookup(kind,h) ? LB_LEASE(borrow)(kind,h) : NULL;
}
int lb_clr_worker_release(const char *kind,uint64_t h[2]) {
    token **p=lookup(kind,h); if(!p) return LB_LEASE_CLOSED;
    int status=LB_LEASE(release)(kind,h);
    if(status==LB_LEASE_OK) { token *row=*p; *p=row->next; free(row); }
    return status;
}
