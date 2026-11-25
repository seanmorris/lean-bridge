/* Only the installed public bindings; no internal wire or SDK. */
#include <watch_wasmtime.h>
#include <assert.h>
#include <stdio.h>
#include <string.h>
#define P(x) watch_wit_##x
#define OK(call) assert((call)==P(OK))
int main(void) {
    P(session) *s=NULL; OK(P(open)(&s));
    P(state) state=P(IDLE);
    P(feed_value) item={0}; P(business_value) other={0};
    P(string) error={0};
    for (unsigned mode=0;mode<2;++mode) {
        P(cursor_feed) h={0}; OK(P(open_feed)(s,mode!=0,&h));
        OK(P(next_feed)(s,h,&state,&item,&error));
        assert(state==P(ITEM) && item.ok && item.value==73 && !error.data);
        OK(P(next_feed)(s,h,&state,&item,&error));
        assert(state==P(ITEM) && !item.ok && item.error.size==4 && !memcmp(item.error.data,"boom",4) && !error.data);
        assert(P(next_feed)(s,h,&state,&item,&error)==P(INVALID)); P(feed_value_dispose)(&item);
        OK(P(next_feed)(s,h,&state,&item,&error));
        assert(state==(mode?P(STEP_IO_FAILED):P(END)));
        assert(P(request_feed)(s,h)==P(FINISHED)); OK(P(drop_feed)(s,&h));
        if (mode) { assert(error.size==4 && !memcmp(error.data,"boom",4)); P(string_dispose)(&error); }
        else assert(!error.data);
    }
    P(cursor_business) typed={0}; OK(P(open_business)(s,&typed));
    OK(P(next_business)(s,typed,&state,&other,&error)); assert(state==P(ITEM) && other.ok && other.value==73);
    OK(P(next_business)(s,typed,&state,&other,&error)); assert(state==P(ITEM) && !other.ok && other.error.size==4 && !memcmp(other.error.data,"boom",4));
    P(business_value_dispose)(&other);
    OK(P(next_business)(s,typed,&state,&other,&error)); assert(state==P(FAILED));
    assert(P(request_business)(s,typed)==P(FINISHED)); OK(P(drop_business)(s,&typed));
    P(cursor_feed) early={0}; OK(P(open_feed)(s,true,&early)); OK(P(drop_feed)(s,&early));
    P(task_closed) count={0}; uint32_t n=0;
    OK(P(start_closed)(s,&count)); OK(P(await_closed)(s,count,&state,&n)); assert(state==P(READY) && n==4);
    OK(P(drop_closed)(s,&count)); OK(P(close)(&s));
    assert(error.size==4 && !memcmp(error.data,"boom",4)); P(string_dispose)(&error);
    puts("pollable cursor: item, end, IO error, typed error, four closes");
    return 0;
}
