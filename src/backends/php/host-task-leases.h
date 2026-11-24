/* Native PHP owner only. A worker receives a Lean external object; it never
   sees a Zend object, an FFI callback, or a reference-table entry. */
#include "task-resource-ledger.h"
enum { PHP_HOST_PIN=-3, PHP_HOST_RESOLVE=-4, PHP_HOST_ADMIT=-5, PHP_HOST_SWEEP=-6 };
static int php_host_lease(lb_dn_frame *f, lb_dnd_session *s, int op, const uint64_t *a,
                          size_t n, uint64_t *out) {
    if (!a || n!=2 || a[0]>=sizeof(specs)/sizeof(specs[0]) || a[1] || a[2] || a[5]) return 5;
    unsigned kind=(unsigned)a[0];
    const char *key=specs[kind].key;
    if (op==PHP_HOST_PIN) {
        if (!a[3] || a[4]) return 5;
        uint64_t *h=calloc(2,sizeof(*h));
        if (!h) return 11;
        lean_object *v=LB_DND(wrap)(f,s,kind,a[3],0);
        if (!v) { free(h); return f->fatal ? 10 : 5; }
        lean_mark_mt(v);
        int rc=LB_LEASE(create)(key,v,h);
        lean_dec(v);
        if (rc!=LB_LEASE_OK) { free(h); return rc==LB_LEASE_MEMORY ? 11 : rc==LB_LEASE_UNAVAILABLE ? 10 : 6; }
        /* Ordinary HostFrame copies and frees the 16 bytes. The caller owns the lease. */
        out[0]=(uintptr_t)h; out[1]=2*sizeof(*h); out[3]=1; return 0;
    }
    if (!a[3] || a[4]!=2*sizeof(uint64_t)) return 5;
    uint64_t h[2]; memcpy(h,(const void *)(uintptr_t)a[3],sizeof(h));
    lean_object *v=LB_LEASE(borrow)(key,h);
    if (!v || !LB_DND(object)(s,kind,v)) return 6;
    if (op==PHP_HOST_ADMIT) {
        /* Commit only after the start/reply has accepted every input. */
        LB_DND(admit)(v);
        return 0;
    }
    if (op!=PHP_HOST_RESOLVE) return 5;
    out[0]=LB_DND(export)(f,s,kind,v);
    return out[0] ? 0 : f->fatal ? 10 : 6;
}
