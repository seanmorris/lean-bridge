/* Observe two direct resource boundaries using the installed public API only. */
#ifdef TARIFF_WIT
#include "tariff_quotes_wasmtime.h"
#define Q(n) tariff_quotes_wasmtime_##n
#define S(n) TARIFF_QUOTES_WASMTIME_##n
#else
#include "tariff_quotes.h"
#define Q(n) tariff_quotes_##n
#define S(n) TARIFF_QUOTES_##n
#endif
#include <assert.h>
#include <stdio.h>

typedef Q(session) session;
typedef Q(ticket_t) ticket;
typedef Q(result) owner;
typedef struct { uint32_t expected,received; unsigned calls; bool fail; } request;
static void drop(owner **o) { assert(*o && Q(result_release)(o)==S(OK) && !*o); }
static uint32_t serial(session *s,ticket t) {
    uint32_t n=0; owner *o=NULL;
    assert(Q(ticket_serial)(s,t,&n,&o)==S(OK)); drop(&o); return n;
}
static Q(status) exchange(void *ctx,session *s,ticket input,ticket *out,owner **o) {
    request *r=ctx; assert(input && !*o); ++r->calls;
    r->received=serial(s,input); assert(r->received==r->expected);
    /* Return a fresh owner on success; hand it to the adapter on failure as well. */
    assert(Q(new_ticket)(s,r->received+1,out,o)==S(OK) && *out && *o);
    return r->fail ? S(CALLBACK_FAILED) : S(OK);
}
void ticket_consumer(session *s,void (*check)(const char *)) {
    for (unsigned i=0;i<2;++i) {
        request r={.expected=i?71:42};
        ticket input=NULL,fallback=NULL; owner *a=NULL,*b=NULL,*o=NULL;
        assert(Q(new_ticket)(s,r.expected,&input,&a)==S(OK));
        assert(Q(new_ticket)(s,800,&fallback,&b)==S(OK));
        Q(exchange_ticket_argument1_t_host) cb={.context=&r,.call=exchange,.recovery=&fallback};
        uint32_t n=999;
        assert(Q(exchange_ticket)(s,input,&cb,&n,&o)==S(OK) && n==r.expected+1 && r.calls==1); drop(&o);
        printf("exchange:%u:%u\n",(unsigned)r.received,(unsigned)n);
        r.fail=true; n=999;
        assert(Q(exchange_ticket)(s,input,&cb,&n,&o)==S(CALLBACK_FAILED) && !o && n==999 && r.calls==2);
        assert(serial(s,input)==r.expected && serial(s,fallback)==800);
        drop(&a); drop(&b); check(i?"ticket71":"ticket42");
    }
}
