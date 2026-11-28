#define LBP_WORKER_BROKER_IMPL 1
#include "worker-ledger.h"
#include "lean_bridge_native_runtime.h"
#include <stdlib.h>
#include <string.h>
#include <sys/syscall.h>
#include <unistd.h>

/* Every with_hosts invocation has its own lifetime. A scope may exchange
   original objects with another distribution, never the capability to
   borrow or release that distribution's temporary native leases. */
typedef struct issued {
    struct issued *next;
    char kind[65];
    uint64_t token[2];
} issued;
static issued *buckets[257];
static int active;
static int owner(void) {
    return getpid()==(pid_t)syscall(SYS_gettid) && lean_bridge_native_process_valid();
}
static issued **lookup(const char *kind,const uint64_t h[2]) {
    if (!active || !owner() || !kind || !h || !h[0]) return NULL;
    issued **p=&buckets[h[0]%257u];
    while (*p && (*p)->token[0]!=h[0]) p=&(*p)->next;
    return *p && (*p)->token[1]==h[1] && strcmp((*p)->kind,kind)==0 ? p : NULL;
}
int LBP_WORKER(begin)(void) {
    if (!owner() || active) return LB_LEASE_CLOSED;
    active=1;
    return LB_LEASE_OK;
}
int LBP_WORKER(end)(void) {
    if (!owner() || !active) return LB_LEASE_CLOSED;
    active=0;
    int result=LB_LEASE_OK;
    for (size_t i=0;i<257;++i) while (buckets[i]) {
        issued *row=buckets[i]; buckets[i]=row->next;
        int rc=LB_LEASE(release)(row->kind,row->token);
        if (rc!=LB_LEASE_OK) result=rc;
        free(row);
    }
    return result;
}
int LBP_WORKER(create)(const char *kind,lean_object *v,uint64_t h[2]) {
    if (!owner() || !active || !kind || strlen(kind)!=64 || !h || h[0] || h[1]) return LB_LEASE_CLOSED;
    issued *row=malloc(sizeof(*row));
    if (!row) return LB_LEASE_MEMORY;
    memcpy(row->kind,kind,sizeof(row->kind));
    int rc=LB_LEASE(create)(row->kind,v,h);
    if (rc!=LB_LEASE_OK) { free(row); return rc; }
    memcpy(row->token,h,sizeof(row->token));
    issued **p=&buckets[h[0]%257u]; row->next=*p; *p=row;
    return LB_LEASE_OK;
}
lean_object *LBP_WORKER(borrow)(const char *kind,const uint64_t h[2]) {
    return lookup(kind,h) ? LB_LEASE(borrow)(kind,h) : NULL;
}
int LBP_WORKER(release)(const char *kind,uint64_t h[2]) {
    issued **p=lookup(kind,h);
    if (!p) return LB_LEASE_CLOSED;
    int rc=LB_LEASE(release)(kind,h);
    if (rc==LB_LEASE_OK) { issued *row=*p; *p=row->next; free(row); }
    return rc;
}
