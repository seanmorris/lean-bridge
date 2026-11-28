/* Fault injection only: normal applications do not access the runtime broker. */
#define _POSIX_C_SOURCE 200809L
#include <meter_wasmtime.h>
#include <assert.h>
#include <dlfcn.h>
#include <errno.h>
#include <fcntl.h>
#include <pthread.h>
#include <stdio.h>
#include <time.h>
#include <unistd.h>
#ifdef TEST_LEDGER
#include "lean_bridge_native_runtime.h"
static uint32_t live(void) {
    void (*read_snapshot)(lean_bridge_native_snapshot *)=dlsym(RTLD_DEFAULT,"lean_bridge_native_snapshot_read");
    assert(read_snapshot); lean_bridge_native_snapshot snapshot={0}; read_snapshot(&snapshot);
    assert(snapshot.abi_version==LEAN_BRIDGE_NATIVE_RUNTIME_ABI_VERSION);
    return snapshot.live_identities;
}
static void expect_live(uint32_t expected) {
    uint32_t seen=live();
    if (seen!=expected) fprintf(stderr,"Expected %u live identities; saw %u\n",expected,seen);
    assert(seen==expected);
}
#endif
static void *retire(void *unused) {
    (void)unused; struct timespec delay={.tv_nsec=50000000};
    while (nanosleep(&delay,&delay)<0 && errno==EINTR) {}
    void (*stop)(void)=(void (*)(void))dlsym(RTLD_DEFAULT,"lean_bridge_native_runtime_retire");
    assert(stop); stop(); return NULL;
}
static void check(bool poison) {
    meter_wit_session *s=NULL;
    meter_wit_state state=meter_wit_CLOSED; int fd=-1;
#ifdef TEST_LEDGER
    expect_live(0);
#endif
    assert(meter_wit_open(&s)==meter_wit_OK);
#ifdef TEST_CURSOR
    meter_wit_cursor_feed h={0}; meter_wit_feed_value value={.ok=true,.value=9};
    uint32_t start=17; uint16_t failure=82;
    assert(meter_wit_open_feed(s,3,1,&h,&start)==meter_wit_OK && start==17);
    assert(meter_wit_request_feed(s,h)==meter_wit_OK);
    assert(meter_wit_poll_feed(s,h,&state,&value,&failure,&fd)==meter_wit_OK && state==meter_wit_PENDING && fd>=0);
#else
    meter_wit_task_parked h={0}; int64_t value=9;
    assert(meter_wit_start_parked(s,4,&h)==meter_wit_OK);
    assert(meter_wit_poll_parked(s,h,&state,&value,&fd)==meter_wit_OK && state==meter_wit_PENDING && fd>=0);
#endif
#ifdef TEST_LEDGER
    expect_live(3); /* Session, parked native owner and its Lean worker notification. */
#endif
    if (!poison) {
#ifdef TEST_CURSOR
        assert(meter_wit_drop_feed(s,&h)==meter_wit_OK);
#else
        assert(meter_wit_drop_parked(s,&h)==meter_wit_OK);
#endif
        assert(fcntl(fd,F_GETFD)==-1 && errno==EBADF);
#ifdef TEST_LEDGER
        expect_live(2); /* Closing the owner does not free a still-executing worker. */
#endif
#ifdef TEST_CURSOR
        meter_wit_cursor_gauge gate={0}; assert(meter_wit_open_gauge(s,true,&gate)==meter_wit_OK);
        assert(meter_wit_drop_gauge(s,&gate)==meter_wit_OK);
#else
        meter_wit_task_resume gate={0}; bool resumed=false;
        assert(meter_wit_start_resume(s,&gate)==meter_wit_OK);
        assert(meter_wit_await_resume(s,gate,&state,&resumed)==meter_wit_OK && state==meter_wit_READY && resumed);
        assert(meter_wit_drop_resume(s,&gate)==meter_wit_OK);
#endif
        assert(meter_wit_close(&s)==meter_wit_OK);
#ifdef TEST_LEDGER
        for (int i=0;i<500 && live()!=0;i++) nanosleep(&(struct timespec){.tv_nsec=10000000},NULL);
        expect_live(0); /* The actual late completion released its notification lease. */
#endif
        return;
    }
    pthread_t worker; assert(!pthread_create(&worker,NULL,retire,NULL));
#ifdef TEST_CURSOR
    assert(meter_wit_await_feed(s,h,&state,&value,&failure)==meter_wit_UNAVAILABLE);
    assert(state==meter_wit_PENDING && value.ok && value.value==9 && failure==82);
#else
    assert(meter_wit_await_parked(s,h,&state,&value)==meter_wit_UNAVAILABLE);
    assert(state==meter_wit_PENDING && value==9);
#endif
    assert(!pthread_join(worker,NULL)); assert(meter_wit_close(&s)==meter_wit_OK);
    assert(fcntl(fd,F_GETFD)==-1 && errno==EBADF);
#ifdef TEST_LEDGER
    /* No new application call can resolve the parked promise after retirement.
       Only the existing worker notification remains; the public owner and session are gone. */
    expect_live(1);
#endif
}
int main(void) {
    alarm(45);
    check(false); check(true);
    puts("parked await woke on retirement");
}
