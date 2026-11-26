/* A function-bearing record travels into a C callback and back into Lean. */
#include "tariff_quotes.h"
#include <assert.h>
#include <stdio.h>

typedef tariff_quotes_tariff_t tariff;
typedef tariff_quotes_session session;
typedef tariff_quotes_result owner;
typedef tariff_quotes_pack_quote_argument0_t quote;
typedef tariff_quotes_status status;
enum mode { echo, replace, keep, host_error, foreign, nested };
struct request {
    enum mode mode;
    uint32_t base;
    unsigned visits;
    session *peer;
    quote seen, sent, held;
    owner *lease;
};

static uint32_t read_price(session *s, quote fn, uint32_t units) {
    uint32_t price = 0; owner *o = NULL;
    assert(tariff_quotes_pack_quote_argument0_t_call(s, fn, units, &price, &o) == TARIFF_QUOTES_OK);
    assert(o && tariff_quotes_result_release(&o) == TARIFF_QUOTES_OK && !o);
    return price;
}

static void expired(session *s, quote fn) {
    uint32_t price = 7654321; owner *o = NULL;
    assert(fn && tariff_quotes_pack_quote_argument0_t_call(s, fn, 1, &price, &o) == TARIFF_QUOTES_INVALID_ARGUMENT);
    assert(!o && price == 7654321);
}

static void exchange(session *, struct request *, status, uint32_t);

static status revise(void *context, session *s, const tariff *in, tariff *out, owner **reply_owner) {
    struct request *r = context;
    ++r->visits;
    r->seen = in->quote; /* Save the value of the handle, never a pointer to the frame. */
    uint32_t quoted = read_price(s, in->quote, 1);
    assert(quoted == r->base + 1 && !*reply_owner);
    if (r->mode == echo) {
        *out = *in; /* The bridge must consume the reply before retiring the input borrow. */
        return TARIFF_QUOTES_OK;
    }
    if (r->mode == keep) {
        assert(tariff_quotes_pack_quote_argument0_t_retain(s, in->quote, &r->held, &r->lease) == TARIFF_QUOTES_OK);
        bool same = false;
        assert(tariff_quotes_pack_quote_argument0_t_equal(s, in->quote, r->held, &same) == TARIFF_QUOTES_OK && same);
    }
    if (r->mode == nested) {
        struct request inner = {.mode = host_error, .base = 7};
        exchange(s, &inner, TARIFF_QUOTES_CALLBACK_FAILED, 0);
        expired(s, inner.seen); expired(s, inner.sent);
        assert(read_price(s, in->quote, 2) == r->base + 2);
    }
    session *defining = r->mode == foreign ? r->peer : s;
    assert(tariff_quotes_make_tariff(defining, quoted + 100, out, reply_owner) == TARIFF_QUOTES_OK);
    r->sent = out->quote;
    if (r->mode == keep) {
        bool same = true;
        assert(tariff_quotes_pack_quote_argument0_t_equal(s, in->quote, r->sent, &same) == TARIFF_QUOTES_OK && !same);
    }
    /* Even an unsuccessful callback transfers its supplied result owner for cleanup. */
    return r->mode == host_error ? TARIFF_QUOTES_INVALID_ARGUMENT : TARIFF_QUOTES_OK;
}

static void exchange(session *s, struct request *r, status expected, uint32_t answer) {
    tariff_quotes_exchange_tariff_argument0_t_host cb = {.call = revise, .context = r};
    uint32_t price = 7654321; owner *o = NULL;
    status actual = tariff_quotes_exchange_tariff(s, &cb, r->base, 3, &price, &o);
    if (actual != expected)
        fprintf(stderr, "exchange mode %d: expected %d, got %d\n", r->mode, expected, actual);
    assert(actual == expected);
    assert(r->visits == 1);
    if (expected == TARIFF_QUOTES_OK) {
        assert(price == answer && o);
        assert(tariff_quotes_result_release(&o) == TARIFF_QUOTES_OK && !o);
    } else {
        assert(price == 7654321 && !o);
    }
}

int tariff_exchange_consumer(session *s, void (*checkpoint)(void)) {
    struct request same = {.mode = echo, .base = 10};
    exchange(s, &same, TARIFF_QUOTES_OK, 13);
    expired(s, same.seen); checkpoint(); puts("borrowed reply");

    struct request other = {.mode = replace, .base = 20};
    exchange(s, &other, TARIFF_QUOTES_OK, 124);
    expired(s, other.seen); expired(s, other.sent); checkpoint(); puts("owned replacement");

    struct request kept = {.mode = keep, .base = 30};
    exchange(s, &kept, TARIFF_QUOTES_OK, 134);
    assert(read_price(s, kept.held, 5) == 35); expired(s, kept.sent);
    expired(s, kept.seen); /* Check while the independent lease is still live. */
    assert(tariff_quotes_result_release(&kept.lease) == TARIFF_QUOTES_OK && !kept.lease);
    expired(s, kept.held); expired(s, kept.seen); checkpoint(); puts("explicit retain");

    struct request failed = {.mode = host_error, .base = 40};
    exchange(s, &failed, TARIFF_QUOTES_CALLBACK_FAILED, 0);
    expired(s, failed.seen); expired(s, failed.sent); checkpoint(); puts("error with owned reply");

    struct request wrong = {.mode = foreign, .base = 50};
    assert(tariff_quotes_session_open(&wrong.peer) == TARIFF_QUOTES_OK);
    exchange(s, &wrong, TARIFF_QUOTES_INVALID_ARGUMENT, 0);
    expired(s, wrong.seen); expired(wrong.peer, wrong.sent);
    assert(tariff_quotes_session_close(&wrong.peer) == TARIFF_QUOTES_OK && !wrong.peer);
    checkpoint(); puts("foreign reply");

    struct request reentered = {.mode = nested, .base = 60};
    exchange(s, &reentered, TARIFF_QUOTES_OK, 164);
    expired(s, reentered.seen); expired(s, reentered.sent); checkpoint(); puts("nested failure recovered");
    return 0;
}

#ifndef TARIFF_LIFETIME_PROBE
static void noop(void) {}
int main(void) {
    session *s = NULL;
    assert(tariff_quotes_session_open(&s) == TARIFF_QUOTES_OK);
    int result = tariff_exchange_consumer(s, noop);
    assert(tariff_quotes_session_close(&s) == TARIFF_QUOTES_OK && !s);
    return result;
}
#endif
