/* A callback and a task can outlive the last public owner of a foreign Ticket. */
#define _POSIX_C_SOURCE 200809L
#include <depot_wasmtime.h>
#include <peer_wasmtime.h>
#include <assert.h>
#include <dlfcn.h>
#include <stdio.h>
#include <time.h>
#include <unistd.h>
#include "lean_bridge_native_runtime.h"
#define D(n) depot_wit_##n
#define P(n) peer_wit_##n
#define DEPOT(e) assert((e)==D(OK))
#define PEER(e) assert((e)==P(OK))
typedef P(callback_uint32_to_uint32) callback;
static D(session) *depot;
static P(session) *peer;
static void (*snapshot)(lean_bridge_native_snapshot *);
static void expect_live(unsigned target) {
    lean_bridge_native_snapshot obs={0};
    for (unsigned i=0;i<500;i++) {
        snapshot(&obs); assert(obs.runtime_init_runs==1);
        if (obs.live_identities==target) return;
        nanosleep(&(struct timespec){.tv_nsec=10000000},NULL);
    }
    fprintf(stderr,"expected %u broker identities, observed %u\n",target,obs.live_identities);
    assert(obs.live_identities==target);
}
static D(lease_ticket) issue(uint32_t n) {
    D(lease_ticket) t={0}; D(task_issue) h={0}; D(state) state; D(string) error={0};
    DEPOT(D(start_issue)(depot,n,&h,&error)); DEPOT(D(await_issue)(depot,h,&state,&t));
    assert(state==D(READY)); DEPOT(D(drop_issue)(depot,&h)); return t;
}
static uint32_t view(D(lease_ticket) ticket) {
    D(task_view) h={0}; D(state) state; uint32_t n=0;
    DEPOT(D(start_view)(depot,ticket,&h)); DEPOT(D(await_view)(depot,h,&state,&n));
    assert(state==D(READY)); DEPOT(D(drop_view)(depot,&h)); return n;
}
enum operation { RETURN, REVOKE, CANCEL, CLOSE };
typedef struct {
    enum operation mode; callback owner; P(task_drive) task; D(lease_ticket) ticket;
    unsigned calls,destructors; bool inside;
} observer;
static void done(void *data) {
    observer *o=data; assert(!o->inside && !o->destructors); ++o->destructors;
}
static bool invoke(void *data,uint32_t n,uint32_t *reply,P(text) *error) {
    observer *o=data; (void)error; assert(!o->inside && !o->destructors);
    o->inside=true; ++o->calls;
    if (o->calls==1) {
        assert(n==11 && view(o->ticket)==11); /* Re-enter the other store on the same object. */
        if (o->mode==REVOKE) PEER(P(revoke_callback_uint32_to_uint32)(peer,&o->owner));
        /* This is the final public Ticket owner on the success path. */
        DEPOT(D(drop_lease_ticket)(&o->ticket));
        if (o->mode==CANCEL) {
            bool accepted=false; PEER(P(cancel_drive)(peer,o->task,&accepted)); assert(accepted);
        } else if (o->mode==CLOSE) PEER(P(close)(&peer));
    } else assert(o->calls==2 && o->mode==RETURN && n==42);
    *reply=n+31; assert(!o->destructors); o->inside=false; return true;
}
static void observe(enum operation mode) {
    observer o={.mode=mode,.ticket=issue(11)};
    D(lease_ticket) anchor={0},out={0}; P(drive_errors) errors={0}; P(state) state=P(PENDING);
    if (mode!=RETURN) DEPOT(D(retain_lease_ticket)(o.ticket,&anchor));
    PEER(P(make_callback_uint32_to_uint32)(peer,invoke,&o,done,&o.owner));
    PEER(P(start_drive)(peer,o.owner,o.ticket,true,&o.task));
    if (mode!=REVOKE) PEER(P(drop_callback_uint32_to_uint32)(peer,&o.owner));
    P(status) rc=P(await_drive)(peer,o.task,&state,&out,&errors);
    assert(o.destructors==1 && o.calls==(mode==RETURN?2u:1u));
    if (mode==RETURN) {
        PEER(rc); assert(state==P(READY) && view(out)==73); DEPOT(D(drop_lease_ticket)(&out));
    } else if (mode==REVOKE) {
        PEER(rc); assert(state==P(WORKER_CALLBACK_FAILED) && errors.callback.size==26);
        assert(!memcmp(errors.callback.data,"retained callback is closed",26));
        assert(view(anchor)==42); /* First mutation committed; revoked second call did not run. */
    } else if (mode==CANCEL) {
        PEER(rc); assert(state==P(CANCELLED) && view(anchor)==11);
        PEER(P(await_drive)(peer,o.task,&state,&out,&errors)); assert(state==P(CLOSED));
    } else {
        assert(!peer && rc==P(UNAVAILABLE) && state==P(PENDING) && view(anchor)==11);
    }
    if (mode!=RETURN) {
        assert(P(drop_lease_ticket)(&out)==P(STALE));
        PEER(P(drop_lease_ticket)(&anchor));
    }
    if (peer) PEER(P(drop_drive)(peer,&o.task));
    P(drive_errors_dispose)(&errors); expect_live(peer?2:1); /* still-open stores only */
}
static void typed_failure(void) {
    observer o={.ticket=issue(11)}; D(lease_ticket) anchor={0}; DEPOT(D(retain_lease_ticket)(o.ticket,&anchor));
    PEER(P(make_callback_uint32_to_uint32)(peer,invoke,&o,done,&o.owner));
    P(task_inspect) task={0}; P(inspect_errors) errors={0}; P(state) state=P(PENDING); uint32_t out=71;
    PEER(P(start_inspect)(peer,true,o.ticket,o.owner,&task));
    DEPOT(D(drop_lease_ticket)(&o.ticket)); PEER(P(drop_callback_uint32_to_uint32)(peer,&o.owner));
    PEER(P(await_inspect)(peer,task,&state,&out,&errors));
    bool same=false; DEPOT(D(same_lease_ticket)(anchor,errors.factory,&same));
    assert(state==P(FACTORY_FAILED) && same && out==71 && o.calls==0 && o.destructors==1);
    DEPOT(D(drop_lease_ticket)(&anchor)); PEER(P(drop_inspect)(peer,&task));
    assert(view(errors.factory)==11); P(inspect_errors_dispose)(&errors); P(inspect_errors_dispose)(&errors);
    expect_live(2);
}
static void rollback(void) {
    observer o={.ticket=issue(7)}; D(lease_ticket) stale=o.ticket; DEPOT(D(drop_lease_ticket)(&o.ticket));
    for (unsigned i=0;i<260;i++) {
        o.destructors=0; PEER(P(make_callback_uint32_to_uint32)(peer,invoke,&o,done,&o.owner));
        assert(P(start_drive)(peer,o.owner,stale,true,&o.task)==P(STALE));
        PEER(P(drop_callback_uint32_to_uint32)(peer,&o.owner)); assert(o.destructors==1 && !o.calls);
    }
    expect_live(2);
}
int main(void) {
    alarm(120); snapshot=dlsym(RTLD_DEFAULT,"lean_bridge_native_snapshot_read"); assert(snapshot);
    DEPOT(D(open)(&depot)); PEER(P(open)(&peer));
    observe(RETURN); observe(REVOKE); typed_failure(); rollback(); observe(CANCEL); observe(CLOSE);
    DEPOT(D(close)(&depot)); expect_live(0);
    puts("Independent WIT packages: retained callback, Ticket borrow, mutation, EIO, revocation, cancellation and shutdown passed");
}
