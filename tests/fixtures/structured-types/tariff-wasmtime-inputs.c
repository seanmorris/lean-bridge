/* An independent installed Wasmtime client. No native Lean entry is called directly. */
#include <tariff_quotes_wasmtime.h>
#include <assert.h>
#include <dlfcn.h>
#include <inttypes.h>
#include <stdio.h>

#define Q(name) tariff_quotes_wasmtime_##name
#define OK TARIFF_QUOTES_WASMTIME_OK
#define INVALID TARIFF_QUOTES_WASMTIME_INVALID_ARGUMENT
#define FAILED TARIFF_QUOTES_WASMTIME_CALLBACK_FAILED
typedef Q(session) session;
typedef Q(result) owner;
typedef Q(tariff_t_host_input) input;
typedef struct { uint32_t abi,state,inits,components,attached,live; uint64_t runtime,domain; } snapshot;
static void (*observe)(snapshot *);
static uint32_t live(void) { snapshot x={0}; observe(&x); assert(x.abi==1); return x.live; }
static void drop(owner **o) { assert(*o && Q(result_release)(o)==OK && !*o); }

struct app { unsigned calls, nest, fail; uint32_t last, factor, add; };
static Q(status) price(void *ctx, session *s, uint32_t x, uint32_t *out, owner **reply) {
    struct app *a=ctx; assert(!*reply); ++a->calls; a->last=x;
    if(a->fail) return FAILED;
    if(a->nest) {
        struct app inner={.factor=1,.add=40};
        input row={.quote={.call=price,.context=&inner}};
        uint32_t n=0; owner *o=NULL;
        assert(Q(apply_tariff_with_host_fields)(s,&row,x,&n,&o)==OK);
        assert(inner.calls==1 && inner.last==x); drop(&o); *out=n+1;
    } else *out=x*a->factor+a->add;
    return OK;
}
int main(int argc,char **argv) {
    assert(argc==2); session *s=NULL; assert(Q(session_open)(&s)==OK);
    void *broker=dlopen(argv[1],RTLD_NOW|RTLD_NOLOAD); assert(broker);
    observe=(void (*)(snapshot *))dlsym(broker,"lean_bridge_native_snapshot_read"); assert(observe);
    owner *o=NULL,*heldOwner=NULL; Q(tariff_t) leased={0},escaped={0};
    assert(Q(make_tariff)(s,0,&leased,&o)==OK); drop(&o);
    uint32_t base=live(), n=0; struct app a={.factor=1,.add=40};
    input row={.quote={.call=price,.context=&a}};
    assert(Q(apply_tariff_with_host_fields)(s,&row,2,&n,&o)==OK && n==42); drop(&o);
    a.nest=1;
    assert(Q(apply_tariff_with_host_fields)(s,&row,2,&n,&o)==OK && n==43); drop(&o);
    assert(a.calls==2 && live()==base); a.nest=0;
    assert(Q(echo_tariff_with_host_fields)(s,&row,&escaped,&heldOwner)==OK);
    n=107;
    assert(Q(apply_tariff)(s,&escaped,2,&n,&o)==FAILED && n==107 && !o);
    drop(&heldOwner);
    Q(pack_quote_argument0_t) fn=NULL;
    assert(Q(unpack_quote_with_host_fields)(s,&row,&fn,&heldOwner)==OK);
    assert(Q(pack_quote_argument0_t_call)(s,fn,2,&n,&o)==FAILED && n==107 && !o);
    drop(&heldOwner); assert(a.calls==2 && live()==base);
    a.fail=1;
    assert(Q(apply_tariff_with_host_fields)(s,&row,2,&n,&o)==FAILED && n==107 && !o);
    a.fail=0;
    assert(Q(apply_tariff_with_host_fields)(s,&row,4,&n,&o)==OK && n==44); drop(&o);
    assert(a.calls==4 && live()==base);
    assert(Q(make_tariff)(s,21,&leased,&heldOwner)==OK);
    input retained={.quote={.closure=leased.quote}};
    assert(Q(echo_tariff_with_host_fields)(s,&retained,&escaped,&o)==OK);
    uint32_t held=live(); assert(held>base); drop(&heldOwner);
    owner *answer=NULL;
    assert(Q(apply_tariff)(s,&escaped,21,&n,&answer)==OK && n==42); drop(&answer); drop(&o);
    assert(Q(apply_tariff_with_host_fields)(s,&retained,2,&n,&o)==INVALID && n==42 && !o && live()==base);
    struct app f[4]={{.factor=2},{.factor=1,.add=1},{.factor=3},{.factor=1,.add=7}};
    Q(price_card_t_host_input) left={.quote={.call=price,.context=&f[0]},.rebate={.call=price,.context=&f[1]},.label={"A\0\303\251",4},.base=2};
    Q(price_card_t_host_input) right={.quote={.call=price,.context=&f[2]},.rebate={.call=price,.context=&f[3]},.label={"\316\262",2},.base=5};
    Q(price_card_t_host_input) bad=right; bad.rebate=(Q(pack_quote_argument0_t_host)){0};
    assert(Q(compare_cards_with_host_fields)(s,&left,&bad,&n,&o)==INVALID && n==42 && !o);
    for(int i=0;i<4;++i) assert(!f[i].calls);
    assert(Q(compare_cards_with_host_fields)(s,&left,&right,&n,&o)==OK && n==78); drop(&o);
    const uint32_t expect[]={9,5,6,2};
    for(int i=0;i<4;++i) assert(f[i].calls==1 && f[i].last==expect[i]);
    uint32_t after=live(); assert(after==base);
    assert(Q(session_close)(&s)==OK); uint32_t shutdown=live(); assert(shutdown==0);
    printf("{\"baseline\":%" PRIu32 ",\"held\":%" PRIu32 ",\"after\":%" PRIu32 ",\"shutdown\":%" PRIu32
           ",\"mixed\":%" PRIu32 ",\"inputs\":[%u,%u,%u,%u],\"hostCalls\":%u}\n",
           base,held,after,shutdown,n,f[0].last,f[1].last,f[2].last,f[3].last,a.calls);
    dlclose(broker);
}
