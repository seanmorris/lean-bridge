/* Public pollable Wasmtime API; no private handle or status integer is inspected. */
#include <budget_wasmtime.h>
#include "observer.h"
#include <stdio.h>
#include <string.h>
#define M(n) budget_wit_##n
#define OK(x) assert((x)==M(OK))
typedef struct { unsigned calls, drops; bool fail; } tally;
static const char reason[]="callback-already-invoked";
static bool apply(void *ctx,uint32_t arg,uint32_t *reply,M(text) *error) {
    tally *t=ctx; assert(!t->drops); t->calls++;
    if(t->fail) { *error=(M(text)){reason,sizeof reason-1}; return false; }
    *reply=arg+1; return true;
}
static void release(void *ctx) { tally *t=ctx; ++t->drops; assert(t->drops==1); }
static void same_message(M(string) text) {
    assert(text.size==sizeof reason-1 && memcmp(text.data,reason,sizeof reason-1)==0);
}
#define RUN(op,expect,verify,...) do { \
    M(task_##op) task={0}; M(op##_errors) e={0}; M(state) state=M(PENDING); uint32_t value=613; \
    OK(M(start_##op)(s,__VA_ARGS__,&task)); OK(M(await_##op)(s,task,&state,&value,&e)); \
    assert(state==M(expect)); if(state!=M(READY)) assert(value==613); verify; \
    M(op##_errors_dispose)(&e); OK(M(drop_##op)(s,&task)); \
} while (0)
int main(void) {
    M(session) *s=NULL; OK(M(open)(&s));
    M(callback_uint32_to_uint32) f={0},g={0};
    tally first={0},second={0};
    OK(M(make_callback_uint32_to_uint32)(s,apply,&first,release,&f));
    OK(M(make_callback_uint32_to_uint32)(s,apply,&second,release,&g));
    RUN(probe,CALLBACK_ALREADY_INVOKED,assert(first.calls==1 && second.calls==2),1,f,g);
    RUN(pair,READY,assert(value==42 && first.calls==3),40,f,f);
    M(task_single) a={0},b={0}; M(single_errors) errors={0}; M(state) state; uint32_t value=0;
    OK(M(start_single)(s,3,f,&a)); OK(M(start_single)(s,41,f,&b));
    OK(M(await_single)(s,b,&state,&value,&errors)); assert(state==M(READY) && value==42);
    OK(M(await_single)(s,a,&state,&value,&errors)); assert(state==M(READY) && value==4);
    OK(M(drop_single)(s,&a)); OK(M(drop_single)(s,&b)); M(single_errors_dispose)(&errors);
    second.fail=true; unsigned before=second.calls;
    RUN(retry,CALLBACK_ALREADY_INVOKED,assert(second.calls==before+1),1,g);
    RUN(single,WORKER_CALLBACK_FAILED,same_message(e.callback),1,g);
    RUN(during_start,FACTORY_CALLBACK_FAILED,same_message(e.callback),1,g);
    RUN(during_start,CALLBACK_ALREADY_INVOKED,assert(!e.callback.size),1,f);
    RUN(start,FACTORY_FAILED,same_message(e.factory),0,f);
    RUN(replace,FAILED,same_message(e.worker),1,f);
    before=first.calls;
    RUN(checked,FACTORY_FAILED,assert(e.factory==73 && first.calls==before),0,f);
    RUN(checked,CALLBACK_ALREADY_INVOKED,assert(first.calls==before+1),1,f);
    for(unsigned i=0;i<16;i++) {
        before=first.calls;
        RUN(race,CALLBACK_ALREADY_INVOKED,assert(first.calls==before+1),i,f);
    }
    OK(M(drop_callback_uint32_to_uint32)(s,&f)); OK(M(drop_callback_uint32_to_uint32)(s,&g));
    assert(first.drops==1 && second.drops==1);
    OK(M(close)(&s)); expect_zero_leases();
    puts("WIT pollable: 16 worker races; once, guest, typed, factory and terminal failures distinct; both owners destroyed; zero leases");
}
