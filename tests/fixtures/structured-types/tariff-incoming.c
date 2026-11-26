/* The generated API passes a Lean closure as an argument, not as a record field. */
#include "tariff_quotes.h"
#include <assert.h>
#include <stdio.h>

typedef tariff_quotes_session session;
typedef tariff_quotes_result owner;
typedef tariff_quotes_status status;
typedef tariff_quotes_pack_quote_argument0_t quote;
enum action { read_only, keep, fail, fail_and_keep, nested };
typedef struct visit {
    enum action action;
    unsigned calls;
    uint32_t base;
    session *foreign;
    quote borrowed, retained;
    owner *lease;
} visit;

static void dispose(owner **o) {
    assert(*o && tariff_quotes_result_release(o)==TARIFF_QUOTES_OK && !*o);
}
static uint32_t invoke(session *s, quote f, uint32_t x) {
    uint32_t value=0; owner *o=NULL;
    assert(tariff_quotes_pack_quote_argument0_t_call(s,f,x,&value,&o)==TARIFF_QUOTES_OK);
    dispose(&o); return value;
}
static void rejected(session *s, quote f) {
    uint32_t value=1234; owner *o=NULL;
    assert(f && tariff_quotes_pack_quote_argument0_t_call(s,f,3,&value,&o)==TARIFF_QUOTES_INVALID_ARGUMENT);
    assert(!o && value==1234);
}
static void enter(session *, visit *);
static status inspect(void *context, session *s, quote f, uint32_t units, uint32_t *out, owner **reply) {
    visit *v=context;
    assert(++v->calls==1 && !*reply && units==2);
    v->borrowed=f;
    if(v->foreign) rejected(v->foreign,f);
    if(v->action==keep || v->action==fail_and_keep) {
        assert(tariff_quotes_pack_quote_argument0_t_retain(s,f,&v->retained,&v->lease)==TARIFF_QUOTES_OK);
        assert(v->lease && invoke(s,v->retained,1)==v->base+1);
        bool same=false;
        assert(tariff_quotes_pack_quote_argument0_t_equal(s,f,v->retained,&same)==TARIFF_QUOTES_OK && same);
    }
    if(v->action==nested) {
        visit inner={.base=71,.action=fail};
        enter(s,&inner); rejected(s,inner.borrowed);
    }
    *out=invoke(s,f,units); assert(*out==v->base+units);
    return v->action==fail || v->action==fail_and_keep ? TARIFF_QUOTES_CALLBACK_FAILED : TARIFF_QUOTES_OK;
}
static void enter(session *s, visit *v) {
    const tariff_quotes_visit_quote_argument1_t_host cb={.call=inspect,.context=v};
    uint32_t value=999; owner *o=NULL;
    status code=tariff_quotes_visit_quote(s,v->base,&cb,2,&value,&o);
    if(v->action==fail || v->action==fail_and_keep)
        assert(code==TARIFF_QUOTES_CALLBACK_FAILED && !o && value==999);
    else { assert(code==TARIFF_QUOTES_OK && value==v->base+2); dispose(&o); }
    assert(v->calls==1);
}
int tariff_incoming_consumer(session *s, void (*checkpoint)(void)) {
    visit plain={.base=40}; enter(s,&plain); rejected(s,plain.borrowed); checkpoint(); puts("borrow expires after success");
    visit failed={.base=21,.action=fail};
    enter(s,&failed); rejected(s,failed.borrowed); checkpoint(); puts("borrow expires after failure");
    for(unsigned i=0;i<2;i++) {
        visit held={.base=50+i,.action=i?fail_and_keep:keep}; enter(s,&held);
        rejected(s,held.borrowed); assert(invoke(s,held.retained,4)==held.base+4);
        bool same=false;
        assert(tariff_quotes_pack_quote_argument0_t_equal(s,held.borrowed,held.retained,&same)==TARIFF_QUOTES_INVALID_ARGUMENT && !same);
        dispose(&held.lease); rejected(s,held.retained); checkpoint();
        puts(i?"lease survives failed callback":"lease survives successful callback");
    }
    visit reentry={.base=11,.action=nested};
    enter(s,&reentry); rejected(s,reentry.borrowed); checkpoint(); puts("inner failure leaves outer borrow valid");
    visit other={.base=7}; assert(tariff_quotes_session_open(&other.foreign)==TARIFF_QUOTES_OK);
    enter(s,&other); rejected(s,other.borrowed);
    assert(tariff_quotes_session_close(&other.foreign)==TARIFF_QUOTES_OK); checkpoint(); puts("foreign session rejects live borrow");
    return 0;
}
