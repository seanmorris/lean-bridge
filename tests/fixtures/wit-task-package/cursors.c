/* Public consumer. Gauge samples application pulls and closes via a separate
 * cursor; the consumer cannot fake either count by manipulating host slots. */
#include <meter_wasmtime.h>
#include <assert.h>
#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#define M(x) meter_wit_##x
#define OK(e) assert((e)==M(OK))
static void counts(M(session) *s,bool wake,uint32_t pulls,uint32_t closes) {
    M(cursor_gauge) c={0}; M(state) state=M(CLOSED); uint64_t n=0;
    OK(M(open_gauge)(s,wake,&c));
    /* Fault injection: even bypassing the public handle type cannot borrow another cursor kind. */
    M(cursor_feed) wrong={0}; _Static_assert(sizeof wrong==sizeof c,"test handle width");
    memcpy(&wrong,&c,sizeof wrong); assert(M(request_feed)(s,wrong)==M(STALE));
    OK(M(next_gauge)(s,c,&state,&n));
    assert(state==M(ITEM) && (n>>32)==pulls && (uint32_t)n==closes);
    OK(M(next_gauge)(s,c,&state,&n)); assert(state==M(END)); OK(M(drop_gauge)(s,&c));
}
static bool expired(int fd) { errno=0; return fd>=0 && fcntl(fd,F_GETFD)==-1 && errno==EBADF; }
int main(void) {
    alarm(60); M(session) *s=NULL,*peer=NULL; OK(M(open)(&s)); OK(M(open)(&peer));
    M(cursor_feed) c={0}; M(feed_value) value={0}; M(state) state=M(CLOSED);
    uint32_t start=0; uint16_t failure=73; int fd=19; bool accepted=false;
    assert(M(open_feed)(s,255,71,&c,&start)==M(START_ERROR) && start==71);
    counts(peer,false,0,0);
    OK(M(open_feed)(s,0,2,&c,&start));
    OK(M(await_feed)(s,c,&state,&value,&failure)); assert(state==M(IDLE));
    OK(M(poll_feed)(s,c,&state,&value,&failure,&fd)); assert(state==M(IDLE) && fd==-1 && failure==73);
    counts(peer,false,0,0); assert(M(request_feed)(peer,c)==M(STALE));
    OK(M(request_feed)(s,c)); assert(M(request_feed)(s,c)==M(BUSY));
    assert(M(next_feed)(s,c,&state,&value,&failure)==M(BUSY));
    counts(peer,false,1,0); OK(M(await_feed)(s,c,&state,&value,&failure));
    assert(state==M(ITEM) && value.ok && value.value==0 && failure==73);
    OK(M(poll_feed)(s,c,&state,&value,&failure,&fd)); assert(state==M(IDLE));
    counts(peer,false,1,0); OK(M(next_feed)(s,c,&state,&value,&failure)); assert(state==M(ITEM) && value.value==1);
    counts(peer,false,2,0); OK(M(next_feed)(s,c,&state,&value,&failure)); assert(state==M(END) && value.value==1);
    counts(peer,false,3,1); assert(M(request_feed)(s,c)==M(FINISHED));
    OK(M(await_feed)(s,c,&state,&value,&failure)); assert(state==M(CLOSED));
    M(cursor_feed) stale=c; OK(M(drop_feed)(s,&c)); counts(peer,false,3,1);
    OK(M(open_feed)(s,2,2,&c,&start)); assert(M(request_feed)(s,stale)==M(STALE));
    OK(M(next_feed)(s,c,&state,&value,&failure)); assert(state==M(ITEM) && !value.ok && value.error.size==4);
    assert(!memcmp(value.error.data,"item",4)); assert(M(next_feed)(s,c,&state,&value,&failure)==M(INVALID));
    counts(peer,false,4,1); OK(M(drop_feed)(s,&c)); counts(peer,false,4,2);
    assert(value.error.size==4 && !memcmp(value.error.data,"item",4)); M(feed_value_dispose)(&value);
    OK(M(open_feed)(s,1,9,&c,&start)); value.value=123;
    OK(M(next_feed)(s,c,&state,&value,&failure)); assert(state==M(FAILED) && failure==UINT16_MAX && value.value==123);
    counts(peer,false,5,3); assert(M(next_feed)(s,c,&state,&value,&failure)==M(FINISHED)); OK(M(drop_feed)(s,&c));
    OK(M(open_feed)(s,3,2,&c,&start)); OK(M(request_feed)(s,c)); OK(M(poll_feed)(s,c,&state,&value,&failure,&fd));
    assert(state==M(PENDING) && fd>=0 && value.value==123); struct pollfd gate={fd,POLLIN,0}; assert(poll(&gate,1,0)==0);
#ifdef TEST_MIXED
    M(task_immediate) task={0}; uint32_t answer=0;
    OK(M(start_immediate)(s,41,&task)); OK(M(await_immediate)(s,task,&state,&answer));
    assert(state==M(READY) && answer==42); OK(M(drop_immediate)(s,&task));
    M(cursor_outcome) named={0}; uint64_t snapshot=0;
    OK(M(open_outcome)(s,false,&named)); OK(M(next_outcome)(s,named,&state,&snapshot));
    assert(state==M(ITEM) && (snapshot>>32)==6 && (uint32_t)snapshot==3);
    OK(M(drop_outcome)(s,&named));
    assert(poll(&gate,1,0)==0); /* An unrelated task cannot wake the cursor. */
#endif
    assert(M(request_feed)(s,c)==M(BUSY)); counts(peer,true,6,3); assert(poll(&gate,1,5000)==1);
    OK(M(await_feed)(s,c,&state,&value,&failure)); assert(state==M(ITEM) && value.ok && value.value==-37 && expired(fd));
    OK(M(cancel_feed)(s,c,&accepted)); assert(accepted); counts(peer,false,6,4);
    OK(M(cancel_feed)(s,c,&accepted)); assert(!accepted); OK(M(drop_feed)(s,&c));
    OK(M(open_feed)(s,3,1,&c,&start)); OK(M(request_feed)(s,c)); OK(M(poll_feed)(s,c,&state,&value,&failure,&fd));
    assert(state==M(PENDING)); OK(M(cancel_feed)(s,c,&accepted)); assert(accepted && expired(fd));
    counts(peer,true,7,5); OK(M(await_feed)(s,c,&state,&value,&failure)); assert(state==M(CANCELLED));
    OK(M(await_feed)(s,c,&state,&value,&failure)); assert(state==M(CLOSED)); OK(M(drop_feed)(s,&c));
    M(cursor_feed) unopened={0}; OK(M(open_feed)(s,0,5,&unopened,&start));
    OK(M(open_feed)(s,3,1,&c,&start)); OK(M(request_feed)(s,c)); OK(M(poll_feed)(s,c,&state,&value,&failure,&fd));
    assert(state==M(PENDING)); OK(M(close)(&s)); assert(expired(fd)); counts(peer,true,8,7);
    OK(M(close)(&peer)); puts("installed cursors: eight pulls; seven closes; no prefetch or late delivery");
}
