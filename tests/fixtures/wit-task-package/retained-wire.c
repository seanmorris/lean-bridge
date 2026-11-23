/* Probe the store owner's private native transport, not a public WIT consumer.
 * Including the actual generated wire checks its C signatures as well as values. */
#include "wire.c"
#include "lean_bridge_native_runtime.h"
#include <assert.h>
#include <errno.h>
#include <poll.h>
#include <stdio.h>
#include <unistd.h>
#define W(n) lbwire_lbc_witprobe_v1_0_##n
#define STATUS(n) lbc_witprobe_##n
enum action { VALUE, HOST_ERROR, LEAN_ERROR, CANCEL };
static void wait_fd(int fd) {
    struct pollfd p={fd,POLLIN,0};
    int rc; do { rc=poll(&p,1,10000); } while (rc<0 && errno==EINTR);
    assert(rc==1 && (p.revents&POLLIN));
}
static void check(bool factory, enum action act) {
    static const char message[]="same message";
    uint64_t args[9]={0}, h[2]={0}, out[4]={0}, reply[3]={0};
    uint8_t tags[1]={0}; uint32_t slot=0, origin=0; int fd=-1;
    args[0]=factory; args[3]=act==LEAN_ERROR;
    assert(W(start)(args,h,out,tags)==STATUS(OK) && h[0]);
    if (act!=LEAN_ERROR) {
        assert(W(callbacks)(h,&fd)==STATUS(OK)); wait_fd(fd);
        assert(W(next)(h,&slot)==STATUS(OK) && slot==2);
        assert(W(arg)(h,slot,out)==STATUS(OK) && out[0]==11);
        if (act==CANCEL) {
            uint64_t stale[2]={h[0],h[1]};
            assert(W(close)(h)==STATUS(OK));
            assert(W(reply)(stale,slot,reply)==STATUS(CLOSED)); return;
        }
        if (act==VALUE) { reply[0]=42; assert(W(reply)(h,slot,reply)==STATUS(OK)); }
        else {
            reply[0]=(uintptr_t)message; reply[1]=sizeof(message)-1;
            assert(W(fail)(h,reply,&origin)==STATUS(OK) && origin);
        }
    }
    int rc=W(poll)(h,&fd);
    if (rc==STATUS(PENDING)) wait_fd(fd); else assert(rc==STATUS(OK));
    rc=W(take)(h,out,tags); assert(!h[0]);
    if (act==VALUE) assert(rc==STATUS(OK) && out[0]==42);
    else {
        if (act==HOST_ERROR) assert(rc==14 && out[2]==origin && tags[0]==(factory?2u:3u));
        else assert(rc==(factory?13:STATUS(IO_ERROR)));
        assert(out[3]==1 && out[1]==sizeof(message)-1);
        assert(!memcmp((const void *)(uintptr_t)out[0],message,out[1]));
        lbwire_lbc_witprobe_v1_clear(out);
    }
}
int main(void) {
    alarm(60);
    for (int factory=0;factory<=1;factory++)
        for (enum action mode=VALUE;mode<=CANCEL;mode++) check(factory,mode);
    lean_bridge_native_snapshot snap={0}; lean_bridge_native_snapshot_read(&snap);
    assert(snap.live_identities==0 && snap.runtime_init_runs==1);
    puts("Native WIT callback wire: 8 factory/worker outcomes passed");
}
