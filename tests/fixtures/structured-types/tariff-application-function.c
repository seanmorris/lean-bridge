/* The same client uses the installed native C or Wasmtime API. The observer owns the session. */
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

typedef Q(session) session;
typedef Q(status) status;
typedef Q(result) owner;
typedef Q(pack_quote_argument0_t) quote;
typedef Q(pack_quote_argument0_t_host) app;
typedef Q(visit_application_quote_argument1_t_host) visitor;
typedef struct { unsigned calls, replies; uint32_t last, base; int mode, fail; quote borrow, saved; owner *lease; } state;
static void drop(owner **p) { assert(*p && Q(result_release)(p)==S(OK) && !*p); }
static status price(void *p, session *s, uint32_t n, uint32_t *out, owner **o) {
    (void)s; state *a=p; assert(!*o); ++a->calls; a->last=n;
    if (a->fail) return S(CALLBACK_FAILED);
    *out=a->base+n; return S(OK);
}
static status give(void *p, session *s, uint32_t n, quote *out, owner **o) {
    (void)s; state *a=p; assert(n==99 && !*o); ++a->replies; *out=a->borrow; return S(OK);
}
static void rejected(session *s, quote f, status expected) {
    uint32_t n=12345; owner *o=NULL;
    assert(Q(pack_quote_argument0_t_call)(s,f,900,&n,&o)==expected && n==12345 && !o);
}
static status visit(void *p, session *s, quote f, uint32_t n, uint32_t *out, owner **o) {
    state *a=p; assert(f && !*o);
    if (a->mode==2) {
        state other={.base=100}; app inner={.context=&other,.call=price}; visitor inspect={.context=&other,.call=visit};
        uint32_t result=0; owner *held=NULL;
        assert(Q(visit_application_quote)(s,&inner,&inspect,1,&result,&held)==S(OK) && result==101 && other.calls==1);
        drop(&held); rejected(s,other.borrow,S(INVALID_ARGUMENT)); rejected(s,other.saved,S(CALLBACK_FAILED)); drop(&other.lease);
    }
    a->borrow=f;
    app original={.closure=f}; quote forwarded=NULL; owner *held=NULL;
    assert(Q(pass_application_quote)(s,&original,&forwarded,&held)==S(OK) && forwarded && held);
    status code; owner *result=NULL;
    if (a->mode==1) {
        Q(tariff_t) fallback={0}; owner *control=NULL;
        assert(Q(make_tariff)(s,800,&fallback,&control)==S(OK));
        state reply={.borrow=forwarded}; Q(staged_quote_argument0_t_host) choose={.call=give,.context=&reply,.recovery=&fallback.quote};
        code=Q(staged_quote)(s,&choose,99,n,out,&result);
        assert(reply.replies==1); ++a->replies; drop(&control);
    } else {
        code=Q(pack_quote_argument0_t_call)(s,forwarded,n,out,&result);
        assert(Q(pack_quote_argument0_t_retain)(s,f,&a->saved,&a->lease)==S(OK));
    }
    if (code==S(OK)) drop(&result); else assert(!result);
    drop(&held); return code;
}

void application_consumer(session *s,void (*check)(const char *)) {
    state a={.base=40}; app original={.call=price,.context=&a}; visitor inspect={.call=visit,.context=&a};
    quote f=NULL; owner *o=NULL; uint32_t n=777;
    assert(Q(pass_application_quote)(s,&original,&f,&o)==S(OK));
    rejected(s,f,S(CALLBACK_FAILED)); assert(!a.calls); drop(&o); check("expired");
    assert(Q(visit_application_quote)(s,&original,&inspect,2,&n,&o)==S(OK) && n==42);
    drop(&o); rejected(s,a.borrow,S(INVALID_ARGUMENT)); rejected(s,a.saved,S(CALLBACK_FAILED));
    assert(a.calls==1 && a.last==2); drop(&a.lease); check("forward");
    a.mode=1;
    assert(Q(visit_application_quote)(s,&original,&inspect,3,&n,&o)==S(OK) && n==43);
    drop(&o); assert(a.calls==2 && a.last==3 && a.replies==1); check("reply");
    a.mode=2;
    assert(Q(visit_application_quote)(s,&original,&inspect,4,&n,&o)==S(OK) && n==44);
    drop(&o); rejected(s,a.saved,S(CALLBACK_FAILED)); drop(&a.lease); assert(a.calls==3 && a.last==4); check("nested");
    a.mode=1; a.fail=1; n=999;
    assert(Q(visit_application_quote)(s,&original,&inspect,5,&n,&o)==S(CALLBACK_FAILED) && n==999 && !o);
    assert(a.calls==4 && a.last==5 && a.replies==2); check("failure");
    Q(tariff_t) genuine={0}; owner *input=NULL;
    assert(Q(make_tariff)(s,900,&genuine,&input)==S(OK)); app src={.closure=genuine.quote};
    assert(Q(pass_application_quote)(s,&src,&f,&o)==S(OK)); drop(&input);
    assert(Q(pack_quote_argument0_t_call)(s,f,6,&n,&input)==S(OK) && n==906);
    drop(&input); drop(&o); assert(a.calls==4); check("control");
}
