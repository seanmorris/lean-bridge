/* Ordinary consumer API. Both packages compiled Shared.Ticket independently. */
#include <depot_wasmtime.h>
#include <peer_wasmtime.h>
#include <assert.h>
#include <stdio.h>
#include <unistd.h>
#ifdef CHECK_LEDGER
#include <dlfcn.h>
#include "lean_bridge_native_runtime.h"
#endif
#define D(n) depot_wit_##n
#define P(n) peer_wit_##n
#define DEPOT(expr) assert((expr)==D(OK))
#define PEER(expr) assert((expr)==P(OK))
static bool same(D(lease_ticket) a,P(lease_ticket) b) {
    bool yes=false; PEER(P(same_lease_ticket)(a,b,&yes)); return yes;
}
int main(void) {
    alarm(60); D(session) *d=NULL; P(session) *p=NULL; DEPOT(D(open)(&d)); PEER(P(open)(&p));
    D(task_issue) issue={0}; D(lease_ticket) ticket={0},anchor={0}; D(string) io={0}; D(state) ds;
    DEPOT(D(start_issue)(d,11,&issue,&io)); DEPOT(D(await_issue)(d,issue,&ds,&ticket));
    assert(ds==D(READY)); DEPOT(D(drop_issue)(d,&issue)); PEER(P(retain_lease_ticket)(ticket,&anchor));
    assert(same(ticket,anchor));
    P(task_bump) bump={0}; P(lease_ticket) updated={0}; P(string) pio={0}; P(state) ps;
    PEER(P(start_bump)(p,ticket,31,&bump,&pio)); P(lease_ticket) stale=ticket;
    DEPOT(D(drop_lease_ticket)(&ticket)); PEER(P(await_bump)(p,bump,&ps,&updated));
    assert(ps==P(READY) && same(updated,anchor)); PEER(P(drop_bump)(p,&bump));
    assert(P(start_bump)(p,stale,1,&bump,&pio)==P(STALE));
    D(task_view) view={0}; uint32_t count=0;
    DEPOT(D(start_view)(d,updated,&view)); DEPOT(D(await_view)(d,view,&ds,&count));
    assert(ds==D(READY) && count==42); DEPOT(D(drop_view)(d,&view));
    /* Adversarial probe: even a caller bypassing the C type cannot supply a Badge. */
    D(task_tag) tag={0}; D(lease_badge) badge={0}; D(lease_ticket) wrong={0};
    DEPOT(D(start_tag)(d,42,&tag,&io)); DEPOT(D(await_tag)(d,tag,&ds,&badge));
    assert(ds==D(READY)); DEPOT(D(drop_tag)(d,&tag));
    _Static_assert(sizeof wrong==sizeof badge,"fault probe width"); memcpy(&wrong,&badge,sizeof wrong);
    assert(P(start_bump)(p,wrong,1,&bump,&pio)==P(STALE)); DEPOT(D(drop_lease_badge)(&badge));
    D(task_checked) check={0}; D(lease_ticket) failed={0},ok={0};
    assert(D(start_checked)(d,true,updated,&check,&failed)==D(START_ERROR) && same(failed,anchor));
    DEPOT(D(drop_lease_ticket)(&failed)); DEPOT(D(start_checked)(d,false,updated,&check,&failed));
    DEPOT(D(await_checked)(d,check,&ds,&ok)); assert(ds==D(READY) && same(ok,anchor));
    DEPOT(D(drop_checked)(d,&check)); DEPOT(D(drop_lease_ticket)(&ok));
    D(cursor_stream) cursor={0}; D(lease_ticket) item={0},error={0};
    DEPOT(D(open_stream)(d,updated,true,&cursor,&io)); PEER(P(drop_lease_ticket)(&updated));
    DEPOT(D(next_stream)(d,cursor,&ds,&item,&error)); assert(ds==D(ITEM) && same(item,anchor));
    DEPOT(D(next_stream)(d,cursor,&ds,&ok,&error)); assert(ds==D(FAILED) && same(item,error));
    DEPOT(D(drop_stream)(d,&cursor)); DEPOT(D(close)(&d)); PEER(P(close)(&p));
    /* Owners outlive both stores. Either package can compare or release them. */
    assert(same(error,anchor)); PEER(P(drop_lease_ticket)(&error)); DEPOT(D(drop_lease_ticket)(&item));
    PEER(P(drop_lease_ticket)(&anchor)); assert(P(drop_lease_ticket)(&stale)==P(STALE));
#ifdef CHECK_LEDGER
    void (*read_snapshot)(lean_bridge_native_snapshot *)=dlsym(RTLD_DEFAULT,"lean_bridge_native_snapshot_read");
    assert(read_snapshot); lean_bridge_native_snapshot snap={0}; read_snapshot(&snap);
    assert(snap.runtime_init_runs==1 && snap.live_identities==0);
#endif
    puts("Independent WIT packages: Ticket identity, mutation, failures, cursor and disposal passed");
}
