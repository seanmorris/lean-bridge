/* Shared by independently compiled components with the same runtime/ledger ABI.
   Only the process main thread may access the table. Lean workers own normal
   Lean references, never table entries. Distinct leases of the same value can
   be disposed independently; copying the bits of one lease does not clone it. */
#include "task-resource-ledger.h"
#include "lean_bridge_native_runtime.h"
#include <stdlib.h>
#include <string.h>
#include <sys/syscall.h>
#include <unistd.h>
typedef struct lease {
    struct lease *next;
    uint64_t key;
    char kind[65];
    lean_object *value;
} lease;
static lease *buckets[257];
static uint64_t domain;
static int owner(void) {
    return getpid() == (pid_t)syscall(SYS_gettid) && lean_bridge_native_process_valid();
}
static lease **find(const char *kind, const uint64_t h[2]) {
    if (!owner() || !h || !h[0] || h[1] != domain) return NULL;
    lease **p = &buckets[h[0] % 257u];
    while (*p && (*p)->key != h[0]) p = &(*p)->next;
    return *p && !strcmp((*p)->kind, kind) ? p : NULL;
}
int LB_LEASE(create)(const char *kind, lean_object *v, uint64_t out[2]) {
    if (!owner() || !v || lean_is_scalar(v) || strlen(kind) != 64 || out[0] || out[1]) return LB_LEASE_CLOSED;
    lease *l = malloc(sizeof *l);
    if (!l) return LB_LEASE_MEMORY;
    if (!domain) {
        lean_bridge_native_snapshot s; lean_bridge_native_snapshot_read(&s); domain = s.identity_domain_id;
    }
    l->key = lean_bridge_native_identity_acquire("lean-bridge/task-resource-lease-v1", l);
    if (!l->key) { free(l); return LB_LEASE_UNAVAILABLE; }
    memcpy(l->kind, kind, 65); lean_inc(v); l->value = v;
    lease **p = &buckets[l->key % 257u]; l->next = *p; *p = l;
    out[0] = l->key; out[1] = domain; return LB_LEASE_OK;
}
lean_object *LB_LEASE(borrow)(const char *kind, const uint64_t h[2]) {
    lease **p = find(kind, h); return p ? (*p)->value : NULL;
}
int LB_LEASE(release)(const char *kind, uint64_t h[2]) {
    lease **p = find(kind, h);
    if (!p) return LB_LEASE_CLOSED;
    lease *l = *p; *p = l->next; h[0] = h[1] = 0;
    lean_bridge_native_identity_release(l->key, "lean-bridge/task-resource-lease-v1", l);
    lean_dec(l->value); free(l); return LB_LEASE_OK;
}
