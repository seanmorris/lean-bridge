/* Downstream Wasmtime application. All operations use the package's public session. */
#include "tariff_quotes_wasmtime.h"
#include <assert.h>
#define Q(x) tariff_quotes_wasmtime_##x
#define OK TARIFF_QUOTES_WASMTIME_OK
#define INVALID TARIFF_QUOTES_WASMTIME_INVALID_ARGUMENT
#define FAIL TARIFF_QUOTES_WASMTIME_CALLBACK_FAILED
typedef Q(session) session;
typedef Q(result) owner;
typedef Q(pack_quote_argument0_t) quote;
typedef struct attempt {
    uint32_t base;
    unsigned entered;
    bool keep, fail, nest;
    quote borrow, lease;
    owner *holder;
    session *foreign;
} attempt;

static void release(owner **o) { assert(*o && Q(result_release)(o)==OK && !*o); }
static uint32_t invoke(session *s, quote f, uint32_t x) {
    uint32_t n=0; owner *o=NULL;
    assert(Q(pack_quote_argument0_t_call)(s,f,x,&n,&o)==OK); release(&o); return n;
}
static void refused(session *s, quote f) {
    uint32_t n=888; owner *o=NULL;
    assert(Q(pack_quote_argument0_t_call)(s,f,3,&n,&o)==INVALID && n==888 && !o);
}
static void visit(session *, attempt *);
static Q(status) inspect(void *context, session *s, quote f, uint32_t n, uint32_t *out, owner **o) {
    attempt *a=context; assert(++a->entered==1 && n==2 && !*o);
    a->borrow=f;
    if (a->foreign) refused(a->foreign,f);
    if (a->keep) {
        assert(Q(pack_quote_argument0_t_retain)(s,f,&a->lease,&a->holder)==OK && a->holder);
        bool equal=false;
        assert(Q(pack_quote_argument0_t_equal)(s,f,a->lease,&equal)==OK && equal);
    }
    if (a->nest) {
        attempt inner={.base=90,.fail=true}; visit(s,&inner); refused(s,inner.borrow);
    }
    *out=invoke(s,f,n); assert(*out==a->base+n);
    return a->fail ? FAIL : OK;
}
static void visit(session *s, attempt *a) {
    Q(visit_quote_argument1_t_host) callback={.context=a,.call=inspect};
    uint32_t n=588; owner *o=NULL;
    Q(status) code=Q(visit_quote)(s,a->base,&callback,2,&n,&o);
    if (a->fail) assert(code==FAIL && !o && n==588);
    else { assert(code==OK && n==a->base+2); release(&o); }
    assert(a->entered==1);
}
void wit_direct_consumer(session *s, void (*observe)(const char *)) {
    observe("baseline");
    for (unsigned keep=0; keep<2; ++keep) for (unsigned fail=0; fail<2; ++fail) {
        attempt a={.base=40,.keep=keep,.fail=fail}; visit(s,&a); refused(s,a.borrow);
        if (keep) {
            bool equal=false;
            assert(Q(pack_quote_argument0_t_equal)(s,a.borrow,a.lease,&equal)==INVALID && !equal);
            if (!fail) observe("held");
            assert(invoke(s,a.lease,5)==45); release(&a.holder); refused(s,a.lease);
        }
        observe(keep ? (fail ? "errorLease" : "lease") : (fail ? "error" : "success"));
    }
    attempt nested={.base=11,.nest=true}; visit(s,&nested); refused(s,nested.borrow); observe("nested");
    attempt first={.base=1}, second={.base=60};
    assert(Q(session_open)(&second.foreign)==OK);
    visit(s,&first); visit(s,&second); refused(s,first.borrow); refused(s,second.borrow);
    assert(Q(session_close)(&second.foreign)==OK); observe("fresh");
}
