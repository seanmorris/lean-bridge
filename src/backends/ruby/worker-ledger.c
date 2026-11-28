#define LB_RUBY_WORKER_LEDGER_IMPL 1
#include "worker-ledger.h"
#include "lean_bridge_native_runtime.h"
#include <stdlib.h>
#include <string.h>
#include <sys/syscall.h>
#include <unistd.h>

/* Ruby's nominal class registry is intentionally shared across compatible
   components; its temporary delivery tokens are not. Remember every token,
   including output and callback tokens created inside the compiled adapter.
   Reopening a binding does not revive even a token saved before shutdown. */
typedef struct issued {
    struct issued *next;
    const char *kind; /* generated string literal with static lifetime */
    uint64_t h[2];
} issued;
static issued *buckets[257];
static int active;
static int owner(void) {
    return getpid()==(pid_t)syscall(SYS_gettid) && lean_bridge_native_process_valid();
}
static issued **lookup(const char *kind,const uint64_t h[2]) {
    if (!owner() || !active || !kind || !h || !h[0]) return NULL;
    issued **p=&buckets[h[0]%257u];
    while (*p && (*p)->h[0]!=h[0]) p=&(*p)->next;
    return *p && (*p)->h[1]==h[1] && !strcmp((*p)->kind,kind) ? p : NULL;
}
void lb_ruby_worker_begin(void) { active=1; }
void lb_ruby_worker_end(void) {
    active=0;
    for (unsigned i=0;i<257;i++) while (buckets[i]) {
        issued *row=buckets[i]; buckets[i]=row->next;
        LB_LEASE(release)(row->kind,row->h); free(row);
    }
}
int lb_ruby_worker_create(const char *kind,lean_object *v,uint64_t h[2]) {
    if (!owner() || !active) return LB_LEASE_CLOSED;
    issued *row=malloc(sizeof(*row)); if (!row) return LB_LEASE_MEMORY;
    int rc=LB_LEASE(create)(kind,v,h);
    if (rc!=LB_LEASE_OK) { free(row); return rc; }
    issued **p=&buckets[h[0]%257u];
    *row=(issued){.next=*p,.kind=kind,.h={h[0],h[1]}}; *p=row;
    return LB_LEASE_OK;
}
lean_object *lb_ruby_worker_borrow(const char *kind,const uint64_t h[2]) {
    return lookup(kind,h) ? LB_LEASE(borrow)(kind,h) : NULL;
}
int lb_ruby_worker_release(const char *kind,uint64_t h[2]) {
    issued **p=lookup(kind,h); if (!p) return LB_LEASE_CLOSED;
    int rc=LB_LEASE(release)(kind,h);
    if (rc==LB_LEASE_OK) { issued *row=*p; *p=row->next; free(row); }
    return rc;
}
