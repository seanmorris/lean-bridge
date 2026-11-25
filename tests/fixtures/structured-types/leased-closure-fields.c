/* Application-level assertions use only the generated public C11 header. */
#include "tariff_quotes.h"
#include <assert.h>
#include <stdio.h>

typedef tariff_quotes_pack_quote_argument0_t quote_t;
typedef tariff_quotes_pack_quote_argument0_t_host host_t;
typedef tariff_quotes_result result_t;
typedef tariff_quotes_session session_t;
typedef tariff_quotes_tariff_t tariff_t;

static void drop(result_t **owner) {
    assert(*owner != NULL);
    assert(tariff_quotes_result_release(owner) == TARIFF_QUOTES_OK && !*owner);
}

static void call(session_t *s, quote_t quote, uint32_t units, uint32_t expected) {
    result_t *owner = NULL; uint32_t price = 0;
    assert(tariff_quotes_pack_quote_argument0_t_call(s, quote, units, &price, &owner) == TARIFF_QUOTES_OK);
    assert(price == expected);
    drop(&owner);
}

static void fails(session_t *s, tariff_t tariff, tariff_quotes_status why) {
    result_t *owner = NULL; uint32_t price = 0xdecaf;
    assert(tariff_quotes_apply_tariff(s, &tariff, 6, &price, &owner) == why);
    assert(!owner && price == 0xdecaf);
}

static tariff_quotes_status borrowed(void *ctx, session_t *s, uint32_t units, uint32_t *out, result_t **owner) {
    (void)s; (void)owner;
    ++*(unsigned *)ctx;
    *out = units + 900;
    return TARIFF_QUOTES_OK;
}

int tariff_fields_consumer(session_t *s) {
    session_t *peer = NULL;
    tariff_t source = {0}, copy = {0}, echoed = {0}, repacked = {0};
    result_t *src = NULL, *copied = NULL, *echo = NULL, *projected = NULL, *packed = NULL, *retained = NULL;
    quote_t fn = NULL, kept = NULL;
    assert(tariff_quotes_make_tariff(s, 40, &source, &src) == TARIFF_QUOTES_OK);
    assert(tariff_quotes_tariff_t_copy(s, &source, &copy, &copied) == TARIFF_QUOTES_OK);
    assert(tariff_quotes_echo_tariff(s, &source, &echoed, &echo) == TARIFF_QUOTES_OK);
    assert(tariff_quotes_unpack_quote(s, &source, &fn, &projected) == TARIFF_QUOTES_OK);
    drop(&src);
    call(s, copy.quote, 2, 42); call(s, echoed.quote, 3, 43); call(s, fn, 4, 44);
    puts("copy and project");

    const host_t lean = {.closure = fn};
    assert(tariff_quotes_pack_quote(s, &lean, &repacked, &packed) == TARIFF_QUOTES_OK);
    assert(tariff_quotes_pack_quote_argument0_t_retain(s, fn, &kept, &retained) == TARIFF_QUOTES_OK);
    drop(&projected); drop(&echo); drop(&copied);
    call(s, repacked.quote, 5, 45);
    uint32_t price = 0; result_t *owner = NULL;
    assert(tariff_quotes_apply_tariff(s, &repacked, 6, &price, &owner) == TARIFF_QUOTES_OK && price == 46);
    drop(&owner); drop(&packed); call(s, kept, 7, 47);
    puts("repack and retain");

    const tariff_t alias = {.quote = kept};
    assert(tariff_quotes_session_open(&peer) == TARIFF_QUOTES_OK);
    fails(peer, alias, TARIFF_QUOTES_INVALID_ARGUMENT);
    assert(tariff_quotes_session_close(&peer) == TARIFF_QUOTES_OK && !peer);
    call(s, kept, 8, 48);
    puts("foreign session");

    drop(&retained);
    fails(s, alias, TARIFF_QUOTES_INVALID_ARGUMENT);
    price = 12345;
    assert(tariff_quotes_pack_quote_argument0_t_call(s, kept, 1, &price, &owner) == TARIFF_QUOTES_INVALID_ARGUMENT);
    assert(!owner && price == 12345);
    puts("last lease");

    tariff_quotes_ticket_t ticket = NULL;
    assert(tariff_quotes_new_ticket(s, 7, &ticket, &owner) == TARIFF_QUOTES_OK);
    /* C types prevent this without an explicit cast. The adapter must refuse it too. */
    fails(s, (tariff_t){.quote = (quote_t)ticket}, TARIFF_QUOTES_INVALID_ARGUMENT);
    drop(&owner);
    puts("wrong kind");

    unsigned invocations = 0;
    const host_t host = {.call = borrowed, .context = &invocations};
    assert(tariff_quotes_pack_quote(s, &host, &repacked, &packed) == TARIFF_QUOTES_OK);
    assert(tariff_quotes_pack_quote_argument0_t_call(s, repacked.quote, 1, &price, &owner) == TARIFF_QUOTES_CALLBACK_FAILED);
    assert(!owner && price == 12345);
    fails(s, repacked, TARIFF_QUOTES_CALLBACK_FAILED);
    assert(invocations == 0); drop(&packed);
    assert(tariff_quotes_make_tariff(s, 12, &source, &src) == TARIFF_QUOTES_OK);
    call(s, source.quote, 4, 16); drop(&src);
    puts("expired borrow and recovery");
    return 0;
}

#ifndef TARIFF_LIFETIME_PROBE
int main(void) {
    session_t *session = NULL;
    assert(tariff_quotes_session_open(&session) == TARIFF_QUOTES_OK);
    int result = tariff_fields_consumer(session);
    assert(tariff_quotes_session_close(&session) == TARIFF_QUOTES_OK && !session);
    return result;
}
#endif
