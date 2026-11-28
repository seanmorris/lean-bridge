/* A downstream client of the installed Component Model session, using its public header. */
#define _GNU_SOURCE
#include "tariff_quotes_wasmtime.h"
#include <assert.h>
#include <dlfcn.h>
#include <inttypes.h>
#include <stdio.h>

#define Q(name) tariff_quotes_wasmtime_##name
#define OK TARIFF_QUOTES_WASMTIME_OK
typedef Q(session) session;
typedef Q(result) owner;
typedef Q(pack_quote_argument0_t) quote;
typedef Q(tariff_t) tariff;
typedef Q(status) status;
typedef struct { uint32_t abi,state,inits,components,attached,live; uint64_t runtime,domain; } snapshot;
typedef void (*read_stats)(snapshot *);

static uint32_t count(read_stats read) {
    snapshot now = {0}; read(&now); assert(now.abi == 1); return now.live;
}
static void drop(owner **o) { assert(*o && Q(result_release)(o) == OK && !*o); }
static uint32_t call(session *s, quote fn, uint32_t value) {
    owner *o = NULL; uint32_t result = 0;
    assert(Q(pack_quote_argument0_t_call)(s, fn, value, &result, &o) == OK);
    drop(&o); return result;
}
struct registration { quote reply; unsigned entries; int fail; };
static status choose(void *ctx, session *s, uint32_t n, quote *reply, owner **o) {
    (void)s; struct registration *r = ctx; assert(n == 40 && !*o);
    ++r->entries; *reply = r->reply;
    return r->fail ? TARIFF_QUOTES_WASMTIME_INVALID_ARGUMENT : OK;
}
static status borrowed(void *ctx, session *s, uint32_t n, uint32_t *out, owner **o) {
    (void)s; assert(!*o); ++*(unsigned *)ctx; *out = n; return OK;
}
int main(int argc, char **argv) {
    assert(argc == 2);
    session *s = NULL; assert(Q(session_open)(&s) == OK);
    /* Observe an already-loaded broker. The probe must never be the first loader. */
    void *broker = dlopen(argv[1], RTLD_NOW | RTLD_NOLOAD); assert(broker);
    read_stats read = (read_stats)dlsym(broker, "lean_bridge_native_snapshot_read"); assert(read);
    tariff original = {0}, echoed = {0}, repacked = {0}, expired = {0};
    owner *a = NULL, *b = NULL, *c = NULL, *d = NULL, *e = NULL, *answer = NULL;
    quote unwrapped = NULL, kept = NULL;
    assert(Q(make_tariff)(s, 0, &original, &a) == OK); drop(&a);
    uint32_t baseline = count(read), value = 0;
    assert(Q(make_tariff)(s, 40, &original, &a) == OK);
    assert(Q(echo_tariff)(s, &original, &echoed, &b) == OK);
    assert(Q(unpack_quote)(s, &echoed, &unwrapped, &c) == OK);
    assert(Q(pack_quote_argument0_t_retain)(s, unwrapped, &kept, &d) == OK);
    const Q(pack_quote_argument0_t_host) wrap = {.closure = kept};
    assert(Q(pack_quote)(s, &wrap, &repacked, &e) == OK);
    uint32_t held = count(read); assert(held > baseline);
    drop(&a); drop(&b); drop(&c); drop(&d);
    assert(call(s, repacked.quote, 3) == 43);
    assert(Q(apply_tariff)(s, &repacked, 2, &value, &answer) == OK && value == 42); drop(&answer);

    unsigned visits = 0;
    const Q(pack_quote_argument0_t_host) host = {.call = borrowed, .context = &visits};
    assert(Q(pack_quote)(s, &host, &expired, &a) == OK);
    value = 12345;
    assert(Q(pack_quote_argument0_t_call)(s, expired.quote, 4, &value, &answer) == TARIFF_QUOTES_WASMTIME_CALLBACK_FAILED);
    assert(visits == 0 && value == 12345 && !answer);
    assert(Q(apply_tariff)(s, &expired, 4, &value, &answer) == TARIFF_QUOTES_WASMTIME_CALLBACK_FAILED);
    assert(visits == 0 && value == 12345 && !answer); drop(&a);

    struct registration r = {.reply = repacked.quote};
    const Q(staged_quote_argument0_t_host) stage = {.call = choose, .context = &r, .recovery = &repacked.quote};
    assert(Q(staged_quote)(s, &stage, 40, 4, &value, &answer) == OK && value == 44); drop(&answer);
    r.fail = 1; value = 6789;
    assert(Q(staged_quote)(s, &stage, 40, 4, &value, &answer) == TARIFF_QUOTES_WASMTIME_CALLBACK_FAILED);
    assert(value == 6789 && !answer && r.entries == 2);
    assert(call(s, repacked.quote, 5) == 45);
    quote stale = repacked.quote; drop(&e);
    assert(Q(pack_quote_argument0_t_call)(s, stale, 1, &value, &answer) == TARIFF_QUOTES_WASMTIME_INVALID_ARGUMENT);
    assert(value == 6789 && !answer);
    assert(Q(make_tariff)(s, 6, &original, &a) == OK);
    uint32_t recovered = call(s, original.quote, 36); assert(recovered == 42); drop(&a);
    uint32_t after = count(read); assert(after == baseline);
    assert(Q(session_close)(&s) == OK && !s);
    uint32_t shutdown = count(read); assert(shutdown == 0);
    printf("{\"baseline\":%" PRIu32 ",\"held\":%" PRIu32 ",\"after\":%" PRIu32 ",\"shutdown\":%" PRIu32
           ",\"entries\":%u,\"staleVisits\":%u,\"recovered\":%" PRIu32 "}\n",
           baseline, held, after, shutdown, r.entries, visits, recovered);
    dlclose(broker);
}
