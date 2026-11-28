/* A caller-created C function goes in a record, not in a separate Lean argument. */
#include "tariff_quotes.h"
#include <assert.h>
#include <stdio.h>

typedef tariff_quotes_session session;
typedef tariff_quotes_result owner;
typedef tariff_quotes_status status;
typedef tariff_quotes_tariff_t_host_input input;
typedef tariff_quotes_tariff_t tariff;
struct counter { unsigned visits, nest, fail; };
static void release(owner **o) { assert(*o && tariff_quotes_result_release(o)==TARIFF_QUOTES_OK && !*o); }
static status price(void *ctx, session *s, uint32_t units, uint32_t *out, owner **reply) {
    struct counter *c=ctx;
    assert(!*reply); ++c->visits;
    if(c->fail)return TARIFF_QUOTES_CALLBACK_FAILED;
    if(c->nest) {
        struct counter inner={0}; input other={.quote={.call=price,.context=&inner}};
        uint32_t answer=0; owner *o=NULL;
        assert(tariff_quotes_apply_tariff_with_host_fields(s,&other,units,&answer,&o)==TARIFF_QUOTES_OK);
        assert(inner.visits==1); release(&o); *out=answer+1;
    } else *out=units+40;
    return TARIFF_QUOTES_OK;
}

int tariff_host_fields_consumer(session *s, void (*checkpoint)(void)) {
    struct counter c={0}; input host={.quote={.call=price,.context=&c}};
    uint32_t n=0; owner *o=NULL;
    assert(tariff_quotes_apply_tariff_with_host_fields(s,&host,2,&n,&o)==TARIFF_QUOTES_OK);
    assert(n==42 && c.visits==1); release(&o); checkpoint(); puts("caller function in record");

    c.nest=1;
    assert(tariff_quotes_apply_tariff_with_host_fields(s,&host,2,&n,&o)==TARIFF_QUOTES_OK);
    assert(n==43 && c.visits==2); release(&o); c.nest=0; checkpoint(); puts("reentrant record callbacks");

    tariff escaped={0}; owner *returned=NULL;
    assert(tariff_quotes_echo_tariff_with_host_fields(s,&host,&escaped,&returned)==TARIFF_QUOTES_OK);
    n=107;
    for(unsigned i=0;i<2;i++) {
        assert(tariff_quotes_apply_tariff(s,&escaped,2,&n,&o)==TARIFF_QUOTES_CALLBACK_FAILED);
        assert(n==107 && !o && c.visits==2);
    }
    release(&returned); checkpoint(); puts("escaped host field no longer calls C");

    c.fail=1;
    assert(tariff_quotes_apply_tariff_with_host_fields(s,&host,2,&n,&o)==TARIFF_QUOTES_CALLBACK_FAILED);
    assert(n==107 && !o && c.visits==3); c.fail=0;
    assert(tariff_quotes_apply_tariff_with_host_fields(s,&host,4,&n,&o)==TARIFF_QUOTES_OK && n==44 && c.visits==4);
    release(&o); checkpoint(); puts("host failure and recovery");

    input empty={0}; n=107;
    assert(tariff_quotes_apply_tariff_with_host_fields(s,&empty,2,&n,&o)==TARIFF_QUOTES_INVALID_ARGUMENT);
    assert(!o && n==107 && c.visits==4); checkpoint(); puts("invalid descriptor does not invoke");

    session *peer=NULL; assert(tariff_quotes_session_open(&peer)==TARIFF_QUOTES_OK);
    tariff lean={0}; assert(tariff_quotes_make_tariff(peer,21,&lean,&returned)==TARIFF_QUOTES_OK);
    input leased={.quote={.closure=lean.quote}};
    assert(tariff_quotes_apply_tariff_with_host_fields(s,&leased,2,&n,&o)==TARIFF_QUOTES_INVALID_ARGUMENT);
    assert(!o && n==107);
    assert(tariff_quotes_apply_tariff_with_host_fields(peer,&leased,2,&n,&o)==TARIFF_QUOTES_OK && n==23);
    release(&o);release(&returned);assert(tariff_quotes_session_close(&peer)==TARIFF_QUOTES_OK);
    checkpoint(); puts("leased field keeps its session"); return 0;
}
#ifndef TARIFF_LIFETIME_PROBE
static void noop(void) {}
int main(void) {
    session *s=NULL;assert(tariff_quotes_session_open(&s)==TARIFF_QUOTES_OK);
    int rc=tariff_host_fields_consumer(s,noop);
    assert(tariff_quotes_session_close(&s)==TARIFF_QUOTES_OK);return rc;
}
#endif
