/* These two exports have the same Lean type, but different typed C callbacks. */
#include "tariff_quotes.h"
#include <assert.h>
#include <stdio.h>

typedef tariff_quotes_session session;
typedef tariff_quotes_result owner;
typedef tariff_quotes_status status;
typedef tariff_quotes_pack_quote_argument0_t quote;
_Static_assert(TARIFF_QUOTES_STAGED_QUOTE_ARGUMENT0_T_REQUIRES_RECOVERY == 1, "staged: closure reply");
_Static_assert(TARIFF_QUOTES_FLAT_QUOTE_ARGUMENT0_T_REQUIRES_RECOVERY == 0, "flat: scalar reply");

enum mode { create, borrow, missing_recovery, fail, wrong_session };
struct factory { enum mode mode; unsigned calls; session *peer; quote fallback, sent; };

static status scalar_reply(void *ctx, session *s, uint32_t base, uint32_t units, uint32_t *out, owner **o) {
    (void)s;
    ++*(unsigned *)ctx;
    assert(!*o && base == 10 && units == 3);
    *out = base * 10 + units;
    return TARIFF_QUOTES_OK;
}

static status function_reply(void *ctx, session *s, uint32_t base, quote *out, owner **o) {
    struct factory *f = ctx;
    ++f->calls;
    assert(base == 10 && !*o);
    if (f->mode == borrow) {
        *out = f->fallback;
    } else {
        tariff_quotes_tariff_t replacement = {0};
        session *defining = f->mode == wrong_session ? f->peer : s;
        assert(tariff_quotes_make_tariff(defining, base + 80, &replacement, o) == TARIFF_QUOTES_OK);
        *out = replacement.quote;
    }
    f->sent = *out;
    return f->mode == fail ? TARIFF_QUOTES_INVALID_ARGUMENT : TARIFF_QUOTES_OK;
}

static void stale(session *s, quote fn) {
    uint32_t price = 7654321; owner *o = NULL;
    assert(fn && tariff_quotes_pack_quote_argument0_t_call(s, fn, 1, &price, &o) == TARIFF_QUOTES_INVALID_ARGUMENT);
    assert(!o && price == 7654321);
}

static void staged(session *s, enum mode mode, status expected) {
    struct factory f = {.mode = mode};
    tariff_quotes_tariff_t recovery = {0}; owner *fallback_owner = NULL, *value_owner = NULL;
    assert(tariff_quotes_make_tariff(s, 700, &recovery, &fallback_owner) == TARIFF_QUOTES_OK);
    f.fallback = recovery.quote;
    if (mode == wrong_session) assert(tariff_quotes_session_open(&f.peer) == TARIFF_QUOTES_OK);
    const tariff_quotes_staged_quote_argument0_t_host cb = {.call = function_reply, .context = &f,
        .recovery = mode == missing_recovery ? NULL : &recovery.quote};
    uint32_t price = 7654321;
    status actual = tariff_quotes_staged_quote(s, &cb, 10, 3, &price, &value_owner);
    if (actual != expected) fprintf(stderr, "stage %d: expected %d, got %d\n", mode, expected, actual);
    assert(actual == expected && f.calls == (mode == missing_recovery ? 0u : 1u));
    if (actual == TARIFF_QUOTES_OK) {
        assert(value_owner && price == (mode == borrow ? 703u : 93u));
        assert(tariff_quotes_result_release(&value_owner) == TARIFF_QUOTES_OK && !value_owner);
    } else {
        /* The typed recovery is private to Lean; it must not be published as success. */
        assert(price == 7654321 && !value_owner);
    }
    if (f.sent && mode != borrow) stale(f.peer ? f.peer : s, f.sent);
    if (f.peer) assert(tariff_quotes_session_close(&f.peer) == TARIFF_QUOTES_OK && !f.peer);
    /* A pre-existing function in a reply does not transfer its caller's independent owner. */
    assert(tariff_quotes_pack_quote_argument0_t_call(s, recovery.quote, 9, &price, &value_owner) == TARIFF_QUOTES_OK);
    assert(price == 709 && value_owner && tariff_quotes_result_release(&value_owner) == TARIFF_QUOTES_OK);
    assert(tariff_quotes_result_release(&fallback_owner) == TARIFF_QUOTES_OK);
    stale(s, f.fallback);
}

int tariff_staged_consumer(session *s, void (*checkpoint)(void)) {
    unsigned visits = 0; uint32_t price = 0; owner *o = NULL;
    const tariff_quotes_flat_quote_argument0_t_host flat = {.call = scalar_reply, .context = &visits};
    assert(tariff_quotes_flat_quote(s, &flat, 10, 3, &price, &o) == TARIFF_QUOTES_OK);
    assert(visits == 1 && price == 103 && o && tariff_quotes_result_release(&o) == TARIFF_QUOTES_OK);
    checkpoint(); puts("flat scalar reply");
    staged(s, create, TARIFF_QUOTES_OK); checkpoint(); puts("returned function invoked");
    staged(s, borrow, TARIFF_QUOTES_OK); checkpoint(); puts("caller retains independent function");
    staged(s, missing_recovery, TARIFF_QUOTES_INVALID_ARGUMENT); checkpoint(); puts("missing function recovery");
    staged(s, fail, TARIFF_QUOTES_CALLBACK_FAILED); checkpoint(); puts("host failure releases function reply");
    staged(s, wrong_session, TARIFF_QUOTES_INVALID_ARGUMENT); checkpoint(); puts("foreign function reply");
    return 0;
}

#ifndef TARIFF_LIFETIME_PROBE
static void noop(void) {}
int main(void) {
    session *s = NULL;
    assert(tariff_quotes_session_open(&s) == TARIFF_QUOTES_OK);
    int result = tariff_staged_consumer(s, noop);
    assert(tariff_quotes_session_close(&s) == TARIFF_QUOTES_OK && !s);
    return result;
}
#endif
