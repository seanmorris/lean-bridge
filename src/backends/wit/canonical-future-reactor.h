/* Private Linux/Wasmtime embedding for generated canonical future producers.
 * One reactor per producer instance. The embedding owns the store and calls
 * advance only between Wasmtime calls, never from one of its imported hooks. */
#ifndef LEAN_BRIDGE_WIT_CANONICAL_FUTURE_REACTOR_H
#define LEAN_BRIDGE_WIT_CANONICAL_FUTURE_REACTOR_H
#include <errno.h>
#include <poll.h>
#include <stdint.h>
#include <wasmtime/component.h>

typedef enum { LB_CF_FREE, LB_CF_RESERVED, LB_CF_NATIVE, LB_CF_WRITER, LB_CF_STREAM } lb_cf_phase;
typedef bool (*lb_cf_take_fn)(void *, wasmtime_component_val_t *);
typedef void (*lb_cf_close_fn)(void *);
typedef struct {
    lb_cf_phase phase;
    int fd;
    bool requested, wait_native;
    void *owner;
    lb_cf_take_fn take;
    lb_cf_close_fn close;
} lb_cf_row;
typedef struct {
    /* The embedding supplies zeroed rows and equally many poll slots, once.
     * Capacity must equal the slot count used to generate the Wasm producer. */
    lb_cf_row *rows;
    struct pollfd *fds;
    unsigned capacity;
    wasmtime_context_t *ctx;
    wasmtime_component_func_t deliver, reap, pump;
    wasmtime_component_val_t stream_value;
    bool poisoned, pull_payload;
    unsigned staged_key;
    wasmtime_component_val_t *staged;
} lb_cf_reactor;

static inline unsigned lb_cf_reserve(lb_cf_reactor *r) {
    if (r->poisoned || r->capacity > 1024) return 0;
    for (unsigned key = r->capacity; key; --key) {
        lb_cf_row *row = &r->rows[key-1];
        if (row->phase != LB_CF_FREE) continue;
        *row = (lb_cf_row){.phase=LB_CF_RESERVED, .fd=-1}; return key;
    }
    return 0;
}
static inline bool lb_cf_arm(lb_cf_reactor *r, unsigned key, int fd, void *owner, lb_cf_take_fn take, lb_cf_close_fn close) {
    if (!key || key>r->capacity || fd< -1 || !take || !close || r->rows[key-1].phase!=LB_CF_RESERVED) return false;
    r->rows[key-1]=(lb_cf_row){.phase=LB_CF_NATIVE, .fd=fd, .owner=owner, .take=take, .close=close}; return true;
}
/* Native ownership transfers to the embedding's take callback only on success.
 * Writer rows retain canonical memory, not native owners. Destroy the Wasmtime
 * store after shutdown to release its still-pending component operations. */
static inline void lb_cf_shutdown(lb_cf_reactor *r) {
    r->poisoned=true;
    for (unsigned i=0; i<r->capacity; ++i) {
        lb_cf_row row=r->rows[i]; r->rows[i]=(lb_cf_row){0};
        if (row.phase==LB_CF_NATIVE || (row.phase==LB_CF_STREAM && row.owner)) row.close(row.owner);
    }
}
static inline wasmtime_error_t *lb_cf_fail(lb_cf_reactor *r, const char *reason) {
    r->poisoned=true; return wasmtime_error_new(reason);
}
/* Drain guest notifications before blocking on native descriptors. */
static inline wasmtime_error_t *lb_cf_reap(lb_cf_reactor *r) {
    if (r->poisoned || !r->capacity || r->capacity>1024) return lb_cf_fail(r,"invalid canonical future reactor");
    unsigned active=0;
    for (unsigned i=0;i<r->capacity;++i) active+=r->rows[i].phase==LB_CF_NATIVE || r->rows[i].phase==LB_CF_WRITER;
    if (!active) return NULL;
    for (;;) {
        wasmtime_component_val_t v={0};
        wasmtime_error_t *err=wasmtime_component_func_call(&r->reap,r->ctx,NULL,0,&v,1);
        if (err) {r->poisoned=true; return err;}
        if (v.kind!=WASMTIME_COMPONENT_U32 || v.of.u32>r->capacity) return lb_cf_fail(r,"invalid canonical writer acknowledgement");
        if (!v.of.u32) break;
        lb_cf_row *row=&r->rows[v.of.u32-1];
        /* A reader can disappear before the native task signals its fd.
         * Release that owner without taking its result. A blocked writer, in
         * contrast, has already consumed the native owner. */
        lb_cf_row old=*row;
        if (old.phase!=LB_CF_NATIVE && old.phase!=LB_CF_WRITER)
            return lb_cf_fail(r,"canonical writer acknowledgement has no owner");
        *row=(lb_cf_row){0};
        if (old.phase==LB_CF_NATIVE) old.close(old.owner);
    }
    return NULL;
}
/* Return at timeout or after processing the currently ready fds. Zero timeout
 * integrates with a host event loop; a negative timeout waits for native work.
 * No native handle is probed repeatedly, and an empty set never sleeps. */
static inline wasmtime_error_t *lb_cf_advance(lb_cf_reactor *r, int timeout) {
    wasmtime_error_t *reap_error=lb_cf_reap(r); if (reap_error) return reap_error;
    unsigned live=0; bool immediate=false;
    for (unsigned i=0; i<r->capacity; ++i) {
        const lb_cf_row *row=&r->rows[i]; live+=row->phase==LB_CF_NATIVE;
        immediate |= row->phase==LB_CF_NATIVE && row->fd<0;
        r->fds[i]=(struct pollfd){row->phase==LB_CF_NATIVE ? row->fd : -1,POLLIN,0};
    }
    if (!live) return NULL;
    int count=poll(r->fds,r->capacity,immediate ? 0 : timeout);
    if (count<0 && errno==EINTR) return NULL; /* outer loop owns the deadline */
    if (count<0) return lb_cf_fail(r,"poll failed on native future descriptors");
    for (unsigned i=0; i<r->capacity; ++i) {
        lb_cf_row *row=&r->rows[i];
        if (row->phase!=LB_CF_NATIVE || (row->fd>=0 && !r->fds[i].revents)) continue;
        if (row->fd>=0 && !(r->fds[i].revents&POLLIN)) return lb_cf_fail(r,"invalid native future descriptor notification");
        wasmtime_component_val_t args[2]={{.kind=WASMTIME_COMPONENT_U32,.of.u32=i+1},{0}}, result={0};
        if (!row->take(row->owner,&args[1])) return lb_cf_fail(r,"could not take notified native future");
        /* take consumed the token. Never call its close if delivery now traps. */
        *row=(lb_cf_row){.phase=LB_CF_WRITER,.fd=-1};
        r->staged=r->pull_payload ? &args[1] : NULL; r->staged_key=i+1;
        wasmtime_error_t *err=wasmtime_component_func_call(&r->deliver,r->ctx,args,r->pull_payload?1:2,&result,1);
        bool missed=r->staged!=NULL; r->staged=NULL; r->staged_key=0;
        wasmtime_component_val_delete(&args[1]);
        if (err) {r->poisoned=true; return err;}
        if (missed) return lb_cf_fail(r,"writer did not claim its payload");
        if (result.kind!=WASMTIME_COMPONENT_U32 || result.of.u32>2) return lb_cf_fail(r,"invalid canonical future write result");
        if (result.of.u32!=2) *row=(lb_cf_row){0};
    }
    return NULL;
}
#endif
