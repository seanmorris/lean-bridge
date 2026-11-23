/* Use one store for the call and another to observe the Lean worker after its
 * caller cancels or closes. The broker is inspected only by the test probe. */
#define _POSIX_C_SOURCE 200809L
#include <depot_wasmtime.h>
#include "lean_bridge_native_runtime.h"
#include <assert.h>
#include <dlfcn.h>
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#define D(n) depot_wit_##n
#define OK(expr) assert((expr)==D(OK))
static D(lease_ticket) issue(D(session) *s,uint32_t n) {
    D(lease_ticket) out={0}; D(string) error={0}; D(task_issue) h={0}; D(state) state;
    OK(D(start_issue)(s,n,&h,&error)); OK(D(await_issue)(s,h,&state,&out));
    assert(state==D(READY)); OK(D(drop_issue)(s,&h)); return out;
}
static uint32_t live(void) {
    void (*read_snapshot)(lean_bridge_native_snapshot *)=dlsym(RTLD_DEFAULT,"lean_bridge_native_snapshot_read");
    assert(read_snapshot); lean_bridge_native_snapshot snap={0};
    read_snapshot(&snap); assert(snap.runtime_init_runs==1); return snap.live_identities;
}
static void expect_clean(void) {
    for (unsigned i=0;i<500;i++) {
        if (!live()) return;
        nanosleep(&(struct timespec){.tv_nsec=10000000},NULL);
    }
    fprintf(stderr,"Outstanding broker identities: %u\n",live()); assert(!live());
}
enum race { DELIVER, CANCEL, SHUT_STORE };
static void parked(enum race mode) {
    D(session) *s=NULL,*gate=NULL; OK(D(open)(&s)); OK(D(open)(&gate));
    D(lease_ticket) input=issue(s,11),out={0}; D(task_parked) job={0}; D(state) state=D(CLOSED);
    OK(D(start_parked)(s,input,&job)); OK(D(drop_lease_ticket)(&input));
    int fd=-1,repeated=-1;
    OK(D(poll_parked)(s,job,&state,&out,&fd)); assert(state==D(PENDING) && fd>=0);
    OK(D(poll_parked)(s,job,&state,&out,&repeated)); assert(state==D(PENDING) && repeated==fd);
    assert(D(drop_lease_ticket)(&out)==D(STALE)); /* PENDING published no owner. */
    if (mode==CANCEL) {
        bool won=false; OK(D(cancel_parked)(s,job,&won)); assert(won);
        OK(D(cancel_parked)(s,job,&won)); assert(!won);
        OK(D(await_parked)(s,job,&state,&out)); assert(state==D(CANCELLED));
        OK(D(await_parked)(s,job,&state,&out)); assert(state==D(CLOSED));
        assert(D(drop_lease_ticket)(&out)==D(STALE)); OK(D(drop_parked)(s,&job));
    } else if (mode==SHUT_STORE) {
        OK(D(close)(&s));
        assert(D(poll_parked)(gate,job,&state,&out,&repeated)==D(STALE));
    }
    if (mode!=DELIVER) { errno=0; assert(fcntl(fd,F_GETFD)==-1 && errno==EBADF); }
    D(task_unlock) wake={0}; bool woke=false; OK(D(start_unlock)(gate,31,&wake));
    OK(D(await_unlock)(gate,wake,&state,&woke)); assert(state==D(READY) && woke); OK(D(drop_unlock)(gate,&wake));
    D(task_witness) check={0}; uint32_t count=0; OK(D(start_witness)(gate,&check));
    OK(D(await_witness)(gate,check,&state,&count)); assert(state==D(READY) && count==42); OK(D(drop_witness)(gate,&check));
    if (mode==DELIVER) {
        OK(D(await_parked)(s,job,&state,&out)); assert(state==D(READY));
        D(lease_ticket) second={0}; OK(D(await_parked)(s,job,&state,&second)); assert(state==D(CLOSED));
        assert(D(drop_lease_ticket)(&second)==D(STALE)); OK(D(drop_parked)(s,&job)); OK(D(close)(&s));
        D(task_view) view={0}; count=0; OK(D(start_view)(gate,out,&view)); OK(D(drop_lease_ticket)(&out));
        OK(D(await_view)(gate,view,&state,&count)); assert(state==D(READY) && count==42); OK(D(drop_view)(gate,&view));
    }
    if (s) OK(D(close)(&s));
    OK(D(close)(&gate)); expect_clean();
}
static void capacity(void) {
    D(session) *s=NULL; OK(D(open)(&s)); D(lease_ticket) input=issue(s,7),result={0};
    D(task_issue) h[256]={0}; D(string) err={0}; D(state) state; size_t i=0;
    for (;i<256;i++) {
        D(status) rc=D(start_issue)(s,1,&h[i],&err);
        if (rc==D(LIMIT)) break;
        OK(rc);
    }
    assert(i==255); /* The remaining slot is reserved for delivery. */
    OK(D(await_issue)(s,h[--i],&state,&result)); assert(state==D(READY));
    OK(D(drop_issue)(s,&h[i])); OK(D(drop_lease_ticket)(&result));
    D(task_view) borrow={0}; assert(D(start_view)(s,input,&borrow)==D(LIMIT));
    OK(D(drop_issue)(s,&h[--i])); OK(D(start_view)(s,input,&borrow));
    uint32_t value=0; OK(D(await_view)(s,borrow,&state,&value)); assert(state==D(READY) && value==7);
    OK(D(drop_view)(s,&borrow)); while (i) { OK(D(drop_issue)(s,&h[--i])); }
    OK(D(drop_lease_ticket)(&input)); OK(D(close)(&s)); expect_clean();
}
static void multiple_borrows(bool rejected_inputs) {
    D(session) *s=NULL; OK(D(open)(&s)); D(lease_ticket) a=issue(s,21),b=issue(s,9),stale=b;
    OK(D(drop_lease_ticket)(&b)); D(task_combined) h={0}; uint32_t value=0; D(state) state;
    /* Preparing the first argument succeeds; the stale second one must roll it
     * back every time. A leak would exhaust the 256-slot store. */
    const uint32_t baseline=live(); assert(baseline==2); /* session + the one externally owned Ticket */
    for (unsigned i=0;i<260;i++) {
        if (rejected_inputs) {
            D(status) rejected=D(start_combined)(s,a,stale,&h);
            if (rejected!=D(STALE)) fprintf(stderr,"Rollback #%u returned %d, expected STALE (%d)\n",i,rejected,D(STALE));
            assert(rejected==D(STALE));
        } else {
            OK(D(start_combined)(s,a,a,&h)); OK(D(await_combined)(s,h,&state,&value));
            assert(state==D(READY) && value==42); OK(D(drop_combined)(s,&h));
        }
        uint32_t after=live();
        if (after!=baseline) fprintf(stderr,"%s borrow #%u: %u live identities, expected %u\n",
            rejected_inputs?"Rejected":"Successful",i,after,baseline);
        assert(after==baseline);
    }
    OK(D(start_combined)(s,a,a,&h)); OK(D(drop_lease_ticket)(&a));
    OK(D(await_combined)(s,h,&state,&value)); assert(state==D(READY) && value==42);
    OK(D(drop_combined)(s,&h)); OK(D(close)(&s)); expect_clean();
}
int main(int argc,char **argv) {
    alarm(90);
    if (argc==2 && !strcmp(argv[1],"--successful")) { multiple_borrows(false); return 0; }
    parked(DELIVER); parked(CANCEL); parked(SHUT_STORE); capacity(); multiple_borrows(true); multiple_borrows(false);
    puts("Installed WIT leases: parked delivery, cancellation, late work, store close, capacity and borrow rollback passed");
}
